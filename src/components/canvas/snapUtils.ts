import type { CanvasElement } from "../../types/canvas";

export interface GuideLine {
  type: 'horizontal' | 'vertical';
  coor: number;
  x: number;
  y: number;
  length: number; // For drawing the line segment
  start: number; // Start coordinate (y for vertical, x for horizontal)
}

interface SnapResult {
  dx: number;
  dy: number;
  guides: GuideLine[];
}

interface SnapLine {
  type: 'horizontal' | 'vertical';
  value: number;
  start: number;
  end: number;
}

interface SnapPoint {
  x: number;
  y: number;
}

// Helper to get lines from a static element
const getSnapLines = (element: CanvasElement): SnapLine[] => {
  const lines: SnapLine[] = [];
  const { x, y, width, height } = element;

  if (element.type === 'shape' && element.shape === 'rectangle') {
    // Horizontal
    lines.push({ type: 'horizontal', value: y, start: x, end: x + width }); // Top
    lines.push({ type: 'horizontal', value: y + height / 2, start: x, end: x + width }); // Middle
    lines.push({ type: 'horizontal', value: y + height, start: x, end: x + width }); // Bottom
    // Vertical
    lines.push({ type: 'vertical', value: x, start: y, end: y + height }); // Left
    lines.push({ type: 'vertical', value: x + width / 2, start: y, end: y + height }); // Center
    lines.push({ type: 'vertical', value: x + width, start: y, end: y + height }); // Right
  } else if (element.type === 'shape' && element.shape === 'triangle') {
     // Vertices: (x+w/2, y), (x+w, y+h), (x, y+h)
     const v1 = { x: x + width / 2, y: y };
     const v2 = { x: x + width, y: y + height };
     const v3 = { x: x, y: y + height };
     const vertices = [v1, v2, v3];

     vertices.forEach(v => {
       // For a vertex, the "line" is technically infinite or just the point.
       // We use the element bounds for the "visual" length of the source line.
       lines.push({ type: 'horizontal', value: v.y, start: x, end: x + width });
       lines.push({ type: 'vertical', value: v.x, start: y, end: y + height });
     });
  } else {
    // Default bounding box logic for other shapes
    lines.push({ type: 'horizontal', value: y, start: x, end: x + width });
    lines.push({ type: 'horizontal', value: y + height / 2, start: x, end: x + width });
    lines.push({ type: 'horizontal', value: y + height, start: x, end: x + width });
    lines.push({ type: 'vertical', value: x, start: y, end: y + height });
    lines.push({ type: 'vertical', value: x + width / 2, start: y, end: y + height });
    lines.push({ type: 'vertical', value: x + width, start: y, end: y + height });
  }
  return lines;
};

// Helper to get points from a moving element
const getSnapPoints = (element: CanvasElement): SnapPoint[] => {
  const points: SnapPoint[] = [];
  const { x, y, width, height } = element;

  if (element.type === 'shape' && element.shape === 'rectangle') {
    // Corners
    points.push({ x, y });
    points.push({ x: x + width, y });
    points.push({ x, y: y + height });
    points.push({ x: x + width, y: y + height });
    // Center
    points.push({ x: x + width / 2, y: y + height / 2 });
  } else if (element.type === 'shape' && element.shape === 'triangle') {
     points.push({ x: x + width / 2, y });
     points.push({ x: x + width, y: y + height });
     points.push({ x, y: y + height });
  } else {
    // Default to center and corners for unknown shapes
    points.push({ x, y });
    points.push({ x: x + width, y });
    points.push({ x, y: y + height });
    points.push({ x: x + width, y: y + height });
    points.push({ x: x + width / 2, y: y + height / 2 });
  }
  return points;
};

export const calculateSnap = (
  movingElements: CanvasElement[],
  allElements: CanvasElement[],
  originalDx: number,
  originalDy: number,
  startSnapshot: Record<string, CanvasElement>,
  threshold: number = 5
): SnapResult => {
  const movingIds = new Set(movingElements.map(el => el.id));
  const otherElements = allElements.filter(el => !movingIds.has(el.id));

  if (otherElements.length === 0) {
    return { dx: originalDx, dy: originalDy, guides: [] };
  }

  // 1. Collect all static lines
  const staticLines: SnapLine[] = [];
  otherElements.forEach(el => {
    staticLines.push(...getSnapLines(el));
  });

  // 2. Collect all moving points (relative to their original position)
  // We need to know the original position to apply originalDx/Dy
  // But getSnapPoints uses current element properties.
  // We should use the snapshot to get the "base" points.
  const movingPoints: { point: SnapPoint, baseElement: CanvasElement }[] = [];
  
  movingElements.forEach(el => {
    const base = startSnapshot[el.id] ?? el;
    const points = getSnapPoints(base);
    points.forEach(p => {
      movingPoints.push({ point: p, baseElement: base });
    });
  });

  let snapDx = 0;
  let snapDy = 0;
  let minDistX = threshold + 1;
  let minDistY = threshold + 1;

  // 3. Find closest snap
  // We check each moving point against each static line
  
  for (const { point } of movingPoints) {
    const currentX = point.x + originalDx;
    const currentY = point.y + originalDy;

    for (const line of staticLines) {
      if (line.type === 'vertical') {
        const dist = Math.abs(currentX - line.value);
        if (dist < minDistX) {
          minDistX = dist;
          snapDx = line.value - point.x - originalDx; // correction
        }
      } else {
        const dist = Math.abs(currentY - line.value);
        if (dist < minDistY) {
          minDistY = dist;
          snapDy = line.value - point.y - originalDy; // correction
        }
      }
    }
  }

  // If no snap found within threshold, reset correction
  if (minDistX > threshold) snapDx = 0;
  if (minDistY > threshold) snapDy = 0;

  const finalDx = originalDx + snapDx;
  const finalDy = originalDy + snapDy;

  // 4. Generate guides for the final position
  const guides: GuideLine[] = [];
  
  // We iterate again to find all lines that match the final position within threshold
  // The user said "draw auxiliary lines that are less than 10 units away".
  // We interpret this as: The gap between the moving point and the static element's edge (projected) must be < 10.
  
  // Use the threshold for guide visibility as well, to ensure consistency
  const guideThreshold = threshold;

  for (const { point } of movingPoints) {
    const currentX = point.x + finalDx;
    const currentY = point.y + finalDy;

    for (const line of staticLines) {
      if (line.type === 'vertical') {
        // Check alignment
        if (Math.abs(currentX - line.value) <= guideThreshold) { 
           const startY = Math.min(line.start, currentY);
           const endY = Math.max(line.end, currentY);
           guides.push({
             type: 'vertical',
             coor: line.value,
             x: line.value,
             y: startY,
             length: endY - startY,
             start: startY
           });
        }
      } else {
        // Check alignment
        if (Math.abs(currentY - line.value) <= guideThreshold) {
           const startX = Math.min(line.start, currentX);
           const endX = Math.max(line.end, currentX);
           guides.push({
             type: 'horizontal',
             coor: line.value,
             y: line.value,
             x: startX,
             length: endX - startX,
             start: startX
           });
        }
      }
    }
  }

  // Deduplicate guides?
  // Simple deduplication based on coordinates
  const uniqueGuides: GuideLine[] = [];
  const seen = new Set<string>();
  
  guides.forEach(g => {
    const key = `${g.type}-${g.x}-${g.y}-${g.length}-${g.start}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGuides.push(g);
    }
  });

  return {
    dx: finalDx,
    dy: finalDy,
    guides: uniqueGuides
  };
};
