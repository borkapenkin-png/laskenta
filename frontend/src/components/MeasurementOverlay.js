import React, { useRef, useEffect, useState } from 'react';
import { calculateDistance, calculatePolygonArea, pixelsToMeters, snapToAngle } from '@/utils/geometry';
import { hitTestMeasurement } from '@/utils/hitTesting';

export const MeasurementOverlay = ({ 
  canvasSize,
  currentTool,
  scale,
  onMeasurementComplete,
  measurements = [],
  selectedMeasurementId,
  onMeasurementSelect,
  calibrationMode = false,
  onCalibrationComplete
}) => {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false);

  // Get current zoom from canvasSize
  const currentZoom = canvasSize?.zoom || 1;

  // Helper: convert screen coordinates to normalized (zoom=1) coordinates
  const toNormalizedCoords = (screenCoords) => {
    return {
      x: screenCoords.x / currentZoom,
      y: screenCoords.y / currentZoom
    };
  };

  // Helper: convert normalized coordinates to screen (current zoom) coordinates
  const toScreenCoords = (normalizedCoords) => {
    return {
      x: normalizedCoords.x * currentZoom,
      y: normalizedCoords.y * currentZoom
    };
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') setSnapEnabled(true);
      if (e.key === 'Escape') {
        setPoints([]);
        if (onMeasurementSelect) onMeasurementSelect(null);
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && points.length > 0) {
        setPoints(prev => prev.slice(0, -1));
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift') setSnapEnabled(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [points, onMeasurementSelect]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw calibration line if in calibration mode
    if (calibrationMode && calibrationPoints.length > 0) {
      ctx.strokeStyle = '#FF6B00';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      
      ctx.beginPath();
      ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y);
      
      if (calibrationPoints.length === 2) {
        ctx.lineTo(calibrationPoints[1].x, calibrationPoints[1].y);
      } else if (mousePos) {
        ctx.lineTo(mousePos.x, mousePos.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw points
      calibrationPoints.forEach((point) => {
        ctx.fillStyle = '#FF6B00';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      
      // Draw distance label if both points are set
      if (calibrationPoints.length === 2) {
        const midX = (calibrationPoints[0].x + calibrationPoints[1].x) / 2;
        const midY = (calibrationPoints[0].y + calibrationPoints[1].y) / 2;
        const pixelDistance = calculateDistance(calibrationPoints[0], calibrationPoints[1]);
        
        ctx.fillStyle = '#FF6B00';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${pixelDistance.toFixed(0)} px`, midX, midY - 10);
      }
    }

    measurements.forEach(m => {
      if (m.points && m.points.length > 0) {
        const isSelected = m.id === selectedMeasurementId;
        drawMeasurement(ctx, m, isSelected);
      }
    });

    if (points.length > 0 && currentTool && !calibrationMode) {
      ctx.strokeStyle = '#0052CC';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(0, 82, 204, 0.1)';

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      
      if (mousePos && currentTool !== 'count') {
        let targetPos = mousePos;
        if (snapEnabled && points.length > 0) {
          targetPos = snapToAngle(points[points.length - 1], mousePos, 45);
        }
        ctx.lineTo(targetPos.x, targetPos.y);
      }

      if (currentTool === 'polygon' && points.length > 2) {
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.stroke();

      points.forEach((point) => {
        ctx.fillStyle = '#0052CC';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }, [points, mousePos, measurements, currentTool, snapEnabled, selectedMeasurementId, calibrationMode, calibrationPoints]);

  const drawMeasurement = (ctx, measurement, isSelected = false) => {
    if (!measurement.points || measurement.points.length === 0) return;

    // Convert normalized points to screen coordinates
    const screenPoints = measurement.points.map(p => toScreenCoords(p));

    const strokeWidth = isSelected ? 4 : 2;
    const strokeColor = isSelected ? '#FF6B00' : (measurement.color || '#0052CC');
    const fillColor = isSelected ? 'rgba(255, 107, 0, 0.2)' : (measurement.fillColor || 'rgba(0, 82, 204, 0.1)');

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.fillStyle = fillColor;

    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    
    for (let i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }

    if (measurement.type === 'polygon' || measurement.type === 'rectangle') {
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.stroke();

    if (isSelected) {
      screenPoints.forEach((point) => {
        ctx.fillStyle = '#FF6B00';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    if (screenPoints.length > 0) {
      const centerX = screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length;
      const centerY = screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length;
      
      let label = '';
      if (measurement.quantity) {
        label = `${measurement.quantity.toFixed(2)} ${measurement.unit}`;
      }
      
      if (label) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        const padding = 4;
        ctx.font = '12px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillRect(centerX - textWidth/2 - padding, centerY - 10, textWidth + padding * 2, 20);
        ctx.strokeRect(centerX - textWidth/2 - padding, centerY - 10, textWidth + padding * 2, 20);
        
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, centerX, centerY);
      }
    }
  };

  const getCanvasCoordinates = (event) => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    return { x, y };
  };

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    // Handle calibration mode
    if (calibrationMode) {
      if (calibrationPoints.length === 0) {
        setCalibrationPoints([coords]);
      } else if (calibrationPoints.length === 1) {
        const pixelDistance = calculateDistance(calibrationPoints[0], coords);
        setCalibrationPoints([calibrationPoints[0], coords]);
        
        // Complete calibration after a short delay to show the line
        setTimeout(() => {
          if (onCalibrationComplete) {
            onCalibrationComplete(pixelDistance);
          }
          setCalibrationPoints([]);
        }, 500);
      }
      return;
    }

    // Need scale for measurement tools
    if (!scale) return;

    // If no tool selected, try to select a measurement
    if (!currentTool) {
      for (let i = measurements.length - 1; i >= 0; i--) {
        const measurement = measurements[i];
        if (hitTestMeasurement(coords, measurement, 12)) {
          console.log('Selected measurement:', measurement.id);
          if (onMeasurementSelect) {
            onMeasurementSelect(measurement.id);
          }
          return;
        }
      }
      
      if (onMeasurementSelect) {
        onMeasurementSelect(null);
      }
      return;
    }

    let point = coords;

    if (snapEnabled && points.length > 0) {
      point = snapToAngle(points[points.length - 1], point, 45);
    }

    // Normalize point to zoom=1 coordinates for storage
    const normalizedPoint = toNormalizedCoords(point);

    // All tools: single click adds a point
    if (currentTool === 'count') {
      // Count tool: single click completes immediately
      onMeasurementComplete({
        type: 'count',
        points: [normalizedPoint],
        quantity: 1,
        unit: 'kpl'
      });
    } else if (currentTool === 'rectangle') {
      // Rectangle: 2 clicks (corners)
      if (points.length === 0) {
        setPoints([normalizedPoint]);
      }
      // Second click handled in handleDoubleClick or next single click
    } else {
      // Line, wall, polygon: add point on single click
      setPoints(prev => [...prev, normalizedPoint]);
    }
  };

  const handleDoubleClick = (e) => {
    if (!scale || !currentTool) return;
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    let point = coords;
    if (snapEnabled && points.length > 0) {
      // Convert last point back to screen coords for snap calculation
      const lastScreenPoint = toScreenCoords(points[points.length - 1]);
      point = snapToAngle(lastScreenPoint, point, 45);
    }

    // Normalize the final point
    const normalizedPoint = toNormalizedCoords(point);

    // Double click finishes the measurement
    // Points are already in normalized coordinates
    if (currentTool === 'line' || currentTool === 'wall') {
      if (points.length >= 1) {
        // Calculate total length of all segments (in normalized coordinates)
        const allPoints = [...points, normalizedPoint];
        let totalDistance = 0;
        for (let i = 0; i < allPoints.length - 1; i++) {
          totalDistance += calculateDistance(allPoints[i], allPoints[i + 1]);
        }
        const meters = pixelsToMeters(totalDistance, scale);
        
        onMeasurementComplete({
          type: currentTool,
          points: allPoints,
          quantity: meters,
          unit: 'jm'
        });
        setPoints([]);
      }
    } else if (currentTool === 'polygon') {
      if (points.length >= 2) {
        const allPoints = [...points, normalizedPoint];
        const area = calculatePolygonArea(allPoints);
        const metersSquared = pixelsToMeters(Math.sqrt(area), scale) ** 2;
        
        onMeasurementComplete({
          type: 'polygon',
          points: allPoints,
          quantity: metersSquared,
          unit: 'm²'
        });
        setPoints([]);
      }
    } else if (currentTool === 'rectangle') {
      if (points.length === 1) {
        const width = Math.abs(normalizedPoint.x - points[0].x);
        const height = Math.abs(normalizedPoint.y - points[0].y);
        const area = width * height;
        const metersSquared = pixelsToMeters(Math.sqrt(area), scale) ** 2;
        
        const rectPoints = [
          points[0],
          { x: normalizedPoint.x, y: points[0].y },
          normalizedPoint,
          { x: points[0].x, y: normalizedPoint.y }
        ];
        
        onMeasurementComplete({
          type: 'rectangle',
          points: rectPoints,
          quantity: metersSquared,
          unit: 'm²'
        });
        setPoints([]);
      }
    }
  };

  const handlePointerMove = (e) => {
    const coords = getCanvasCoordinates(e);
    if (coords) {
      setMousePos(coords);
    }
  };

  if (!canvasSize) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setMousePos(null)}
      onDoubleClick={handleDoubleClick}
      className="absolute top-0 left-0"
      style={{ 
        pointerEvents: 'auto',
        cursor: currentTool ? 'crosshair' : 'default',
        zIndex: 10,
        touchAction: 'none'
      }}
    />
  );
};
