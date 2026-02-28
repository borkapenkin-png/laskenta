export const calculateDistance = (p1, p2) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const calculatePolygonArea = (points) => {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area / 2);
};

export const calculatePolylineLength = (points) => {
  if (points.length < 2) return 0;
  
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    length += calculateDistance(points[i], points[i + 1]);
  }
  return length;
};

export const pixelsToMeters = (pixels, scale) => {
  if (!scale || scale.pixelsPerMeter === 0) return 0;
  return pixels / scale.pixelsPerMeter;
};

export const metersToPixels = (meters, scale) => {
  if (!scale || scale.pixelsPerMeter === 0) return 0;
  return meters * scale.pixelsPerMeter;
};

export const snapToAngle = (p1, p2, angleStep = 45) => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const snappedAngle = Math.round(angle / angleStep) * angleStep;
  const distance = calculateDistance(p1, p2);
  const radians = snappedAngle * Math.PI / 180;
  
  return {
    x: p1.x + distance * Math.cos(radians),
    y: p1.y + distance * Math.sin(radians)
  };
};

export const snapToPoint = (point, points, threshold = 10) => {
  for (const p of points) {
    if (calculateDistance(point, p) < threshold) {
      return p;
    }
  }
  return point;
};