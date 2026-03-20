"""
Backend tests for Preset CRUD API endpoints
Tests for tool presets and maksuerä presets with MongoDB persistence
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://tarjous-build.preview.emergentagent.com').rstrip('/')


class TestHealthCheck:
    """Health check tests - run first to verify API is accessible"""
    
    def test_api_health(self):
        """Verify API is healthy and MongoDB is connected"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print(f"✓ API Health: {data}")


class TestToolPresetsAPI:
    """Tests for GET /api/presets/tools and PUT /api/presets/tools"""
    
    def test_get_tool_presets_returns_defaults(self):
        """GET /api/presets/tools should return default presets when none saved"""
        # First reset to ensure clean state
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert response.status_code == 200
        
        data = response.json()
        assert "presets" in data
        
        presets = data["presets"]
        # Check all tool types exist
        assert "line" in presets
        assert "wall" in presets
        assert "rectangle" in presets
        assert "polygon" in presets
        assert "count" in presets
        
        # Check structure of line presets
        assert "groups" in presets["line"]
        groups = presets["line"]["groups"]
        assert len(groups) >= 2  # Should have at least Kotelot and Seinä groups
        
        # Check first group has items with correct structure
        first_group = groups[0]
        assert "name" in first_group
        assert "items" in first_group
        
        if first_group["items"]:
            first_item = first_group["items"][0]
            assert "id" in first_item
            assert "name" in first_item
            assert "price" in first_item
            assert "unit" in first_item
        
        print(f"✓ Tool presets have {len(presets)} tool types with correct structure")
    
    def test_put_tool_presets_saves_to_mongodb(self):
        """PUT /api/presets/tools should save presets to MongoDB"""
        # Create custom preset data
        custom_presets = {
            "line": {
                "groups": [
                    {
                        "name": "TEST Custom Group",
                        "items": [
                            {"id": "TEST-custom-1", "name": "TEST Custom Item", "price": 99.99, "unit": "jm"}
                        ]
                    }
                ]
            },
            "wall": {"groups": []},
            "rectangle": {"groups": []},
            "polygon": {"groups": []},
            "count": {"groups": []}
        }
        
        # Save custom presets
        response = requests.put(
            f"{BASE_URL}/api/presets/tools",
            json={"presets": custom_presets}
        )
        assert response.status_code == 200
        assert response.json().get("success") == True
        
        # Verify persistence by fetching
        get_response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert get_response.status_code == 200
        
        saved_presets = get_response.json()["presets"]
        assert "line" in saved_presets
        assert saved_presets["line"]["groups"][0]["name"] == "TEST Custom Group"
        assert saved_presets["line"]["groups"][0]["items"][0]["name"] == "TEST Custom Item"
        assert saved_presets["line"]["groups"][0]["items"][0]["price"] == 99.99
        
        print("✓ Tool presets saved and retrieved correctly from MongoDB")
    
    def test_tool_preset_with_construction_type(self):
        """Verify presets with constructionType and hasOptions are handled correctly"""
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert response.status_code == 200
        
        presets = response.json()["presets"]
        
        # Reset first to get defaults
        requests.post(f"{BASE_URL}/api/presets/reset")
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        presets = response.json()["presets"]
        
        # Check for constructionType items in count presets
        count_groups = presets.get("count", {}).get("groups", [])
        
        construction_items = []
        for group in count_groups:
            for item in group.get("items", []):
                if item.get("constructionType"):
                    construction_items.append(item)
        
        # Should have construction type items
        assert len(construction_items) > 0, "Expected to find items with constructionType"
        
        # Verify structure
        for item in construction_items:
            assert "hasOptions" in item
            assert item["hasOptions"] == True
        
        print(f"✓ Found {len(construction_items)} items with constructionType")


class TestMaksueraPresetsAPI:
    """Tests for GET /api/presets/maksuera and PUT /api/presets/maksuera"""
    
    def test_get_maksuera_presets_returns_defaults(self):
        """GET /api/presets/maksuera should return default maksuerä presets"""
        # Reset to ensure clean state
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/maksuera")
        assert response.status_code == 200
        
        data = response.json()
        assert "presets" in data
        
        presets = data["presets"]
        assert isinstance(presets, list)
        assert len(presets) >= 2  # Should have at least YSE-6 and YSE-8
        
        # Check structure of first preset
        first_preset = presets[0]
        assert "id" in first_preset
        assert "name" in first_preset
        assert "rows" in first_preset
        
        # Check rows structure
        rows = first_preset["rows"]
        assert len(rows) >= 4  # Should have multiple rows
        
        for row in rows:
            assert "selite" in row
            assert "percent" in row
        
        # Verify percentages sum to 100
        total_percent = sum(row["percent"] for row in rows)
        assert total_percent == 100, f"Expected 100%, got {total_percent}%"
        
        print(f"✓ Maksuerä presets have {len(presets)} presets with correct structure")
    
    def test_put_maksuera_presets_saves_to_mongodb(self):
        """PUT /api/presets/maksuera should save maksuerä presets to MongoDB"""
        # Create custom maksuerä preset
        custom_presets = [
            {
                "id": "TEST-custom-maksuera",
                "name": "TEST Custom Maksuerä",
                "rows": [
                    {"selite": "Aloitus", "percent": 20},
                    {"selite": "Keski vaihe", "percent": 60},
                    {"selite": "Luovutus", "percent": 20}
                ]
            }
        ]
        
        # Save custom presets
        response = requests.put(
            f"{BASE_URL}/api/presets/maksuera",
            json={"presets": custom_presets}
        )
        assert response.status_code == 200
        assert response.json().get("success") == True
        
        # Verify persistence by fetching
        get_response = requests.get(f"{BASE_URL}/api/presets/maksuera")
        assert get_response.status_code == 200
        
        saved_presets = get_response.json()["presets"]
        assert len(saved_presets) == 1
        assert saved_presets[0]["id"] == "TEST-custom-maksuera"
        assert saved_presets[0]["name"] == "TEST Custom Maksuerä"
        assert len(saved_presets[0]["rows"]) == 3
        
        print("✓ Maksuerä presets saved and retrieved correctly from MongoDB")


class TestResetPresetsAPI:
    """Tests for POST /api/presets/reset"""
    
    def test_reset_presets_clears_custom_and_returns_defaults(self):
        """POST /api/presets/reset should delete custom presets and return defaults"""
        # First save some custom presets
        custom_tool_presets = {
            "line": {"groups": [{"name": "ToBeDeleted", "items": []}]},
            "wall": {"groups": []},
            "rectangle": {"groups": []},
            "polygon": {"groups": []},
            "count": {"groups": []}
        }
        requests.put(f"{BASE_URL}/api/presets/tools", json={"presets": custom_tool_presets})
        
        custom_maksuera = [{"id": "to-delete", "name": "ToBeDeleted", "rows": []}]
        requests.put(f"{BASE_URL}/api/presets/maksuera", json={"presets": custom_maksuera})
        
        # Reset presets
        response = requests.post(f"{BASE_URL}/api/presets/reset")
        assert response.status_code == 200
        
        data = response.json()
        assert "presets_tools" in data
        assert "presets_maksuera" in data
        
        # Verify tool presets are defaults (not "ToBeDeleted")
        tool_presets = data["presets_tools"]
        assert "line" in tool_presets
        line_groups = tool_presets["line"]["groups"]
        assert line_groups[0]["name"] != "ToBeDeleted"
        assert line_groups[0]["name"] == "Kotelot"  # Default first group
        
        # Verify maksuerä presets are defaults
        maksuera_presets = data["presets_maksuera"]
        assert len(maksuera_presets) >= 2
        assert maksuera_presets[0]["name"] != "ToBeDeleted"
        assert "YSE" in maksuera_presets[0]["name"]  # Should be YSE-6 or similar
        
        print("✓ Reset returned default presets correctly")
    
    def test_reset_presets_persists_defaults(self):
        """After reset, GET should return defaults from backend (not MongoDB)"""
        # Reset
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        # Get tool presets - should be defaults
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        assert response.status_code == 200
        
        presets = response.json()["presets"]
        # Verify it has all default tool types with content
        assert len(presets["line"]["groups"]) >= 2
        assert len(presets["wall"]["groups"]) >= 1
        assert len(presets["rectangle"]["groups"]) >= 3
        assert len(presets["polygon"]["groups"]) >= 3
        assert len(presets["count"]["groups"]) >= 2
        
        print("✓ After reset, GET returns default presets")


class TestPresetDataIntegrity:
    """Tests for preset data structure and edge cases"""
    
    def test_preset_price_types(self):
        """Verify preset prices are numeric and can handle decimals"""
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        response = requests.get(f"{BASE_URL}/api/presets/tools")
        presets = response.json()["presets"]
        
        # Check rectangle presets for Pölysidonta (should have decimal price 2.5)
        rect_groups = presets["rectangle"]["groups"]
        decimal_price_found = False
        
        for group in rect_groups:
            for item in group["items"]:
                if item["price"] == 2.5:
                    decimal_price_found = True
                    print(f"  Found decimal price: {item['name']} = {item['price']} €/{item['unit']}")
        
        assert decimal_price_found, "Expected to find Pölysidonta with price 2.5"
        print("✓ Decimal prices handled correctly")
    
    def test_empty_preset_save_and_load(self):
        """Verify empty presets can be saved and loaded"""
        empty_presets = {
            "line": {"groups": []},
            "wall": {"groups": []},
            "rectangle": {"groups": []},
            "polygon": {"groups": []},
            "count": {"groups": []}
        }
        
        response = requests.put(
            f"{BASE_URL}/api/presets/tools",
            json={"presets": empty_presets}
        )
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/presets/tools")
        saved = get_response.json()["presets"]
        
        # All should have empty groups
        for tool_type in ["line", "wall", "rectangle", "polygon", "count"]:
            assert tool_type in saved
            assert len(saved[tool_type]["groups"]) == 0
        
        # Cleanup - reset to defaults
        requests.post(f"{BASE_URL}/api/presets/reset")
        
        print("✓ Empty presets save/load works correctly")


# Run tests with pytest
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
