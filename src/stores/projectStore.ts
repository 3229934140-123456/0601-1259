import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Project } from '@/types'

interface ProjectStore {
  projects: Project[]
  addProject: (name: string, preset: Project['sizePreset'], width?: number, height?: number) => string
  deleteProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  getProject: (id: string) => Project | undefined
}

const CARD_PRESETS: Record<string, { width: number; height: number }> = {
  poker: { width: 63, height: 88 },
  bridge: { width: 57, height: 89 },
  tarot: { width: 70, height: 120 },
  custom: { width: 63, height: 88 },
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: JSON.parse(localStorage.getItem('cf_projects') || '[]'),

  addProject: (name, preset, width, height) => {
    const dims = CARD_PRESETS[preset] || CARD_PRESETS.poker
    const project: Project = {
      id: uuid(),
      name,
      cardWidth: width || dims.width,
      cardHeight: height || dims.height,
      sizePreset: preset,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnail: '',
    }
    set(state => {
      const projects = [...state.projects, project]
      localStorage.setItem('cf_projects', JSON.stringify(projects))
      return { projects }
    })
    return project.id
  },

  deleteProject: (id) => {
    set(state => {
      const projects = state.projects.filter(p => p.id !== id)
      localStorage.setItem('cf_projects', JSON.stringify(projects))
      return { projects }
    })
  },

  updateProject: (id, updates) => {
    set(state => {
      const projects = state.projects.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      )
      localStorage.setItem('cf_projects', JSON.stringify(projects))
      return { projects }
    })
  },

  getProject: (id) => get().projects.find(p => p.id === id),
}))
