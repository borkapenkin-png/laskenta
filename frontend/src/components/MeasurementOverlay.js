import React, { useRef, useEffect, useState } from 'react';
import { calculateDistance, calculatePolygonArea, pixelsToMeters, snapToAngle } from '@/utils/geometry';

export const MeasurementOverlay = ({ 
  canvasSize,
  currentTool,
  scale,
  onMeasurementComplete,
  measurements = []
}) => {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') setSnapEnabled(true);
      if (e.key === 'Escape') setPoints([]);
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
  }, [points]);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    measurements.forEach(m => {
      if (m.points && m.points.length > 0) {
        drawMeasurement(ctx, m);
      }
    });

    if (points.length > 0) {
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

      points.forEach((point, i) => {
        ctx.fillStyle = '#0052CC';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }
  }, [points, mousePos, measurements, currentTool, snapEnabled]);

  const drawMeasurement = (ctx, measurement) => {
    if (!measurement.points || measurement.points.length === 0) return;

    ctx.strokeStyle = measurement.color || '#0052CC';
    ctx.lineWidth = 2;
    ctx.fillStyle = measurement.fillColor || 'rgba(0, 82, 204, 0.1)';

    ctx.beginPath();
    ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
    
    for (let i = 1; i < measurement.points.length; i++) {
      ctx.lineTo(measurement.points[i].x, measurement.points[i].y);
    }

    if (measurement.type === 'polygon' || measurement.type === 'rectangle') {
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.stroke();

    if (measurement.points.length > 0) {
      const centerX = measurement.points.reduce((sum, p) => sum + p.x, 0) / measurement.points.length;
      const centerY = measurement.points.reduce((sum, p) => sum + p.y, 0) / measurement.points.length;
      
      let label = '';
      if (measurement.quantity) {
        label = `${measurement.quantity.toFixed(2)} ${measurement.unit}`;
      }
      
      if (label) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#0052CC';
        ctx.lineWidth = 1;
        const padding = 4;
        const textWidth = ctx.measureText(label).width;
        
        ctx.fillRect(centerX - textWidth/2 - padding, centerY - 10, textWidth + padding * 2, 20);
        ctx.strokeRect(centerX - textWidth/2 - padding, centerY - 10, textWidth + padding * 2, 20);
        
        ctx.fillStyle = '#0052CC';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, centerX, centerY);
      }
    }
  };

  // Use pointer events for better touch/mouse compatibility
  const getCanvasCoordinates = (event) => {
    if (!canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Map screen coordinates to canvas coordinates
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    // Debug logging
    console.log('Pointer event detected:', { x, y, clientX: event.clientX, clientY: event.clientY });
    
    return { x, y };
  };

  const handlePointerDown = (e) => {
    if (!currentTool || !scale) return;
    
    e.target.setPointerCapture(e.pointerId);
    
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    let point = coords;

    if (snapEnabled && points.length > 0) {
      point = snapToAngle(points[points.length - 1], point, 45);
    }

    if (currentTool === 'line') {
      if (points.length === 0) {
        setPoints([point]);
      } else {
        const distance = calculateDistance(points[0], point);
        const meters = pixelsToMeters(distance, scale);
        onMeasurementComplete({
          type: 'line',
          points: [points[0], point],
          quantity: meters,
          unit: 'jm'
        });
        setPoints([]);
      }
    } else if (currentTool === 'rectangle') {
      if (points.length === 0) {
        setPoints([point]);
      } else {
        const width = Math.abs(point.x - points[0].x);
        const height = Math.abs(point.y - points[0].y);
        const area = width * height;
        const metersSquared = pixelsToMeters(Math.sqrt(area), scale) ** 2;
        
        const rectPoints = [
          points[0],
          { x: point.x, y: points[0].y },
          point,
          { x: points[0].x, y: point.y }
        ];
        
        onMeasurementComplete({
          type: 'rectangle',
          points: rectPoints,
          quantity: metersSquared,
          unit: 'm²'
        });
        setPoints([]);
      }
    } else if (currentTool === 'polygon') {
      setPoints(prev => [...prev, point]);
    } else if (currentTool === 'wall') {
      if (points.length === 0) {
        setPoints([point]);
      } else {
        const distance = calculateDistance(points[0], point);
        const meters = pixelsToMeters(distance, scale);
        onMeasurementComplete({
          type: 'wall',
          points: [points[0], point],
          quantity: meters,
          unit: 'jm'
        });
        setPoints([]);
      }
    } else if (currentTool === 'count') {
      onMeasurementComplete({
        type: 'count',
        points: [point],
        quantity: 1,
        unit: 'kpl'
      });
    }
  };

  const handleDoubleClick = () => {
    if (currentTool === 'polygon' && points.length >= 3) {
      const area = calculatePolygonArea(points);
      const metersSquared = pixelsToMeters(Math.sqrt(area), scale) ** 2;
      
      onMeasurementComplete({
        type: 'polygon',
        points: [...points],
        quantity: metersSquared,
        unit: 'm²'
      });
      setPoints([]);
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
