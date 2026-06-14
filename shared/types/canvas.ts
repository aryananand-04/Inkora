export interface LineEvent {
  x: number
  y: number
  x2: number
  y2: number
  color: number
  width: number
}

export interface FillEvent {
  x: number
  y: number
  color: number
}

export type DrawEvent =
  | { type: 'line'; data: LineEvent }
  | { type: 'fill'; data: FillEvent }
  | { type: 'clear' }

export const BRUSH_SIZES = [8, 16, 24, 32] as const
export type BrushSize = (typeof BRUSH_SIZES)[number]

export const COLOR_PALETTE = [
  '#ffffff', '#c1c1c1', '#ef130b', '#ff7100', '#ffe400', '#00cc00',
  '#00b2ff', '#231fd3', '#a300ba', '#d37caa', '#a0522d', '#592f2a', '#ecbcb4',
  '#000000', '#4c4c4c', '#740b07', '#c23800', '#e8a200', '#005510',
  '#00569e', '#0e0865', '#550069', '#a75574', '#63300d', '#492f31', '#d1a3a4'
] as const

export type ColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25

export type DrawingTool = 'pencil' | 'eraser' | 'fill'
