import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Icon } from '@/types'

interface IconStore {
  icons: Icon[]
  loadIcons: (projectId: string) => void
  addIcon: (projectId: string, name: string, category: string, dataUrl: string, format: string, tags?: string[]) => string
  deleteIcon: (id: string) => void
  updateIcon: (id: string, updates: Partial<Icon>) => void
  getProjectIcons: (projectId: string) => Icon[]
  searchIcons: (projectId: string, query: string) => Icon[]
  saveIcons: (projectId: string) => void
}

const storageKey = (pid: string) => `cf_icons_${pid}`

export const useIconStore = create<IconStore>((set, get) => ({
  icons: [],

  loadIcons: (projectId) => {
    const data = localStorage.getItem(storageKey(projectId))
    set({ icons: data ? JSON.parse(data) : [] })
  },

  addIcon: (projectId, name, category, dataUrl, format, tags = []) => {
    const icon: Icon = { id: uuid(), projectId, name, category, dataUrl, format, tags }
    set(state => {
      const icons = [...state.icons, icon]
      localStorage.setItem(storageKey(projectId), JSON.stringify(icons))
      return { icons }
    })
    return icon.id
  },

  deleteIcon: (id) => {
    set(state => {
      const icons = state.icons.filter(i => i.id !== id)
      const pid = state.icons.find(i => i.id === id)?.projectId
      if (pid) localStorage.setItem(storageKey(pid), JSON.stringify(icons))
      return { icons }
    })
  },

  updateIcon: (id, updates) => {
    set(state => {
      const icons = state.icons.map(i => i.id === id ? { ...i, ...updates } : i)
      const pid = state.icons.find(i => i.id === id)?.projectId
      if (pid) localStorage.setItem(storageKey(pid), JSON.stringify(icons))
      return { icons }
    })
  },

  getProjectIcons: (projectId) => get().icons.filter(i => i.projectId === projectId),

  searchIcons: (projectId, query) => {
    const q = query.toLowerCase()
    return get().icons.filter(i =>
      i.projectId === projectId &&
      (i.name.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q)))
    )
  },

  saveIcons: (projectId) => {
    const icons = get().icons.filter(i => i.projectId === projectId)
    localStorage.setItem(storageKey(projectId), JSON.stringify(icons))
  },
}))
