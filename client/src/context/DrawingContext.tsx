import { createContext, useContext, useState, type ReactNode } from 'react'
import { BRUSH_SIZES, COLOR_PALETTE } from 'shared'
import type { BrushSize, DrawingTool } from 'shared'

interface DrawingState {
  tool: DrawingTool
  colorIndex: number
  brushSize: BrushSize
  color: string
}

interface DrawingContextValue extends DrawingState {
  setTool: (tool: DrawingTool) => void
  setColorIndex: (index: number) => void
  setBrushSize: (size: BrushSize) => void
}

const DrawingContext = createContext<DrawingContextValue | null>(null)

export function DrawingProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<DrawingTool>('pencil')
  const [colorIndex, setColorIndexState] = useState(13) // black
  const [brushSize, setBrushSize] = useState<BrushSize>(16)

  const setColorIndex = (index: number) => {
    setColorIndexState(index)
    // Switching color auto-selects pencil
    if (tool === 'eraser') setTool('pencil')
  }

  return (
    <DrawingContext.Provider value={{
      tool,
      colorIndex,
      brushSize,
      color: COLOR_PALETTE[colorIndex] ?? '#000000',
      setTool,
      setColorIndex,
      setBrushSize,
    }}>
      {children}
    </DrawingContext.Provider>
  )
}

export function useDrawing() {
  const ctx = useContext(DrawingContext)
  if (!ctx) throw new Error('useDrawing must be used within DrawingProvider')
  return ctx
}

export { BRUSH_SIZES }
