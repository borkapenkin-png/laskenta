// Hit testing utilities for measurement selection

export const pointToLineDistance = (point, lineStart, lineEnd) => {
  const { x, y } = point;
  const { x: x1, y: y1 } = lineStart;
  const { x: x2, y: y2 } = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const pointInPolygon = (point, polygon) => {
  const { x, y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

export const pointToPolygonEdgeDistance = (point, polygon) => {
  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const distance = pointToLineDistance(point, start, end);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
};

export const hitTestMeasurement = (point, measurement, threshold = 10) => {
  if (!measurement.points || measurement.points.length === 0) {
    return false;
  }

  switch (measurement.type) {
    case 'line':
    case 'wall':
      if (measurement.points.length >= 2) {
        const distance = pointToLineDistance(
          point,
          measurement.points[0],
          measurement.points[1]
        );
        return distance <= threshold;
      }
      return false;

    case 'rectangle':
    case 'polygon':
      // Check if inside polygon OR close to edge
      const isInside = pointInPolygon(point, measurement.points);
      const edgeDistance = pointToPolygonEdgeDistance(point, measurement.points);
      return isInside || edgeDistance <= threshold;

    case 'count':
      if (measurement.points.length > 0) {
        const dx = point.x - measurement.points[0].x;
        const dy = point.y - measurement.points[0].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= threshold * 2; // Larger hit area for points
      }
      return false;

    default:
      return false;
  }
};
