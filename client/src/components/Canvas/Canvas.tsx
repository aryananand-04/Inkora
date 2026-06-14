import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { useDrawing } from '../../context/DrawingContext'
import { indexToRgb, drawLine, drawLineNoFlush, floodFill, clearCanvas } from './drawing'
import type { DrawEvent, LineEvent, FillEvent } from 'shared'
import { CONSTANTS } from 'shared'

const BASE_W = CONSTANTS.CANVAS_BASE_WIDTH
const BASE_H = CONSTANTS.CANVAS_BASE_HEIGHT

export interface CanvasHandle {
  replayEvents: (events: DrawEvent[]) => void
  clear: () => void
  applyLine: (data: LineEvent) => void
  applyFill: (data: FillEvent) => void
}

interface CanvasProps {
  allowDrawing: boolean
  onLine?: (data: LineEvent) => void
  onFill?: (data: FillEvent) => void
  onClear?: () => void
  onUndo?: () => void
}

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { allowDrawing, onLine, onFill, onClear, onUndo },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const touchIdRef = useRef<number | null>(null)

  const { tool, colorIndex, brushSize, color } = useDrawing()
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Scale screen coordinates → server (base) coordinates
  const toBase = useCallback((val: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return val
    return Math.round(val * (BASE_W / canvas.clientWidth))
  }, [])

  const getCtx = () => {
    const canvas = canvasRef.current
    return canvas ? canvas.getContext('2d', { alpha: false }) : null
  }

  const getImageData = (): ImageData | null => {
    if (!imageDataRef.current) {
      const ctx = getCtx()
      const canvas = canvasRef.current
      if (ctx && canvas) {
        imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }
    }
    return imageDataRef.current
  }

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return

    canvas.width = BASE_W
    canvas.height = BASE_H

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, BASE_W, BASE_H)
    imageDataRef.current = ctx.getImageData(0, 0, BASE_W, BASE_H)
  }, [])

  // Resize observer — canvas CSS scales, internal resolution stays at base
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => {
      // CSS sizing handles scaling; nothing to do for internal resolution
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // Imperative handle for parent to apply remote events and replay
  useImperativeHandle(ref, () => ({
    replayEvents(events: DrawEvent[]) {
      const ctx = getCtx()
      const imageData = getImageData()
      if (!ctx || !imageData) return

      clearCanvas(ctx, imageData)

      for (const event of events) {
        if (event.type === 'line') {
          drawLineNoFlush(imageData, event.data.x, event.data.y, event.data.x2, event.data.y2, indexToRgb(event.data.color), event.data.width)
        } else if (event.type === 'fill') {
          floodFill(ctx, imageData, event.data.x, event.data.y, indexToRgb(event.data.color))
        } else if (event.type === 'clear') {
          clearCanvas(ctx, imageData)
        }
      }
      ctx.putImageData(imageData, 0, 0)
    },

    clear() {
      const ctx = getCtx()
      const imageData = getImageData()
      if (ctx && imageData) clearCanvas(ctx, imageData)
    },

    applyLine(data: LineEvent) {
      const ctx = getCtx()
      const imageData = getImageData()
      if (ctx && imageData) drawLine(ctx, imageData, data.x, data.y, data.x2, data.y2, indexToRgb(data.color), data.width)
    },

    applyFill(data: FillEvent) {
      const ctx = getCtx()
      const imageData = getImageData()
      if (ctx && imageData) floodFill(ctx, imageData, data.x, data.y, indexToRgb(data.color))
    },
  }))

  const sendLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const ctx = getCtx()
    const imageData = getImageData()
    if (!ctx || !imageData) return

    const effectiveColor = tool === 'eraser' ? 0 : colorIndex
    const color = indexToRgb(effectiveColor)
    drawLine(ctx, imageData, x1, y1, x2, y2, color, brushSize)

    onLine?.({ x: x1, y: y1, x2, y2, color: effectiveColor, width: brushSize })
  }, [tool, colorIndex, brushSize, onLine])

  const sendFill = useCallback((x: number, y: number) => {
    const ctx = getCtx()
    const imageData = getImageData()
    if (!ctx || !imageData) return

    const filled = floodFill(ctx, imageData, x, y, indexToRgb(colorIndex))
    if (filled) onFill?.({ x, y, color: colorIndex })
  }, [colorIndex, onFill])

  // Mouse handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!allowDrawing || e.pointerType === 'touch') return
    if (e.buttons !== 1) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = toBase(e.clientX - rect.left)
    const y = toBase(e.clientY - rect.top)

    if (tool === 'fill') {
      sendFill(x, y)
      return
    }

    isDrawingRef.current = true
    lastPosRef.current = { x, y }
    // Draw a dot on click
    sendLine(x, y, x, y)
  }, [allowDrawing, tool, toBase, sendLine, sendFill])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return

    const rect = canvasRef.current!.getBoundingClientRect()
    const screenX = e.clientX - rect.left
    const screenY = e.clientY - rect.top

    // Update cursor preview position for pencil/eraser
    if (allowDrawing && tool !== 'fill') {
      setCursorPos({ x: screenX, y: screenY })
    }

    if (!isDrawingRef.current) return
    if (e.buttons !== 1) { isDrawingRef.current = false; return }

    const x = toBase(screenX)
    const y = toBase(screenY)

    sendLine(lastPosRef.current.x, lastPosRef.current.y, x, y)
    lastPosRef.current = { x, y }
  }, [allowDrawing, tool, toBase, sendLine])

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  const handlePointerLeave = useCallback(() => {
    isDrawingRef.current = false
    setCursorPos(null)
  }, [])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!allowDrawing) return
    e.preventDefault()

    const touch = e.touches[0]
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = toBase(touch.clientX - rect.left)
    const y = toBase(touch.clientY - rect.top)

    if (tool === 'fill') {
      sendFill(x, y)
      return
    }

    if (touchIdRef.current !== null) return
    touchIdRef.current = touch.identifier
    lastPosRef.current = { x, y }
    sendLine(x, y, x, y)
  }, [allowDrawing, tool, toBase, sendLine, sendFill])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!allowDrawing || touchIdRef.current === null) return
    e.preventDefault()

    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current)
    if (!touch) return

    const rect = canvasRef.current!.getBoundingClientRect()
    const x = toBase(touch.clientX - rect.left)
    const y = toBase(touch.clientY - rect.top)

    sendLine(lastPosRef.current.x, lastPosRef.current.y, x, y)
    lastPosRef.current = { x, y }
  }, [allowDrawing, toBase, sendLine])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchIdRef.current)
    if (touch) touchIdRef.current = null
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        onUndo?.()
      }
      if (!e.ctrlKey && !e.metaKey && (e.key === 'Delete' || e.key === 'Backspace') && allowDrawing) {
        e.preventDefault()
        onClear?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onUndo, onClear, allowDrawing])

  // Cursor style
  const cursor = !allowDrawing
    ? 'not-allowed'
    : tool === 'fill'
    ? 'crosshair'
    : 'none'

  // Cursor preview circle in screen coords
  const scale = canvasRef.current ? canvasRef.current.clientWidth / BASE_W : 1
  const cursorDiameter = brushSize * scale
  const isEraser = tool === 'eraser'
  const cursorColor = isEraser ? '#ffffff' : color

  return (
    <div className="relative w-full" style={{ aspectRatio: `${BASE_W}/${BASE_H}` }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />
      {allowDrawing && tool !== 'fill' && cursorPos && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: cursorPos.x - cursorDiameter / 2,
            top: cursorPos.y - cursorDiameter / 2,
            width: cursorDiameter,
            height: cursorDiameter,
            backgroundColor: cursorColor,
            border: `2px solid ${isEraser ? '#9ca3af' : 'rgba(0,0,0,0.5)'}`,
            boxShadow: isEraser ? 'none' : `0 0 0 1px rgba(255,255,255,0.6)`,
          }}
        />
      )}
    </div>
  )
})
