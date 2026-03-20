from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import base64
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure Resend
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

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


# ==================== EMAIL ENDPOINTS ====================

class EmailWithAttachmentRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    body_text: str
    pdf_base64: str
    pdf_filename: str
    sender_name: Optional[str] = None  # Yhteyshenkilö name


class UrakkatyomaaraysRequest(BaseModel):
    recipient_emails: List[EmailStr]  # Multiple workers
    kohde_nimi: str
    kohde_osoite: str
    tyonjohtaja: str
    tyonjohtaja_puh: str = "+358 40 054 7270"
    pdf_base64: str
    pdf_filename: str


@api_router.post("/send-tarjous-email")
async def send_tarjous_email(request: EmailWithAttachmentRequest):
    """Send tarjous email with PDF attachment via Resend"""
    
    if not resend.api_key:
        raise HTTPException(status_code=503, detail="Email service not configured. Please set RESEND_API_KEY.")
    
    try:
        # Decode base64 PDF
        pdf_content = base64.b64decode(request.pdf_base64)
        
        # Sender name for signature
        sender_signature = f"<strong>{request.sender_name}</strong><br>" if request.sender_name else ""
        
        # Build premium HTML email (similar to PDF export style)
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.7; color: #333; background-color: #f5f5f5; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header with teal accent -->
        <div style="background-color: #4A9BAD; padding: 24px 32px;">
            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">
                J&B Tasoitus ja Maalaus Oy
            </h1>
        </div>
        
        <!-- Body Content -->
        <div style="padding: 32px;">
            <div style="font-size: 15px; color: #333; white-space: pre-line; margin-bottom: 32px;">
{request.body_text}
            </div>
            
            <!-- Signature -->
            <div style="border-top: 1px solid #e0e0e0; padding-top: 24px; margin-top: 24px;">
                <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">Ystävällisin terveisin,</p>
                <div style="font-size: 14px; color: #333;">
                    {sender_signature}
                    <span style="color: #4A9BAD; font-weight: 600;">J&B Tasoitus ja Maalaus Oy</span><br>
                    <span style="color: #666;">Sienitie 25, Helsinki</span><br>
                    <span style="color: #666;">Y-tunnus: 2869245-9</span><br>
                    <a href="mailto:info@jbtasoitusmaalaus.fi" style="color: #4A9BAD; text-decoration: none;">info@jbtasoitusmaalaus.fi</a>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 16px 32px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #888; text-align: center;">
                <a href="https://www.jbtasoitusmaalaus.fi" style="color: #4A9BAD; text-decoration: none;">www.jbtasoitusmaalaus.fi</a>
            </p>
        </div>
        
    </div>
</body>
</html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [request.recipient_email],
            "subject": request.subject,
            "html": html_content,
            "attachments": [
                {
                    "filename": request.pdf_filename,
                    "content": list(pdf_content)  # Resend expects list of bytes
                }
            ]
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Email sent successfully to {request.recipient_email}, ID: {email_result.get('id')}")
        
        return {
            "status": "success",
            "message": f"Sähköposti lähetetty: {request.recipient_email}",
            "email_id": email_result.get("id")
        }
        
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Sähköpostin lähetys epäonnistui: {str(e)}")


@api_router.post("/send-urakkatyomaarays")
async def send_urakkatyomaarays(request: UrakkatyomaaraysRequest):
    """Send urakkamääräys email to workers with PDF attachment via Resend"""
    
    if not resend.api_key:
        raise HTTPException(status_code=503, detail="Email service not configured. Please set RESEND_API_KEY.")
    
    try:
        # Decode base64 PDF
        pdf_content = base64.b64decode(request.pdf_base64)
        
        # Format the list of all recipients for visibility
        all_recipients = ", ".join(request.recipient_emails)
        
        # Create mailto link for confirmation
        confirm_subject = f"Urakkamääräys vastaanotettu: {request.kohde_nimi}"
        confirm_body = f"""Urakkamääräys vastaanotettu

Kohde: {request.kohde_nimi}
Osoite: {request.kohde_osoite}

Vahvistan vastaanottaneeni urakkamääräyksen ja siihen liittyvän työmääräerittelyn.

Sitoudun suorittamaan työn urakkamääräyksen ehtojen, työturvallisuusmääräysten ja hyvän rakennustavan mukaisesti.

Allekirjoitus: ____________________
Päivämäärä: ____________________"""
        
        mailto_link = f"mailto:info@jbtasoitusmaalaus.fi?subject={confirm_subject.replace(' ', '%20')}&body={confirm_body.replace(chr(10), '%0A').replace(' ', '%20')}"
        
        # Build the formal HTML email
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0;">
    <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background-color: #2c3e50; padding: 24px 32px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600; letter-spacing: 1px;">
                URAKKAMÄÄRÄYS
            </h1>
            <p style="margin: 8px 0 0 0; color: #bdc3c7; font-size: 13px;">
                Liite työsopimukseen
            </p>
        </div>
        
        <!-- Employer Info -->
        <div style="padding: 24px 32px; background-color: #ecf0f1;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #2c3e50;">TYÖNANTAJA:</p>
            <p style="margin: 0; color: #555;">J&B Tasoitus ja Maalaus Oy</p>
            <p style="margin: 0; color: #555;">Sienitie 25, 00760 Helsinki</p>
            <p style="margin: 0; color: #555;">Y-tunnus: 2869245-9</p>
        </div>
        
        <!-- Work Site Info -->
        <div style="padding: 24px 32px; border-bottom: 1px solid #e0e0e0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; vertical-align: top; width: 140px; color: #888; font-size: 13px;">TYÖKOHDE:</td>
                    <td style="padding: 8px 0; font-weight: 600; color: #2c3e50;">{request.kohde_nimi}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; vertical-align: top; color: #888; font-size: 13px;">OSOITE:</td>
                    <td style="padding: 8px 0; color: #333;">{request.kohde_osoite}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; vertical-align: top; color: #888; font-size: 13px;">TYÖNJOHTAJA:</td>
                    <td style="padding: 8px 0; color: #333;">{request.tyonjohtaja}<br><span style="color: #666;">Puh: {request.tyonjohtaja_puh}</span></td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; vertical-align: top; color: #888; font-size: 13px;">LÄHETETTY:</td>
                    <td style="padding: 8px 0; color: #666; font-size: 13px;">{all_recipients}</td>
                </tr>
            </table>
        </div>
        
        <!-- Assignment Description -->
        <div style="padding: 24px 32px;">
            <h2 style="margin: 0 0 16px 0; color: #2c3e50; font-size: 16px; border-bottom: 2px solid #3498db; padding-bottom: 8px;">
                URAKKAMÄÄRÄYS
            </h2>
            <p style="margin: 0 0 16px 0; color: #333; line-height: 1.7;">
                Tällä urakkamääräyksellä osoitetaan työntekijälle suoritettavaksi liitteenä olevassa työmääräerittelyssä kuvatut työt.
            </p>
            <p style="margin: 0 0 8px 0; color: #555; font-weight: 600;">Työmääräerittely sisältää:</p>
            <ul style="margin: 0 0 16px 0; padding-left: 24px; color: #555;">
                <li>Suoritettavat työvaiheet</li>
                <li>Työmäärät ja yksiköt</li>
                <li>Maalausalan TES:n mukaiset tuntiarviot</li>
            </ul>
        </div>
        
        <!-- Terms Section -->
        <div style="padding: 24px 32px; background-color: #fafafa;">
            <h2 style="margin: 0 0 16px 0; color: #2c3e50; font-size: 16px; border-bottom: 2px solid #e74c3c; padding-bottom: 8px;">
                EHDOT
            </h2>
            
            <h3 style="margin: 16px 0 8px 0; color: #2c3e50; font-size: 14px;">URAKKAPALKKAUS:</h3>
            <ol style="margin: 0 0 16px 0; padding-left: 24px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Työ suoritetaan urakkapalkalla maalausalan työehtosopimuksen (TES) mukaisesti.</li>
                <li>Urakkahinnoittelu perustuu TES:n mukaisiin yksikköhintoihin ja työmääräerittelyssä esitettyihin työmääriin.</li>
            </ol>
            
            <h3 style="margin: 16px 0 8px 0; color: #2c3e50; font-size: 14px;">TYÖTURVALLISUUS:</h3>
            <ol start="3" style="margin: 0 0 16px 0; padding-left: 24px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Työntekijä sitoutuu noudattamaan työturvallisuuslakia (738/2002) ja työnantajan antamia turvallisuusohjeita.</li>
                <li>Työnantaja vastaa työturvallisuuslain mukaisista velvoitteista ja tarjoaa tarvittavat henkilönsuojaimet.</li>
                <li>Työntekijä on velvollinen käyttämään annettuja suojavarusteita ja ilmoittamaan havaitsemistaan vaaroista välittömästi.</li>
                <li>Työntekijällä on oikeus keskeyttää työ, jos siitä aiheutuu välitön ja vakava vaara hengelle tai terveydelle.</li>
            </ol>
            
            <h3 style="margin: 16px 0 8px 0; color: #2c3e50; font-size: 14px;">TYÖN SUORITUS:</h3>
            <ol start="7" style="margin: 0 0 16px 0; padding-left: 24px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Työ suoritetaan ammattitaitoisesti, hyvää rakennustapaa ja MaalausRYL 2012 -ohjeistusta noudattaen.</li>
                <li>Mahdollisista lisätöistä ja muutoksista sovitaan kirjallisesti ennen niiden suorittamista.</li>
                <li>Työntekijä ilmoittaa työnjohtajalle välittömästi mahdollisista esteistä, viivästyksistä tai laatupoikkeamista.</li>
            </ol>
            
            <h3 style="margin: 16px 0 8px 0; color: #2c3e50; font-size: 14px;">VAKUUTUKSET JA VASTUU:</h3>
            <ol start="10" style="margin: 0 0 16px 0; padding-left: 24px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Työnantaja vastaa lakisääteisistä vakuutuksista (tapaturmavakuutus, työeläkevakuutus, työttömyysvakuutus).</li>
                <li>Työntekijä vastaa tahallisesti tai törkeällä huolimattomuudella aiheuttamistaan vahingoista työsopimuslain (55/2001) mukaisesti.</li>
            </ol>
            
            <h3 style="margin: 16px 0 8px 0; color: #2c3e50; font-size: 14px;">TIETOSUOJA JA SALASSAPITO:</h3>
            <ol start="12" style="margin: 0 0 16px 0; padding-left: 24px; color: #555; font-size: 14px; line-height: 1.8;">
                <li>Työntekijä sitoutuu pitämään salassa työnantajan ja asiakkaiden luottamukselliset tiedot.</li>
            </ol>
        </div>
        
        <!-- Legal Note -->
        <div style="padding: 16px 32px; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; color: #666; font-size: 13px; font-style: italic;">
                Tämä urakkamääräys on osa voimassa olevaa työsopimusta.<br>
                Sovellettava työehtosopimus: Maalausalan TES
            </p>
        </div>
        
        <!-- Attachment Note -->
        <div style="padding: 16px 32px; background-color: #e8f4f8;">
            <p style="margin: 0; color: #2c3e50; font-weight: 600;">
                📎 Liite: Työmääräerittely (PDF)
            </p>
        </div>
        
        <!-- Confirmation Button -->
        <div style="padding: 32px; text-align: center; background-color: #2c3e50;">
            <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px;">
                Klikkaamalla vahvistat saaneesi urakkamääräyksen ja sitoutuvasi noudattamaan yllä mainittuja ehtoja.
            </p>
            <a href="{mailto_link}" style="display: inline-block; background-color: #27ae60; color: #ffffff; padding: 14px 32px; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 4px;">
                KUITTAA VASTAANOTETUKSI
            </a>
        </div>
        
        <!-- Footer -->
        <div style="padding: 16px 32px; background-color: #1a252f; text-align: center;">
            <p style="margin: 0; color: #888; font-size: 12px;">
                J&B Tasoitus ja Maalaus Oy | <a href="https://www.jbtasoitusmaalaus.fi" style="color: #3498db; text-decoration: none;">www.jbtasoitusmaalaus.fi</a>
            </p>
        </div>
        
    </div>
</body>
</html>
        """
        
        # Send to all recipients (they can see each other via 'to' list)
        params = {
            "from": SENDER_EMAIL,
            "to": request.recipient_emails,  # All recipients visible to each other
            "subject": f"Urakkamääräys: {request.kohde_nimi}",
            "html": html_content,
            "attachments": [
                {
                    "filename": request.pdf_filename,
                    "content": list(pdf_content)
                }
            ]
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        
        logger.info(f"Urakkamääräys sent to {all_recipients}, ID: {email_result.get('id')}")
        
        return {
            "status": "success",
            "message": f"Urakkamääräys lähetetty: {all_recipients}",
            "email_id": email_result.get("id"),
            "recipients": request.recipient_emails
        }
        
    except Exception as e:
        logger.error(f"Failed to send urakkamääräys: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Urakkamääräyksen lähetys epäonnistui: {str(e)}")


# ==================== OFFER TERMS ENDPOINTS ====================

# Default offer terms (Finnish construction industry standard)
DEFAULT_OFFER_TERMS = [
    "Tarjous perustuu kohteesta saatuihin tietoihin, piirustuksiin sekä urakoitsijan tekemiin havaintoihin tarjouksen laadintahetkellä.",
    "Urakkahinta sisältää sovitut maalaus- ja tasoitustyöt tarjouksen mukaisessa laajuudessa. Mahdolliset lisä- ja muutostyöt toteutetaan tilaajan erillisellä hyväksynnällä ja laskutetaan erikseen sovituin perustein.",
    "Urakkaan sisältyy normaalit työnaikaiset suojaukset ja siisteys. Erityissuojaukset, työskentely käytössä olevissa tiloissa, ilta- tai viikonlopputyöt hinnoitellaan erikseen.",
    "Tilaaja vastaa työalueen esteettömyydestä sekä sähkön ja veden saatavuudesta sovitusti.",
    "Työn vastaanotto ja laadunarviointi suoritetaan MaalausRYL 2012 -julkaisun mukaisten periaatteiden ja tarkasteluetäisyyksien mukaisesti. Pintojen laatua arvioidaan normaalissa valaistuksessa ja normaalilta katseluetäisyydeltä.",
    "Urakoitsija myöntää työlle kahden (2) vuoden takuun vastaanotosta lukien YSE 1998 -ehtojen periaatteiden mukaisesti, ellei toisin sovita.",
    "Takuu kattaa työn suorituksessa ilmenevät virheet, jotka johtuvat urakoitsijan työvirheestä, virheellisestä työmenetelmästä tai materiaalin virheellisestä käsittelystä.",
    "Takuu ei kata:\\n– rakenteellisesta liikkeestä, rakennuksen painumisesta tai alustan elämisestä johtuvia halkeamia\\n– kosteusrasituksesta tai rakenteellisista puutteista aiheutuvia vaurioita\\n– normaalia kulumista tai mekaanisia vaurioita\\n– tilaajan tai kolmannen osapuolen aiheuttamia vaurioita\\n– alustan piileviä virheitä, joita ei ole voitu kohtuudella havaita ennen työn aloittamista",
    "Maksuehto sovitun mukaisesti. Viivästyskorko korkolain mukaisesti.",
    "Tarjous on voimassa valitun ajan päiväyksestä.",
    "Mahdolliset erimielisyydet pyritään ratkaisemaan ensisijaisesti neuvottelemalla."
]


@api_router.get("/presets/offer-terms")
async def get_offer_terms():
    """Get offer terms from MongoDB or return defaults"""
    database = await get_database()
    if database is None:
        return {"terms": DEFAULT_OFFER_TERMS}
    
    try:
        doc = await database.presets.find_one({"type": "offer_terms"}, {"_id": 0})
        if doc and "data" in doc:
            return {"terms": doc["data"]}
        return {"terms": DEFAULT_OFFER_TERMS}
    except Exception as e:
        logger.error(f"Failed to get offer terms: {e}")
        return {"terms": DEFAULT_OFFER_TERMS}


@api_router.put("/presets/offer-terms")
async def save_offer_terms(body: dict):
    """Save offer terms to MongoDB"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        terms = body.get("terms", DEFAULT_OFFER_TERMS)
        await database.presets.update_one(
            {"type": "offer_terms"},
            {"$set": {
                "type": "offer_terms",
                "data": terms,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to save offer terms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/presets/offer-terms/reset")
async def reset_offer_terms():
    """Reset offer terms to defaults"""
    database = await get_database()
    if database is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        await database.presets.update_one(
            {"type": "offer_terms"},
            {"$set": {
                "type": "offer_terms",
                "data": DEFAULT_OFFER_TERMS,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"success": True, "terms": DEFAULT_OFFER_TERMS}
    except Exception as e:
        logger.error(f"Failed to reset offer terms: {e}")
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
