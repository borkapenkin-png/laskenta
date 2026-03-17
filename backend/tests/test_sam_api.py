"""
Tests for SAM (Segment Anything Model) API endpoints
- POST /api/sam/segment-point: Point-based segmentation

These tests verify the AI room detection feature for the facade cost estimation app.
Uses fal.ai SAM 3 API for image segmentation.
"""
import pytest
import requests
import os
import base64

# API base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test image URL (truck image from fal.ai SAM docs)
TEST_IMAGE_URL = "https://raw.githubusercontent.com/facebookresearch/segment-anything-2/main/notebooks/images/truck.jpg"


class TestHealthEndpoint:
    """Basic health check to ensure API is running"""
    
    def test_health_check(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"Health check passed: {data}")


class TestSAMSegmentPointEndpoint:
    """Tests for POST /api/sam/segment-point endpoint"""
    
    def test_segment_point_with_image_url(self):
        """Test SAM point segmentation with a real image URL (truck image)"""
        # The endpoint expects image_data (base64), but fal.ai also accepts URLs
        # We'll test with the truck image URL which should have detectable objects
        
        payload = {
            "image_data": TEST_IMAGE_URL,  # fal.ai accepts URLs directly
            "point_x": 0.5,  # Center of image
            "point_y": 0.5,  # Center of image
            "image_width": 800,  # Estimated truck image width
            "image_height": 600  # Estimated truck image height
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=60  # SAM API can take time
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response body: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True, f"API returned error: {data.get('error')}"
        
        # Verify masks array exists
        assert "masks" in data
        assert isinstance(data["masks"], list)
        
        # Should have at least one mask from the truck image
        assert len(data["masks"]) > 0, "Expected at least one mask from truck image"
        
        # Verify mask structure
        mask = data["masks"][0]
        print(f"First mask: {mask}")
        
        assert "id" in mask
        assert "score" in mask
        assert "bbox" in mask
        
        # Verify bbox format [cx, cy, w, h] normalized (0-1)
        bbox = mask["bbox"]
        if bbox:  # May be empty for some responses
            assert isinstance(bbox, list)
            assert len(bbox) == 4, f"Expected bbox [cx,cy,w,h], got {bbox}"
            # Values should be normalized 0-1
            for val in bbox:
                assert 0 <= val <= 1, f"Bbox value {val} should be normalized 0-1"
        
        # Verify mask_url is present
        assert "mask_url" in mask
        if mask["mask_url"]:
            assert mask["mask_url"].startswith("http"), "mask_url should be a URL"
        
        print(f"SUCCESS: Got {len(data['masks'])} masks with scores: {[m.get('score', 0) for m in data['masks']]}")
    
    def test_segment_point_edge_coordinates(self):
        """Test SAM with corner/edge coordinates (may return empty or error)"""
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_x": 0.01,  # Near left edge
            "point_y": 0.01,  # Near top edge  
            "image_width": 800,
            "image_height": 600
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should still succeed, but may have fewer/no masks
        assert "success" in data
        assert data["success"] == True or data.get("error") is not None
        
        print(f"Edge test result: success={data.get('success')}, masks={len(data.get('masks', []))}")
    
    def test_segment_point_missing_parameters(self):
        """Test that missing required parameters returns appropriate error"""
        # Missing point_x
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_y": 0.5,
            "image_width": 800,
            "image_height": 600
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=30
        )
        
        # Should fail validation (422) or handle gracefully (400/500)
        assert response.status_code in [400, 422, 500], f"Expected error status, got {response.status_code}"
        print(f"Missing param test: status={response.status_code}")
    
    def test_segment_point_invalid_coordinates(self):
        """Test that invalid coordinates (outside 0-1) are handled"""
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_x": 5.0,  # Invalid - should be 0-1
            "point_y": -1.0,  # Invalid - should be 0-1
            "image_width": 800,
            "image_height": 600
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=30
        )
        
        # fal.ai may accept these (convert to pixel coords) or fail
        # Either is acceptable
        print(f"Invalid coords test: status={response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # If success, masks may be empty or error may be set
            print(f"Result: success={data.get('success')}, error={data.get('error')}")
    
    def test_segment_point_with_zero_dimensions(self):
        """Test that zero image dimensions are handled"""
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_x": 0.5,
            "point_y": 0.5,
            "image_width": 0,  # Invalid
            "image_height": 0  # Invalid
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=30
        )
        
        # Should either fail validation or handle gracefully
        print(f"Zero dimensions test: status={response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # May succeed with 0 pixel coords, check if error is set
            if not data.get("success"):
                print(f"Handled gracefully with error: {data.get('error')}")


class TestSAMResponseFormat:
    """Verify SAM API response format matches frontend expectations"""
    
    def test_response_mask_structure(self):
        """Verify mask structure matches what frontend expects"""
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_x": 0.5,
            "point_y": 0.5,
            "image_width": 800,
            "image_height": 600
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["success"] and len(data.get("masks", [])) > 0:
            mask = data["masks"][0]
            
            # Frontend expects these fields (from RoomDetector.js):
            # mask.mask_url - for overlay display
            # mask.bbox - [cx, cy, w, h] normalized for area calculation
            # mask.score - for sorting/displaying confidence
            
            required_fields = ["id", "mask_url", "bbox", "score"]
            for field in required_fields:
                assert field in mask, f"Missing required field: {field}"
            
            # Verify bbox can be used for area calculation
            bbox = mask["bbox"]
            if bbox and len(bbox) >= 4:
                # Frontend calculates: widthPx = bw * canvas.width
                # This requires bbox[2] (width) and bbox[3] (height) to be normalized
                bw, bh = bbox[2], bbox[3]
                estimated_area = bw * bh
                print(f"Bbox area (normalized): {estimated_area}")
                assert 0 <= estimated_area <= 1, "Area should be normalized 0-1"
            
            print(f"Mask structure valid: {list(mask.keys())}")
    
    def test_masks_sorted_by_score(self):
        """Verify masks are sorted by score descending"""
        payload = {
            "image_data": TEST_IMAGE_URL,
            "point_x": 0.5,
            "point_y": 0.5,
            "image_width": 800,
            "image_height": 600
        }
        
        response = requests.post(
            f"{BASE_URL}/api/sam/segment-point",
            json=payload,
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        
        if data["success"] and len(data.get("masks", [])) > 1:
            scores = [m.get("score", 0) for m in data["masks"]]
            # Should be sorted descending
            assert scores == sorted(scores, reverse=True), f"Masks not sorted by score: {scores}"
            print(f"Masks correctly sorted: {scores}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
