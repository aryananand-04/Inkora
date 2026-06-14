import { useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import type { CanvasHandle } from '../components/Canvas/Canvas'
import type { LineEvent, FillEvent, DrawEvent } from 'shared'

export function useDrawingSync(
  canvasRef: React.RefObject<CanvasHandle | null>,
  initialDrawing?: DrawEvent[],
) {
  const { socket } = useSocket()
  const pendingLines = useRef<LineEvent[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Replay initial canvas state on mount (late join or reconnect)
  useEffect(() => {
    if (initialDrawing && initialDrawing.length > 0) {
      // Wait one frame for canvas to be ready
      requestAnimationFrame(() => {
        canvasRef.current?.replayEvents(initialDrawing)
      })
    }
  }, []) // intentionally empty — only run once on mount

  // Listen for remote drawing events
  useEffect(() => {
    const onLine = (data: LineEvent) => {
      canvasRef.current?.applyLine(data)
    }

    const onLines = (batch: LineEvent[]) => {
      for (const data of batch) canvasRef.current?.applyLine(data)
    }

    const onFill = (data: FillEvent) => {
      canvasRef.current?.applyFill(data)
    }

    const onClearCanvas = () => {
      canvasRef.current?.clear()
    }

    const onDrawing = (events: DrawEvent[]) => {
      canvasRef.current?.replayEvents(events)
    }

    socket.on('line', onLine)
    socket.on('lines', onLines)
    socket.on('fill', onFill)
    socket.on('clear-canvas', onClearCanvas)
    socket.on('drawing', onDrawing)

    return () => {
      socket.off('line', onLine)
      socket.off('lines', onLines)
      socket.off('fill', onFill)
      socket.off('clear-canvas', onClearCanvas)
      socket.off('drawing', onDrawing)
    }
  }, [socket, canvasRef])

  // Batched line sender — accumulates for 16ms then sends ONE socket frame
  const flushLines = useCallback(() => {
    const lines = pendingLines.current.splice(0)
    if (lines.length > 0) socket.emit('lines', lines)
  }, [socket])

  const sendLine = useCallback((data: LineEvent) => {
    pendingLines.current.push(data)
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null
        flushLines()
      }, 16)
    }
  }, [flushLines])

  const sendFill = useCallback((data: FillEvent) => {
    socket.emit('fill', data)
  }, [socket])

  const sendClear = useCallback(() => {
    socket.emit('clear-canvas')
  }, [socket])

  const sendUndo = useCallback(() => {
    socket.emit('undo')
  }, [socket])

  return { sendLine, sendFill, sendClear, sendUndo }
}
