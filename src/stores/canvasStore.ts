import { create } from 'zustand'
import type { CanvasTool } from '@/types'

interface CanvasStore {
  selectedTool: CanvasTool
  selectedElementId: string | null
  zoom: number
  showGrid: boolean
  activeSide: 'front' | 'back'
  activeCardId: string | null
  setSelectedTool: (tool: CanvasTool) => void
  setSelectedElementId: (id: string | null) => void
  setZoom: (zoom: number) => void
  toggleGrid: () => void
  setActiveSide: (side: 'front' | 'back') => void
  setActiveCardId: (id: string | null) => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  selectedTool: 'select',
  selectedElementId: null,
  zoom: 1,
  showGrid: true,
  activeSide: 'front',
  activeCardId: null,
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),
  toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
  setActiveSide: (side) => set({ activeSide: side, selectedElementId: null }),
  setActiveCardId: (id) => set({ activeCardId: id, selectedElementId: null }),
}))
