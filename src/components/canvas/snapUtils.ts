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

// 调整大小时的吸附边界类型
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface ResizeSnapResult {
  snappedBounds: { x: number; y: number; width: number; height: number };
  guides: GuideLine[];
}

// 根据调整方向获取需要吸附的边
const getActiveEdges = (direction: ResizeEdge): { horizontal: ('top' | 'bottom')[]; vertical: ('left' | 'right')[] } => {
  const horizontal: ('top' | 'bottom')[] = [];
  const vertical: ('left' | 'right')[] = [];
  
  if (direction.includes('n')) horizontal.push('top');
  if (direction.includes('s')) horizontal.push('bottom');
  if (direction.includes('w')) vertical.push('left');
  if (direction.includes('e')) vertical.push('right');
  
  return { horizontal, vertical };
};

// 计算调整大小时的吸附
export const calculateResizeSnap = (
  resizingElements: CanvasElement[],
  allElements: CanvasElement[],
  newBounds: { x: number; y: number; width: number; height: number },
  direction: ResizeEdge,
  threshold: number = 5
): ResizeSnapResult => {
  const resizingIds = new Set(resizingElements.map(el => el.id));
  const otherElements = allElements.filter(el => !resizingIds.has(el.id));

  if (otherElements.length === 0) {
    return { snappedBounds: newBounds, guides: [] };
  }

  // 收集所有静态元素的吸附线
  const staticLines: SnapLine[] = [];
  otherElements.forEach(el => {
    staticLines.push(...getSnapLines(el));
  });

  const activeEdges = getActiveEdges(direction);
  const snappedBounds = { ...newBounds };
  const guides: GuideLine[] = [];

  // 处理垂直方向的吸附（左右边）
  activeEdges.vertical.forEach(edge => {
    const edgeValue = edge === 'left' ? newBounds.x : newBounds.x + newBounds.width;
    
    for (const line of staticLines) {
      if (line.type === 'vertical') {
        const dist = Math.abs(edgeValue - line.value);
        if (dist <= threshold) {
          if (edge === 'left') {
            const deltaX = line.value - newBounds.x;
            snappedBounds.x = line.value;
            snappedBounds.width = newBounds.width - deltaX;
          } else {
            snappedBounds.width = line.value - snappedBounds.x;
          }
          
          // 添加辅助线
          const startY = Math.min(line.start, newBounds.y);
          const endY = Math.max(line.end, newBounds.y + newBounds.height);
          guides.push({
            type: 'vertical',
            coor: line.value,
            x: line.value,
            y: startY,
            length: endY - startY,
            start: startY
          });
          break; // 找到第一个吸附线就停止
        }
      }
    }
  });

  // 处理水平方向的吸附（上下边）
  activeEdges.horizontal.forEach(edge => {
    const edgeValue = edge === 'top' ? newBounds.y : newBounds.y + newBounds.height;
    
    for (const line of staticLines) {
      if (line.type === 'horizontal') {
        const dist = Math.abs(edgeValue - line.value);
        if (dist <= threshold) {
          if (edge === 'top') {
            const deltaY = line.value - newBounds.y;
            snappedBounds.y = line.value;
            snappedBounds.height = newBounds.height - deltaY;
          } else {
            snappedBounds.height = line.value - snappedBounds.y;
          }
          
          // 添加辅助线
          const startX = Math.min(line.start, snappedBounds.x);
          const endX = Math.max(line.end, snappedBounds.x + snappedBounds.width);
          guides.push({
            type: 'horizontal',
            coor: line.value,
            y: line.value,
            x: startX,
            length: endX - startX,
            start: startX
          });
          break; // 找到第一个吸附线就停止
        }
      }
    }
  });

  // 去重辅助线
  const uniqueGuides: GuideLine[] = [];
  const seen = new Set<string>();
  
  guides.forEach(g => {
    const key = `${g.type}-${g.coor}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGuides.push(g);
    }
  });

  return {
    snappedBounds,
    guides: uniqueGuides
  };
};
