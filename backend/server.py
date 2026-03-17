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
