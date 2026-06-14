import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useDrawing, BRUSH_SIZES } from '../../context/DrawingContext'
import { COLOR_PALETTE } from 'shared'
import type { BrushSize, DrawingTool } from 'shared'

interface ToolbarProps {
  onClear: () => void
  onUndo: () => void
}

const TOOLS: { id: DrawingTool; label: string; key: string; icon: string }[] = [
  { id: 'pencil', label: 'Pencil', key: 'P', icon: '✏️' },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: '⬜' },
  { id: 'fill',   label: 'Fill',   key: 'G', icon: '🪣' },
]

export function Toolbar({ onClear, onUndo }: ToolbarProps) {
  const { tool, colorIndex, brushSize, setTool, setColorIndex, setBrushSize } = useDrawing()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toUpperCase()) {
        case 'P': setTool('pencil'); break
        case 'E': setTool('eraser'); break
        case 'G': setTool('fill'); break
        case '1': setBrushSize(8); break
        case '2': setBrushSize(16); break
        case '3': setBrushSize(24); break
        case '4': setBrushSize(32); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setTool, setBrushSize])

  return (
    <div className="flex flex-col gap-2.5 p-2.5 glass bg-surface/90 border border-border rounded-2xl shadow-lg">

      {/* Tools row */}
      <div className="flex gap-1.5 items-center">
        {/* Tool pill group */}
        <div className="flex gap-1 p-1 bg-surface-light rounded-xl">
          {TOOLS.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.key})`}
              className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tool === t.id
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-text-muted hover:text-text hover:bg-border/60'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border flex-shrink-0" />

        {/* Brush sizes */}
        <div className="flex gap-1 p-1 bg-surface-light rounded-xl">
          {BRUSH_SIZES.map((size, i) => (
            <button
              key={size}
              onClick={() => setBrushSize(size as BrushSize)}
              title={`Size ${size} (${i + 1})`}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                brushSize === size
                  ? 'bg-primary shadow-md shadow-primary/30'
                  : 'hover:bg-border/60'
              }`}
            >
              <div
                className="rounded-full transition-colors"
                style={{
                  width: `${Math.max(3, size / 5)}px`,
                  height: `${Math.max(3, size / 5)}px`,
                  backgroundColor: brushSize === size ? 'white' : 'var(--text-muted)',
                }}
              />
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border flex-shrink-0" />

        {/* Undo + Clear */}
        <button
          onClick={onUndo}
          title="Undo (Z)"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-light transition-all text-sm"
        >
          ↩
        </button>
        <button
          onClick={onClear}
          title="Clear canvas (Del)"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all text-sm"
        >
          🗑
        </button>
      </div>

      {/* Color palette — 2 rows of 13 */}
      <div className="space-y-1">
        {[COLOR_PALETTE.slice(0, 13), COLOR_PALETTE.slice(13)].map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-1">
            {row.map((hex, i) => {
              const idx = rowIdx * 13 + i
              const isActive = colorIndex === idx
              return (
                <motion.button
                  key={idx}
                  onClick={() => setColorIndex(idx)}
                  title={hex}
                  style={{ backgroundColor: hex }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className={`flex-1 h-6 rounded-md transition-all ${
                    isActive
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-surface scale-110 shadow-md'
                      : ''
                  }`}
                />
              )
            })}
          </div>
        ))}
      </div>

    </div>
  )
}
