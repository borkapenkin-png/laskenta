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
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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


# ==================== PRODUCTIVITY RATES ENDPOINTS ====================
# Used for Work Schedule Generator feature
# Stores TES prices per unit - productivity is calculated: rate = hourlyTarget / price

# Default TES prices (€ per unit) - productivity calculated from these
DEFAULT_TES_PRICES = [
    # Maalaus ja tasoitus (€/m²)
    {"id": "prod-1", "name": "Huoltomaalaus", "price": 4.0, "unit": "m²", "category": "Maalaus"},
    {"id": "prod-2", "name": "Kipsiseinä tasoitus ja maalaus", "price": 10.0, "unit": "m²", "category": "Maalaus"},
    {"id": "prod-3", "name": "Verkkotus, tasoitus ja maalaus", "price": 15.0, "unit": "m²", "category": "Maalaus"},
    {"id": "prod-4", "name": "Tapetointi", "price": 8.0, "unit": "m²", "category": "Maalaus"},
    {"id": "prod-5", "name": "Mikrotsementi", "price": 25.0, "unit": "m²", "category": "Maalaus"},
    
    # Katto (€/m²)
    {"id": "prod-6", "name": "Kipsikatto tasoitus ja maalaus", "price": 10.0, "unit": "m²", "category": "Katto"},
    {"id": "prod-7", "name": "MT Kipsikatto tasoitus ja maalaus", "price": 15.0, "unit": "m²", "category": "Katto"},
    {"id": "prod-8", "name": "AK huoltomaalaus", "price": 5.0, "unit": "m²", "category": "Katto"},
    {"id": "prod-9", "name": "Katto verkotus, tasoitus ja maalaus", "price": 18.0, "unit": "m²", "category": "Katto"},
    
    # Lattia (€/m²)
    {"id": "prod-10", "name": "Pölysidonta", "price": 2.5, "unit": "m²", "category": "Lattia"},
    {"id": "prod-11", "name": "Lattiamaalaus/lakkaus", "price": 8.0, "unit": "m²", "category": "Lattia"},
    {"id": "prod-12", "name": "Lattiapinnoitus", "price": 20.0, "unit": "m²", "category": "Lattia"},
    
    # Rakennus (€/m²)
    {"id": "prod-13", "name": "Kipsiseinä rakennus", "price": 18.0, "unit": "m²", "category": "Rakennus"},
    {"id": "prod-14", "name": "Alakatto rakennus", "price": 20.0, "unit": "m²", "category": "Rakennus"},
    
    # Kotelot (€/jm)
    {"id": "prod-15", "name": "Kotelo rakennus", "price": 25.0, "unit": "jm", "category": "Kotelot"},
    {"id": "prod-16", "name": "Kotelo tasoitus ja maalaus", "price": 18.0, "unit": "jm", "category": "Kotelot"},
    
    # Ovet ja ikkunat (€/kpl)
    {"id": "prod-17", "name": "Oven maalaus yheltä puolelta", "price": 40.0, "unit": "kpl", "category": "Ovet"},
    {"id": "prod-18", "name": "Oven maalaus molemmilta puolelta", "price": 70.0, "unit": "kpl", "category": "Ovet"},
    {"id": "prod-19", "name": "Ikkunan maalaus", "price": 50.0, "unit": "kpl", "category": "Ovet"},
    
    # Pystykotelot (€/kpl)
    {"id": "prod-20", "name": "Pystykotelo rakennus", "price": 50.0, "unit": "kpl", "category": "Pystykotelot"},
    {"id": "prod-21", "name": "Pystykotelot tasoitus ja maalaus", "price": 35.0, "unit": "kpl", "category": "Pystykotelot"},
]

# Default hourly target rate
DEFAULT_HOURLY_TARGET = 18.0

@api_router.get("/presets/tes-prices")
async def get_tes_prices():
    """Get TES prices from MongoDB or return defaults. Productivity is calculated client-side."""
    database = await get_database()
    
    # Get saved TES prices or defaults
    saved_prices = []
    hourly_target = DEFAULT_HOURLY_TARGET
    
    if database is not None:
        try:
            doc = await database.presets.find_one({"type": "tes_prices"}, {"_id": 0})
            if doc and "data" in doc:
                saved_prices = doc["data"]
                hourly_target = doc.get("hourlyTarget", DEFAULT_HOURLY_TARGET)
        except Exception as e:
            logger.error(f"Failed to load TES prices: {e}")
    
    if not saved_prices:
        saved_prices = [p.copy() for p in DEFAULT_TES_PRICES]
    
    # Get tool presets to find custom presets
    custom_prices = []
    if database is not None:
        try:
            tool_presets_doc = await database.presets.find_one({"type": "tools"}, {"_id": 0})
            if tool_presets_doc and "data" in tool_presets_doc:
                tool_presets = tool_presets_doc["data"]
                
                existing_names = {p["name"].lower() for p in saved_prices}
                
                for tool_type, tool_data in DEFAULT_TOOL_PRESETS.items():
                    for group in tool_data.get("groups", []):
                        for item in group.get("items", []):
                            existing_names.add(item.get("name", "").lower())
                
                for tool_type, tool_data in tool_presets.items():
                    groups = tool_data.get("groups", [])
                    for group in groups:
                        items = group.get("items", [])
                        for item in items:
                            name = item.get("name", "") or item.get("label", "")
                            unit = item.get("unit", "m²")
                            price = item.get("price", 10.0)
                            
                            if not name or name.lower() in existing_names:
                                continue
                            
                            custom_prices.append({
                                "id": f"custom-{len(custom_prices) + 1}",
                                "name": name,
                                "price": price,
                                "unit": unit,
                                "category": "Custom"
                            })
                            existing_names.add(name.lower())
        except Exception as e:
            logger.error(f"Failed to load tool presets for merging: {e}")
    
    all_prices = saved_prices + custom_prices
    
    return {"prices": all_prices, "hourlyTarget": hourly_target}


@api_router.put("/presets/tes-prices")
async def save_tes_prices(body: dict):
    """Save TES prices to MongoDB"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        prices_data = body.get("prices", [])
        hourly_target = body.get("hourlyTarget", DEFAULT_HOURLY_TARGET)
        await database.presets.update_one(
            {"type": "tes_prices"},
            {"$set": {
                "type": "tes_prices", 
                "data": prices_data, 
                "hourlyTarget": hourly_target,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save TES prices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/presets/tes-prices/add-custom")
async def add_custom_tes_price(body: dict):
    """Add a custom work item to TES prices if it doesn't exist"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        name = body.get("name", "").strip()
        unit = body.get("unit", "m²")
        
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        
        # Get current TES prices
        tes_data = await get_tes_prices()
        prices = tes_data.get("prices", [])
        hourly_target = tes_data.get("hourlyTarget", DEFAULT_HOURLY_TARGET)
        
        # Check if item already exists (case-insensitive)
        name_lower = name.lower()
        existing = next((p for p in prices if p.get("name", "").lower() == name_lower), None)
        
        if existing:
            # Already exists, no need to add
            return {"success": True, "added": False, "message": "Item already exists"}
        
        # Add new custom item with price = 0 (user needs to set it)
        new_item = {
            "id": f"custom-{len(prices) + 1}-{name_lower.replace(' ', '-')}",
            "name": name,
            "unit": unit,
            "price": 0.0,  # Default to 0, user should update
            "category": "Custom"
        }
        prices.append(new_item)
        
        # Save updated prices
        await database.presets.update_one(
            {"type": "tes_prices"},
            {"$set": {
                "type": "tes_prices", 
                "data": prices, 
                "hourlyTarget": hourly_target,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        logger.info(f"Added custom TES price: {name} ({unit})")
        return {"success": True, "added": True, "item": new_item}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add custom TES price: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Keep old endpoint for backward compatibility but redirect to new logic
@api_router.get("/presets/productivity")
async def get_productivity_rates():
    """Get productivity rates calculated from TES prices"""
    # Get TES prices
    tes_response = await get_tes_prices()
    prices = tes_response["prices"]
    hourly_target = tes_response["hourlyTarget"]
    
    # Calculate productivity rates from prices
    rates = []
    for p in prices:
        price = p.get("price", 10.0)
        if price <= 0:
            price = 1.0  # Prevent division by zero
        
        unit = p.get("unit", "m²")
        rate = hourly_target / price  # e.g., 20€/h ÷ 4€/m² = 5 m²/h
        
        rates.append({
            "id": p["id"],
            "name": p["name"],
            "price": price,
            "rate": round(rate, 2),
            "unit": f"{unit}/h",
            "category": p.get("category", "Muut")
        })
    
    return {"rates": rates, "hourlyTarget": hourly_target}


@api_router.put("/presets/productivity")
async def save_productivity_rates(body: dict):
    """Save productivity rates to MongoDB"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    try:
        rates_data = body.get("rates", [])
        await database.presets.update_one(
            {"type": "productivity"},
            {"$set": {"type": "productivity", "data": rates_data, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save productivity rates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
