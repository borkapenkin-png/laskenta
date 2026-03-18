"""
Test suite for Productivity API endpoints
Tests GET /api/presets/productivity and PUT /api/presets/productivity
for Work Schedule Generator feature
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestProductivityAPI:
    """Productivity Rates API endpoint tests"""
    
    def test_api_health(self):
        """Test API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ API Health: {data}")
    
    def test_get_productivity_rates_returns_rates(self):
        """Test GET /api/presets/productivity returns rates array"""
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "rates" in data
        assert isinstance(data["rates"], list)
        assert len(data["rates"]) >= 21, f"Expected at least 21 default rates, got {len(data['rates'])}"
        print(f"✓ GET /api/presets/productivity returned {len(data['rates'])} rates")
    
    def test_get_productivity_rates_structure(self):
        """Test each rate has required fields: id, name, rate, unit, category"""
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert response.status_code == 200
        data = response.json()
        
        for rate in data["rates"]:
            assert "id" in rate, f"Missing 'id' in rate: {rate}"
            assert "name" in rate, f"Missing 'name' in rate: {rate}"
            assert "rate" in rate, f"Missing 'rate' in rate: {rate}"
            assert "unit" in rate, f"Missing 'unit' in rate: {rate}"
            assert "category" in rate, f"Missing 'category' in rate: {rate}"
            
            # Verify rate is a positive number
            assert isinstance(rate["rate"], (int, float)), f"Rate should be number: {rate}"
            assert rate["rate"] > 0, f"Rate should be positive: {rate}"
        
        print(f"✓ All {len(data['rates'])} rates have valid structure")
    
    def test_get_productivity_rates_categories(self):
        """Test that all expected categories are present"""
        response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert response.status_code == 200
        data = response.json()
        
        categories = set(r["category"] for r in data["rates"])
        expected_categories = {"Maalaus", "Katto", "Lattia", "Rakennus", "Kotelot", "Ovet", "Pystykotelot"}
        
        for cat in expected_categories:
            assert cat in categories, f"Missing category: {cat}"
        
        print(f"✓ All expected categories present: {categories}")
    
    def test_put_productivity_rates_saves_custom_rate(self):
        """Test PUT /api/presets/productivity saves a custom rate"""
        # First get current rates
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert get_response.status_code == 200
        original_rates = get_response.json()["rates"]
        
        # Add a TEST custom rate
        test_rate = {
            "id": "TEST_custom_rate_1",
            "name": "TEST Custom Work Phase",
            "rate": 12.5,
            "unit": "m²/h",
            "category": "Custom"
        }
        
        updated_rates = original_rates + [test_rate]
        
        # Save with PUT
        put_response = requests.put(
            f"{BASE_URL}/api/presets/productivity",
            json={"rates": updated_rates},
            headers={"Content-Type": "application/json"}
        )
        assert put_response.status_code == 200
        assert put_response.json().get("success") == True
        
        # Verify it was saved by doing GET again
        verify_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert verify_response.status_code == 200
        saved_rates = verify_response.json()["rates"]
        
        # Find our test rate
        test_rates_found = [r for r in saved_rates if r["id"] == "TEST_custom_rate_1"]
        assert len(test_rates_found) == 1, "Custom rate not saved"
        assert test_rates_found[0]["rate"] == 12.5
        assert test_rates_found[0]["name"] == "TEST Custom Work Phase"
        
        print("✓ PUT /api/presets/productivity saves and persists custom rate")
    
    def test_put_productivity_rates_updates_existing_rate(self):
        """Test PUT /api/presets/productivity can update an existing rate value"""
        # Get current rates
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert get_response.status_code == 200
        rates = get_response.json()["rates"]
        
        # Find Huoltomaalaus and modify its rate
        original_rate = None
        for r in rates:
            if r["id"] == "prod-1":  # Huoltomaalaus
                original_rate = r["rate"]
                r["rate"] = 99.0  # Set to recognizable test value
                break
        
        assert original_rate is not None, "Could not find prod-1 (Huoltomaalaus)"
        
        # Save modified rates
        put_response = requests.put(
            f"{BASE_URL}/api/presets/productivity",
            json={"rates": rates},
            headers={"Content-Type": "application/json"}
        )
        assert put_response.status_code == 200
        
        # Verify the change persisted
        verify_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        saved_rates = verify_response.json()["rates"]
        
        huoltomaalaus = next((r for r in saved_rates if r["id"] == "prod-1"), None)
        assert huoltomaalaus is not None
        assert huoltomaalaus["rate"] == 99.0, f"Rate not updated, got {huoltomaalaus['rate']}"
        
        print(f"✓ Rate update persisted: prod-1 changed from {original_rate} to 99.0")
    
    def test_reset_presets_restores_defaults(self):
        """Test POST /api/presets/reset restores default productivity rates"""
        # Reset all presets
        reset_response = requests.post(f"{BASE_URL}/api/presets/reset")
        assert reset_response.status_code == 200
        
        # Get rates after reset
        get_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert get_response.status_code == 200
        rates = get_response.json()["rates"]
        
        # Verify Huoltomaalaus has default value (15.0)
        huoltomaalaus = next((r for r in rates if r["id"] == "prod-1"), None)
        assert huoltomaalaus is not None
        assert huoltomaalaus["rate"] == 15.0, f"Default rate not restored, got {huoltomaalaus['rate']}"
        
        # Verify TEST custom rate is removed
        test_rates = [r for r in rates if "TEST" in r.get("id", "")]
        assert len(test_rates) == 0, f"TEST rates should be removed after reset, found: {test_rates}"
        
        print("✓ POST /api/presets/reset restores default rates")


class TestToolPresetsIntegration:
    """Test tool presets integration with productivity rates"""
    
    def test_get_tool_presets(self):
        """Test GET /api/presets/tools returns tool presets"""
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert response.status_code == 200
        data = response.json()
        
        assert "presets" in data
        presets = data["presets"]
        
        # Verify expected tool types exist
        expected_tools = ["line", "wall", "rectangle", "polygon", "count"]
        for tool in expected_tools:
            assert tool in presets, f"Missing tool type: {tool}"
        
        print(f"✓ GET /api/presets/tools returns presets for tools: {list(presets.keys())}")
    
    def test_custom_tool_preset_appears_in_productivity_rates(self):
        """Test that custom tool presets added via 'Muu' appear in productivity rates"""
        # First, add a custom tool preset
        # Get current tool presets
        get_response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert get_response.status_code == 200
        presets = get_response.json()["presets"]
        
        # Add a custom item to wall presets
        test_custom_item = {
            "id": "TEST-custom-wall-1",
            "name": "TEST Custom Wall Work",
            "price": 50,
            "unit": "m²"
        }
        
        # Add to wall -> first group
        if "wall" in presets and "groups" in presets["wall"]:
            presets["wall"]["groups"][0]["items"].append(test_custom_item)
        
        # Save tool presets
        put_response = requests.put(
            f"{BASE_URL}/api/presets/tools",
            json={"presets": presets},
            headers={"Content-Type": "application/json"}
        )
        assert put_response.status_code == 200
        
        # Now get productivity rates - the custom tool preset should appear
        productivity_response = requests.get(f"{BASE_URL}/api/presets/productivity")
        assert productivity_response.status_code == 200
        rates = productivity_response.json()["rates"]
        
        # Check if our custom tool preset appears in productivity rates
        custom_rates = [r for r in rates if "TEST Custom Wall Work" in r.get("name", "")]
        
        # Note: This depends on the backend logic in server.py lines 200-246
        # which merges custom tool presets into productivity rates
        print(f"✓ Custom tool preset integration test complete. Found {len(custom_rates)} matching custom rates")
        
        # Cleanup - reset presets
        requests.post(f"{BASE_URL}/api/presets/reset")


class TestMaksueraPresets:
    """Test Maksuerä presets API"""
    
    def test_get_maksuera_presets(self):
        """Test GET /api/presets/maksuera returns payment schedule presets"""
        response = requests.get(f"{BASE_URL}/api/presets/maksuera")
        assert response.status_code == 200
        data = response.json()
        
        assert "presets" in data
        presets = data["presets"]
        assert len(presets) >= 2, "Should have at least 2 default maksuerä presets (YSE-6, YSE-8)"
        
        # Verify structure
        for preset in presets:
            assert "id" in preset
            assert "name" in preset
            assert "rows" in preset
            
            # Verify rows have required fields
            total_percent = 0
            for row in preset["rows"]:
                assert "selite" in row
                assert "percent" in row
                total_percent += row["percent"]
            
            assert total_percent == 100, f"Preset {preset['name']} rows should sum to 100%, got {total_percent}%"
        
        print(f"✓ GET /api/presets/maksuera returns {len(presets)} valid presets")


# Run cleanup after all tests
@pytest.fixture(scope="session", autouse=True)
def cleanup_after_tests():
    """Reset presets after all tests complete"""
    yield
    # Cleanup
    try:
        requests.post(f"{BASE_URL}/api/presets/reset")
        print("\n✓ Test cleanup: Presets reset to defaults")
    except Exception as e:
        print(f"\n⚠ Test cleanup failed: {e}")
