"""
Test suite for TarjousDialog email functionality
Tests the /api/send-tarjous-email endpoint for sending offers via Resend API
"""
import pytest
import requests
import os
import base64

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Minimal valid PDF for testing (base64 encoded)
MINIMAL_PDF_BASE64 = "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDw8Pj4KL0NvbnRlbnRzIDQgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9MZW5ndGggMTUKPj4Kc3RyZWFtCkJUIEVUIApRCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjM2IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNQovUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKMzAyCiUlRU9G"


class TestHealthEndpoint:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test that API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"API health check passed: {data}")


class TestSendTarjousEmail:
    """Tests for /api/send-tarjous-email endpoint"""
    
    def test_send_email_success(self):
        """Test successful email sending with valid data"""
        payload = {
            "recipient_email": "test@example.com",
            "subject": "Test Tarjous - Pytest",
            "body_text": "Hei,\n\nTämä on testitarjous.\n\nYstävällisin terveisin,\nTest",
            "pdf_base64": MINIMAL_PDF_BASE64,
            "pdf_filename": "test_tarjous.pdf",
            "sender_name": "Test Sender"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "email_id" in data
        assert "test@example.com" in data["message"]
        print(f"Email sent successfully: {data}")
    
    def test_send_email_without_sender_name(self):
        """Test email sending without optional sender_name"""
        payload = {
            "recipient_email": "test2@example.com",
            "subject": "Test Tarjous - No Sender Name",
            "body_text": "Test email without sender name",
            "pdf_base64": MINIMAL_PDF_BASE64,
            "pdf_filename": "test_tarjous_no_sender.pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        print(f"Email without sender name sent: {data}")
    
    def test_send_email_invalid_email_format(self):
        """Test that invalid email format is rejected"""
        payload = {
            "recipient_email": "invalid-email",
            "subject": "Test",
            "body_text": "Test",
            "pdf_base64": MINIMAL_PDF_BASE64,
            "pdf_filename": "test.pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
        print(f"Invalid email rejected as expected: {response.status_code}")
    
    def test_send_email_missing_required_fields(self):
        """Test that missing required fields return error"""
        # Missing pdf_base64
        payload = {
            "recipient_email": "test@example.com",
            "subject": "Test",
            "body_text": "Test",
            "pdf_filename": "test.pdf"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        # Should return 422 for validation error
        assert response.status_code == 422
        print(f"Missing field rejected as expected: {response.status_code}")
    
    def test_send_email_with_finnish_characters(self):
        """Test email with Finnish special characters (ä, ö, å)"""
        payload = {
            "recipient_email": "test@example.com",
            "subject": "Tarjous: Maalaustyöt Hämeenlinnassa",
            "body_text": "Hei,\n\nTarjoamme maalaustyöt kohteeseen Hämeenlinna.\n\nÄlä epäröi ottaa yhteyttä!\n\nYstävällisin terveisin,\nJörgen Åberg",
            "pdf_base64": MINIMAL_PDF_BASE64,
            "pdf_filename": "Tarjous_Hämeenlinna.pdf",
            "sender_name": "Jörgen Åberg"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        print(f"Finnish characters handled correctly: {data}")
    
    def test_send_email_with_long_body(self):
        """Test email with longer body text"""
        long_body = """Hei,

Tarjoamme kohteeseen Test Kohde 123.

Urakan sisältö:
- Seinien maalaus (100 m²)
- Katon maalaus (50 m²)
- Listojen maalaus (30 jm)

Materiaalit: Fescon tasoitteet ja Teknos maalijärjestelmät

Yhteensä (ALV 0%): 1 500,00 €

Tarjous on voimassa 30 päivää.

Vastaamme mielellämme mahdollisiin kysymyksiin.

Ystävällisin terveisin,
Boris Penkin
J&B Tasoitus ja Maalaus Oy"""
        
        payload = {
            "recipient_email": "test@example.com",
            "subject": "Tarjous: Test Kohde 123",
            "body_text": long_body,
            "pdf_base64": MINIMAL_PDF_BASE64,
            "pdf_filename": "Tarjous_Test_Kohde_123.pdf",
            "sender_name": "Boris Penkin"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/send-tarjous-email",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        print(f"Long body email sent: {data}")


class TestOfferTermsEndpoint:
    """Tests for /api/presets/offer-terms endpoint"""
    
    def test_get_offer_terms(self):
        """Test getting offer terms"""
        response = requests.get(f"{BASE_URL}/api/presets/offer-terms")
        
        assert response.status_code == 200
        data = response.json()
        assert "terms" in data
        assert isinstance(data["terms"], list)
        assert len(data["terms"]) > 0
        print(f"Got {len(data['terms'])} offer terms")
    
    def test_offer_terms_content(self):
        """Test that offer terms contain expected Finnish content"""
        response = requests.get(f"{BASE_URL}/api/presets/offer-terms")
        
        assert response.status_code == 200
        data = response.json()
        terms = data["terms"]
        
        # Check that terms contain Finnish construction-related content
        all_terms_text = " ".join(terms)
        assert "tarjous" in all_terms_text.lower() or "urakka" in all_terms_text.lower()
        print("Offer terms contain expected Finnish content")


class TestToolPresetsEndpoint:
    """Tests for /api/presets/tools endpoint"""
    
    def test_get_tool_presets(self):
        """Test getting tool presets"""
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        
        assert response.status_code == 200
        data = response.json()
        assert "presets" in data
        assert isinstance(data["presets"], dict)
        print(f"Got tool presets with {len(data['presets'])} categories")
    
    def test_tool_presets_structure(self):
        """Test that tool presets have expected structure"""
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        
        assert response.status_code == 200
        data = response.json()
        presets = data["presets"]
        
        # Check for expected tool types
        expected_types = ["line", "wall", "rectangle", "polygon", "count"]
        for tool_type in expected_types:
            if tool_type in presets:
                assert "groups" in presets[tool_type]
                print(f"Tool type '{tool_type}' has groups")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
