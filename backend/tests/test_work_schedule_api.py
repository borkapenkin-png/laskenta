"""
Test Work Schedule Generator API - productivity rates endpoints
Tests for GET /api/presets/productivity and PUT /api/presets/productivity
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestProductivityAPI:
    """Test productivity rates API endpoints for Work Schedule Generator"""
    
    def test_api_health(self):
        """Verify API is healthy and MongoDB is connected"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"API healthy, database: {data['database']}")
    
    def test_get_productivity_rates_returns_defaults(self):
        """GET /api/presets/productivity should return default rates when none saved"""
        # Reset to defaults first
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert response.status_code == 200
        
        data = response.json()
        assert "rates" in data
        assert isinstance(data["rates"], list)
        assert len(data["rates"]) == 21  # 21 default productivity rates
        
        # Verify structure of first rate
        first_rate = data["rates"][0]
        assert "id" in first_rate
        assert "name" in first_rate
        assert "rate" in first_rate
        assert "unit" in first_rate
        assert "category" in first_rate
        
        print(f"Got {len(data['rates'])} default productivity rates")
        print(f"First rate: {first_rate['name']} - {first_rate['rate']} {first_rate['unit']}")
    
    def test_get_productivity_rates_has_correct_default_values(self):
        """Verify default productivity rates match 'maalaus TES' standards"""
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        data = response.json()
        rates = data["rates"]
        
        # Check specific default values
        rates_by_name = {r["name"]: r for r in rates}
        
        # Verify key productivity rates from maalaus TES
        assert rates_by_name["Huoltomaalaus"]["rate"] == 15.0
        assert rates_by_name["Huoltomaalaus"]["unit"] == "m²/h"
        assert rates_by_name["Huoltomaalaus"]["category"] == "Maalaus"
        
        assert rates_by_name["Kipsiseinä tasoitus ja maalaus"]["rate"] == 8.0
        assert rates_by_name["Pölysidonta"]["rate"] == 40.0
        assert rates_by_name["Lattiapinnoitus"]["rate"] == 4.0
        
        print("Default productivity rates match maalaus TES standards")
    
    def test_get_productivity_rates_all_categories(self):
        """Verify all categories are present in default rates"""
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        data = response.json()
        rates = data["rates"]
        
        categories = set(r["category"] for r in rates)
        expected_categories = {"Maalaus", "Katto", "Lattia", "Rakennus", "Kotelot", "Ovet", "Pystykotelot"}
        
        assert expected_categories == categories
        print(f"All categories present: {categories}")
    
    def test_put_productivity_rates_saves_custom_rates(self):
        """PUT /api/presets/productivity should save custom rates to MongoDB"""
        custom_rates = [
            {"id": "test-1", "name": "TEST Custom Rate", "rate": 99.0, "unit": "m²/h", "category": "Test"},
            {"id": "test-2", "name": "TEST Another Rate", "rate": 50.0, "unit": "jm/h", "category": "Test"}
        ]
        
        response = requests.put(
            f"{BASE_URL}/api/presets/productivity",
            json={"rates": custom_rates},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify saved
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        data = get_response.json()
        assert len(data["rates"]) == 2
        assert data["rates"][0]["name"] == "TEST Custom Rate"
        assert data["rates"][0]["rate"] == 99.0
        
        print("Custom productivity rates saved and retrieved successfully")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/presets/reset")
    
    def test_put_productivity_rates_updates_single_rate(self):
        """PUT should update individual rate values"""
        # Get current defaults
        requests.post(f"{BASE_URL}/api/presets/reset")
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        rates = response.json()["rates"]
        
        # Modify one rate
        rates[0]["rate"] = 20.0  # Changed from 15.0
        
        # Save
        response = requests.put(
            f"{BASE_URL}/api/presets/productivity",
            json={"rates": rates}
        )
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        updated_rates = get_response.json()["rates"]
        assert updated_rates[0]["rate"] == 20.0
        
        print("Single rate updated successfully")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/presets/reset")
    
    def test_reset_restores_default_productivity_rates(self):
        """POST /api/presets/reset should restore default productivity rates"""
        # First, save custom rates
        custom_rates = [{"id": "test-x", "name": "TEMP Rate", "rate": 1.0, "unit": "x/h", "category": "Temp"}]
        requests.put(f"{BASE_URL}/api/presets/productivity", json={"rates": custom_rates})
        
        # Verify custom saved
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert len(response.json()["rates"]) == 1
        
        # Reset
        reset_response = requests.post(f"{BASE_URL}/api/presets/reset")
        assert reset_response.status_code == 200
        
        # Verify defaults restored
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        data = response.json()
        assert len(data["rates"]) == 21
        assert data["rates"][0]["name"] == "Huoltomaalaus"
        
        print("Reset successfully restored default productivity rates")
    
    def test_productivity_rates_decimal_handling(self):
        """Verify decimal rate values are handled correctly"""
        custom_rates = [
            {"id": "test-dec", "name": "TEST Decimal Rate", "rate": 3.75, "unit": "m²/h", "category": "Test"}
        ]
        
        response = requests.put(f"{BASE_URL}/api/presets/productivity", json={"rates": custom_rates})
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        data = get_response.json()
        assert data["rates"][0]["rate"] == 3.75
        
        print("Decimal rate values handled correctly")
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/presets/reset")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
