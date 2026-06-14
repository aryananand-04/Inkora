import { COLOR_PALETTE } from 'shared'

export interface RGBColor {
  r: number
  g: number
  b: number
}

export function indexToRgb(index: number): RGBColor {
  const hex = COLOR_PALETTE[index] ?? '#000000'
  return hexToRgb(hex)
}

export function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

// Bresenham's line algorithm — draws into ImageData directly
export function drawLine(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGBColor,
  width: number,
): void {
  drawLineNoFlush(imageData, x1, y1, x2, y2, color, width)
  ctx.putImageData(imageData, 0, 0)
}

export function drawLineNoFlush(
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RGBColor,
  width: number,
): void {
  const radius = Math.floor(width / 2)
  let dx = Math.abs(x2 - x1)
  let dy = Math.abs(y2 - y1)
  const sx = x1 < x2 ? 1 : -1
  const sy = y1 < y2 ? 1 : -1
  let err = dx - dy

  while (true) {
    drawCircle(imageData, x1, y1, radius, color)

    if (x1 === x2 && y1 === y2) break
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x1 += sx }
    if (e2 < dx) { err += dx; y1 += sy }
  }
}

function drawCircle(
  imageData: ImageData,
  cx: number,
  cy: number,
  radius: number,
  color: RGBColor,
): void {
  const { width, height, data } = imageData
  const r2 = radius * radius

  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) {
        const idx = (y * width + x) * 4
        data[idx] = color.r
        data[idx + 1] = color.g
        data[idx + 2] = color.b
        data[idx + 3] = 255
      }
    }
  }
}

// Scanline flood fill
export function floodFill(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  x: number,
  y: number,
  fillColor: RGBColor,
): boolean {
  const { width, height, data } = imageData
  const xi = Math.round(x)
  const yi = Math.round(y)

  if (xi < 0 || xi >= width || yi < 0 || yi >= height) return false

  const targetIdx = (yi * width + xi) * 4
  const targetR = data[targetIdx]
  const targetG = data[targetIdx + 1]
  const targetB = data[targetIdx + 2]

  // Already the fill color
  if (targetR === fillColor.r && targetG === fillColor.g && targetB === fillColor.b) return false

  const matches = (idx: number) =>
    data[idx] === targetR &&
    data[idx + 1] === targetG &&
    data[idx + 2] === targetB

  const setColor = (idx: number) => {
    data[idx] = fillColor.r
    data[idx + 1] = fillColor.g
    data[idx + 2] = fillColor.b
    data[idx + 3] = 255
  }

  const stack: [number, number][] = [[xi, yi]]
  const visited = new Uint8Array(width * height)

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue
    if (visited[cy * width + cx]) continue

    const idx = (cy * width + cx) * 4
    if (!matches(idx)) continue

    // Scan left
    let left = cx
    while (left > 0 && matches(((cy * width) + left - 1) * 4)) left--

    // Scan right
    let right = cx
    while (right < width - 1 && matches(((cy * width) + right + 1) * 4)) right++

    // Fill row
    for (let i = left; i <= right; i++) {
      const rowIdx = (cy * width + i) * 4
      setColor(rowIdx)
      visited[cy * width + i] = 1

      if (cy > 0 && !visited[(cy - 1) * width + i]) stack.push([i, cy - 1])
      if (cy < height - 1 && !visited[(cy + 1) * width + i]) stack.push([i, cy + 1])
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return true
}

export function clearCanvas(ctx: CanvasRenderingContext2D, imageData: ImageData): void {
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255
    data[i + 1] = 255
    data[i + 2] = 255
    data[i + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
}
