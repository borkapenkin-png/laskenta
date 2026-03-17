from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import fal_client


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Set FAL_KEY for fal_client
fal_key = os.environ.get('FAL_KEY', '')
if fal_key:
    os.environ["FAL_KEY"] = fal_key

# Configure logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection - lazy initialization with error handling
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'app_db')
client: Optional[AsyncIOMotorClient] = None
db = None

async def get_database():
    """Get database connection, initialize if needed"""
    global client, db
    if client is None and mongo_url:
        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
            db = client[db_name]
            # Test connection
            await client.admin.command('ping')
            logger.info("MongoDB connected successfully")
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}. App will work without database.")
            client = None
            db = None
    return db

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str


# Health check endpoint - CRITICAL for Kubernetes
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    db_status = "disconnected"
    try:
        database = await get_database()
        if database is not None:
            await client.admin.command('ping')
            db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return HealthResponse(
        status="healthy",
        database=db_status,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@api_router.get("/health")
async def api_health_check():
    """Health check endpoint under /api prefix"""
    return await health_check()


# Add your routes to the router
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    database = await get_database()
    if database is None:
        # Return response even without database
        status_obj = StatusCheck(client_name=input.client_name)
        return status_obj
    
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    try:
        _ = await database.status_checks.insert_one(doc)
    except Exception as e:
        logger.error(f"Failed to insert status check: {e}")
    
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    database = await get_database()
    if database is None:
        return []
    
    try:
        # Exclude MongoDB's _id field from the query results
        status_checks = await database.status_checks.find({}, {"_id": 0}).to_list(1000)
        
        # Convert ISO string timestamps back to datetime objects
        for check in status_checks:
            if isinstance(check.get('timestamp'), str):
                check['timestamp'] = datetime.fromisoformat(check['timestamp'])
        
        return status_checks
    except Exception as e:
        logger.error(f"Failed to get status checks: {e}")
        return []


# ==================== SAM SEGMENTATION ENDPOINTS ====================

class SAMSegmentRequest(BaseModel):
    """Request for SAM segmentation - image as base64 data URL"""
    image_data: str  # base64 data URL (data:image/png;base64,...)
    
class SAMPointRequest(BaseModel):
    """Request for SAM point-based segmentation"""
    image_data: str  # base64 data URL
    point_x: float  # Normalized x coordinate (0-1)
    point_y: float  # Normalized y coordinate (0-1)
    image_width: int  # Actual canvas pixel width
    image_height: int  # Actual canvas pixel height

class SAMSegmentResponse(BaseModel):
    """Response with segmentation masks"""
    success: bool
    masks: Optional[List[dict]] = None  # List of masks with coordinates
    error: Optional[str] = None

@api_router.post("/sam/segment-all", response_model=SAMSegmentResponse)
async def sam_segment_all(request: SAMSegmentRequest):
    """
    Segment all objects in an image using SAM 3.
    Returns all detected masks/regions.
    """
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    
    try:
        logger.info("Starting SAM segmentation...")
        
        # Call fal.ai SAM 3 endpoint
        result = await fal_client.run_async(
            "fal-ai/sam-3/image",
            arguments={
                "image_url": request.image_data,  # fal.ai accepts data URLs
                "generate_masks": True,
            }
        )
        
        logger.info(f"SAM result: {result}")
        
        # Extract masks from result
        masks = []
        if result and "masks" in result:
            for i, mask in enumerate(result["masks"]):
                masks.append({
                    "id": i,
                    "mask_url": mask.get("url", ""),
                    "bbox": mask.get("bbox", []),  # [x, y, width, height]
                    "area": mask.get("area", 0),
                })
        
        return SAMSegmentResponse(success=True, masks=masks)
        
    except Exception as e:
        logger.error(f"SAM segmentation failed: {e}")
        return SAMSegmentResponse(success=False, error=str(e))

@api_router.post("/sam/segment-point", response_model=SAMSegmentResponse)
async def sam_segment_point(request: SAMPointRequest):
    """
    Segment object at a specific point using SAM 3.
    User clicks on a point, SAM returns the mask for that region.
    """
    if not fal_key:
        raise HTTPException(status_code=500, detail="FAL_KEY not configured")
    
    try:
        # Convert normalized (0-1) to actual pixel coordinates
        pixel_x = int(request.point_x * request.image_width)
        pixel_y = int(request.point_y * request.image_height)
        
        logger.info(f"SAM point seg: normalized ({request.point_x:.3f}, {request.point_y:.3f}) -> pixel ({pixel_x}, {pixel_y}) on {request.image_width}x{request.image_height}")
        
        result = await fal_client.run_async(
            "fal-ai/sam-3/image",
            arguments={
                "image_url": request.image_data,
                "point_prompts": [
                    {"x": pixel_x, "y": pixel_y, "label": 1}
                ],
                "apply_mask": True,
                "include_scores": True,
                "include_boxes": True,
                "return_multiple_masks": True,
                "max_masks": 3,
            }
        )
        
        logger.info(f"SAM result keys: {list(result.keys()) if result else 'None'}")
        
        masks = []
        if result:
            masks_list = result.get("masks") or []
            metadata_list = result.get("metadata") or []
            scores_list = result.get("scores") or []
            boxes_list = result.get("boxes") or []
            
            logger.info(f"Processing {len(masks_list)} masks, {len(metadata_list)} metadata, {len(scores_list)} scores, {len(boxes_list)} boxes")
            
            for i, mask in enumerate(masks_list):
                mask_url = mask.get("url", "") if isinstance(mask, dict) else str(mask)
                mask_w = mask.get("width", 0) if isinstance(mask, dict) else 0
                mask_h = mask.get("height", 0) if isinstance(mask, dict) else 0
                
                # Get bbox: prefer metadata.box, fallback to boxes list
                # Format: [cx, cy, w, h] normalized (0-1)
                bbox = []
                if i < len(metadata_list) and metadata_list[i]:
                    bbox = metadata_list[i].get("box", [])
                if not bbox and i < len(boxes_list) and boxes_list[i]:
                    bbox = boxes_list[i]
                
                # Get score: prefer metadata.score, fallback to scores list
                score = 0.0
                if i < len(metadata_list) and metadata_list[i]:
                    score = metadata_list[i].get("score", 0) or 0
                if score == 0 and i < len(scores_list):
                    score = scores_list[i] or 0
                
                # Area from normalized bbox [cx, cy, w, h]
                area = (bbox[2] * bbox[3]) if len(bbox) >= 4 else 0
                
                mask_data = {
                    "id": i,
                    "mask_url": mask_url,
                    "bbox": bbox,
                    "area": area,
                    "score": score,
                    "mask_width": mask_w,
                    "mask_height": mask_h,
                }
                masks.append(mask_data)
                logger.info(f"Mask {i}: score={score:.3f}, bbox={bbox}, area={area:.4f}, url={mask_url[:80] if mask_url else 'None'}")
            
            # Sort by score descending so best mask is first
            masks.sort(key=lambda m: m.get("score", 0), reverse=True)
        
        logger.info(f"Returning {len(masks)} masks")
        return SAMSegmentResponse(success=True, masks=masks)
        
    except Exception as e:
        logger.error(f"SAM point segmentation failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return SAMSegmentResponse(success=False, error=str(e))


# ==================== PRESET ENDPOINTS ====================

# Default presets (same as frontend defaults - single source of truth)
DEFAULT_TOOL_PRESETS = {
    "line": {
        "groups": [
            {
                "name": "Kotelot",
                "items": [
                    {"id": "line-1", "name": "Kuivatila kotelot rakennus", "price": 35, "unit": "jm", "constructionType": "kuivatilaKotelo", "hasOptions": True},
                    {"id": "line-2", "name": "Kuivatila kotelot tasoitus ja maalaus", "price": 45, "unit": "jm"},
                    {"id": "line-3", "name": "PRH Kotelo rakennus", "price": 35, "unit": "jm", "constructionType": "prhKotelo", "hasOptions": True},
                ]
            },
            {
                "name": "Seinä",
                "items": [
                    {"id": "line-seina-1", "name": "Kipsiotsa rakennus", "price": 20, "unit": "jm", "constructionType": "kipsiotsa", "hasOptions": True},
                ]
            },
        ]
    },
    "wall": {
        "groups": [
            {
                "name": "Maalaus ja tasoitus",
                "items": [
                    {"id": "wall-1", "name": "Huoltomaalaus", "price": 10, "unit": "m²"},
                    {"id": "wall-2", "name": "Kipsiseinä tasoitus ja maalaus", "price": 20, "unit": "m²"},
                    {"id": "wall-3", "name": "Verkkotus, tasoitus ja maalaus", "price": 30, "unit": "m²"},
                    {"id": "wall-4", "name": "Tapetointi", "price": 20, "unit": "m²"},
                    {"id": "wall-5", "name": "Mikrotsementi", "price": 85, "unit": "m²"},
                ]
            },
            {
                "name": "Seinä rakennus",
                "items": [
                    {"id": "wall-seina-1", "name": "Kipsiseinä rakennus", "price": 25, "unit": "m²", "constructionType": "kipsiseina", "hasOptions": True},
                ]
            },
        ]
    },
    "rectangle": {
        "groups": [
            {
                "name": "Katto",
                "items": [
                    {"id": "rect-1", "name": "Kipsikatto tasoitus ja maalaus", "price": 20, "unit": "m²"},
                    {"id": "rect-2", "name": "MT Kipsikatto tasoitus ja maalaus", "price": 40, "unit": "m²"},
                    {"id": "rect-3", "name": "AK huoltomaalaus", "price": 10, "unit": "m²"},
                    {"id": "rect-4", "name": "Katto verkotus, tasoitus ja maalaus", "price": 30, "unit": "m²"},
                ]
            },
            {
                "name": "Lattia",
                "items": [
                    {"id": "rect-5", "name": "Pölysidonta", "price": 2.5, "unit": "m²"},
                    {"id": "rect-6", "name": "Lattiamaalaus/lakkaus", "price": 14, "unit": "m²"},
                    {"id": "rect-7", "name": "Lattiapinnoitus", "price": 45, "unit": "m²"},
                ]
            },
            {
                "name": "Alakatto rakennus",
                "items": [
                    {"id": "rect-8", "name": "Kuivatila AK rakennus", "price": 35, "unit": "m²", "constructionType": "kuivatilaAK", "hasOptions": True},
                    {"id": "rect-9", "name": "Märkätila AK rakennus", "price": 35, "unit": "m²", "constructionType": "markatilaAK", "hasOptions": True},
                    {"id": "rect-10", "name": "PRH AK rakennus", "price": 35, "unit": "m²", "constructionType": "prhAK", "hasOptions": True},
                ]
            },
        ]
    },
    "polygon": {
        "groups": [
            {
                "name": "Katto",
                "items": [
                    {"id": "poly-1", "name": "Kipsikatto tasoitus ja maalaus", "price": 20, "unit": "m²"},
                    {"id": "poly-2", "name": "MT Kipsikatto tasoitus ja maalaus", "price": 40, "unit": "m²"},
                    {"id": "poly-3", "name": "AK huoltomaalaus", "price": 10, "unit": "m²"},
                    {"id": "poly-4", "name": "Katto verkotus, tasoitus ja maalaus", "price": 30, "unit": "m²"},
                ]
            },
            {
                "name": "Lattia",
                "items": [
                    {"id": "poly-5", "name": "Pölysidonta", "price": 2.5, "unit": "m²"},
                    {"id": "poly-6", "name": "Lattiamaalaus/lakkaus", "price": 14, "unit": "m²"},
                    {"id": "poly-7", "name": "Lattiapinnoitus", "price": 45, "unit": "m²"},
                ]
            },
            {
                "name": "Alakatto rakennus",
                "items": [
                    {"id": "poly-8", "name": "Kuivatila AK rakennus", "price": 35, "unit": "m²", "constructionType": "kuivatilaAK", "hasOptions": True},
                    {"id": "poly-9", "name": "Märkätila AK rakennus", "price": 35, "unit": "m²", "constructionType": "markatilaAK", "hasOptions": True},
                    {"id": "poly-10", "name": "PRH AK rakennus", "price": 35, "unit": "m²", "constructionType": "prhAK", "hasOptions": True},
                ]
            },
        ]
    },
    "count": {
        "groups": [
            {
                "name": "Ovet ja ikkunat",
                "items": [
                    {"id": "count-1", "name": "Oven maalaus yheltä puolelta", "price": 90, "unit": "kpl"},
                    {"id": "count-1b", "name": "Oven maalaus molemmilta puolelta", "price": 180, "unit": "kpl"},
                    {"id": "count-2", "name": "Sisäikkuna sisäpuolelta", "price": 70, "unit": "kpl"},
                    {"id": "count-2b", "name": "Sisäikkuna molemmilta puolelta", "price": 140, "unit": "kpl"},
                    {"id": "count-2c", "name": "Sisä molemmin puolelta ja ulkoikkuna sisäpuolelta", "price": 240, "unit": "kpl"},
                ]
            },
            {
                "name": "Pystykotelot rakennus",
                "items": [
                    {"id": "count-3", "name": "Kuivatila pystykotelo rakennus", "price": 35, "unit": "kpl", "constructionType": "kuivatilaPystykotelo", "hasOptions": True},
                    {"id": "count-4", "name": "PRH pystykotelo rakennus", "price": 35, "unit": "kpl", "constructionType": "prhPystykotelo", "hasOptions": True},
                    {"id": "count-5", "name": "Pystykotelot tasoitus ja maalaus", "price": 45, "unit": "kpl", "isPystykotelot": True},
                ]
            },
        ]
    }
}

DEFAULT_MAKSUERA_PRESETS = [
    {
        "id": "yse-6",
        "name": "YSE-6 (balanced)",
        "rows": [
            {"selite": "Työmaan käynnistys", "percent": 10},
            {"selite": "Valmistelut", "percent": 15},
            {"selite": "Pohjatyöt", "percent": 20},
            {"selite": "Pintatyöt", "percent": 25},
            {"selite": "Viimeistely", "percent": 20},
            {"selite": "Luovutus / virheet korjattu", "percent": 10},
        ]
    },
    {
        "id": "yse-8",
        "name": "YSE-8 (detailed)",
        "rows": [
            {"selite": "Aloitus", "percent": 10},
            {"selite": "Suojaukset", "percent": 12},
            {"selite": "Tasoitusvaihe 1", "percent": 13},
            {"selite": "Tasoitusvaihe 2", "percent": 13},
            {"selite": "Pohjamaalaus", "percent": 14},
            {"selite": "Pintamaalaus", "percent": 14},
            {"selite": "Viimeistely", "percent": 14},
            {"selite": "Vastaanotto", "percent": 10},
        ]
    }
]


@api_router.get("/presets/tools")
async def get_tool_presets():
    """Get tool presets from MongoDB or return defaults"""
    database = await get_database()
    if database is not None:
        try:
            doc = await database.presets.find_one({"type": "tools"}, {"_id": 0})
            if doc and "data" in doc:
                return {"presets": doc["data"]}
        except Exception as e:
            logger.error(f"Failed to load tool presets: {e}")
    return {"presets": DEFAULT_TOOL_PRESETS}


@api_router.put("/presets/tools")
async def save_tool_presets(body: dict):
    """Save tool presets to MongoDB"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        presets_data = body.get("presets", {})
        await database.presets.update_one(
            {"type": "tools"},
            {"$set": {"type": "tools", "data": presets_data, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save tool presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/presets/maksuera")
async def get_maksuera_presets():
    """Get maksuerä presets from MongoDB or return defaults"""
    database = await get_database()
    if database is not None:
        try:
            doc = await database.presets.find_one({"type": "maksuera"}, {"_id": 0})
            if doc and "data" in doc:
                return {"presets": doc["data"]}
        except Exception as e:
            logger.error(f"Failed to load maksuerä presets: {e}")
    return {"presets": DEFAULT_MAKSUERA_PRESETS}


@api_router.put("/presets/maksuera")
async def save_maksuera_presets(body: dict):
    """Save maksuerä presets to MongoDB"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        presets_data = body.get("presets", [])
        await database.presets.update_one(
            {"type": "maksuera"},
            {"$set": {"type": "maksuera", "data": presets_data, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save maksuerä presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/presets/reset")
async def reset_presets():
    """Reset all presets to defaults by deleting from MongoDB"""
    database = await get_database()
    if database is not None:
        try:
            await database.presets.delete_many({})
        except Exception as e:
            logger.error(f"Failed to reset presets: {e}")
    return {"presets_tools": DEFAULT_TOOL_PRESETS, "presets_maksuera": DEFAULT_MAKSUERA_PRESETS}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_db_client():
    """Initialize database connection on startup"""
    logger.info("Application starting up...")
    await get_database()
    logger.info("Application startup complete")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Close database connection on shutdown"""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")
