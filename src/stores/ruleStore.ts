import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Rule, RuleChapter } from '@/types'

interface RuleStore {
  rule: Rule | null
  chapters: RuleChapter[]
  loadRule: (projectId: string) => void
  createRule: (projectId: string, title: string) => string
  updateRule: (updates: Partial<Rule>) => void
  addChapter: (title: string) => string
  deleteChapter: (id: string) => void
  updateChapter: (id: string, updates: Partial<RuleChapter>) => void
  reorderChapters: (chapterIds: string[]) => void
  addCardRef: (chapterId: string, cardId: string) => void
  removeCardRef: (chapterId: string, cardId: string) => void
  saveRule: () => void
}

const ruleKey = (pid: string) => `cf_rule_${pid}`
const chaptersKey = (pid: string) => `cf_chapters_${pid}`

export const useRuleStore = create<RuleStore>((set, get) => ({
  rule: null,
  chapters: [],

  loadRule: (projectId) => {
    const r = localStorage.getItem(ruleKey(projectId))
    const c = localStorage.getItem(chaptersKey(projectId))
    set({
      rule: r ? JSON.parse(r) : null,
      chapters: c ? JSON.parse(c) : [],
    })
  },

  createRule: (projectId, title) => {
    const rule: Rule = { id: uuid(), projectId, title }
    set({ rule })
    localStorage.setItem(ruleKey(projectId), JSON.stringify(rule))
    return rule.id
  },

  updateRule: (updates) => {
    set(state => {
      if (!state.rule) return state
      const rule = { ...state.rule, ...updates }
      localStorage.setItem(ruleKey(state.rule.projectId), JSON.stringify(rule))
      return { rule }
    })
  },

  addChapter: (title) => {
    const chapter: RuleChapter = {
      id: uuid(),
      ruleId: get().rule?.id || '',
      title,
      content: '',
      order: get().chapters.length,
      cardRefs: [],
    }
    set(state => {
      const chapters = [...state.chapters, chapter]
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
    return chapter.id
  },

  deleteChapter: (id) => {
    set(state => {
      const chapters = state.chapters.filter(c => c.id !== id).map((c, i) => ({ ...c, order: i }))
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
  },

  updateChapter: (id, updates) => {
    set(state => {
      const chapters = state.chapters.map(c => c.id === id ? { ...c, ...updates } : c)
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
  },

  reorderChapters: (chapterIds) => {
    set(state => {
      const chapters = chapterIds.map((id, i) => {
        const ch = state.chapters.find(c => c.id === id)
        return ch ? { ...ch, order: i } : state.chapters[i]
      })
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
  },

  addCardRef: (chapterId, cardId) => {
    set(state => {
      const chapters = state.chapters.map(c => {
        if (c.id !== chapterId) return c
        return { ...c, cardRefs: [...c.cardRefs, cardId] }
      })
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
  },

  removeCardRef: (chapterId, cardId) => {
    set(state => {
      const chapters = state.chapters.map(c => {
        if (c.id !== chapterId) return c
        return { ...c, cardRefs: c.cardRefs.filter(ref => ref !== cardId) }
      })
      const pid = state.rule?.projectId
      if (pid) localStorage.setItem(chaptersKey(pid), JSON.stringify(chapters))
      return { chapters }
    })
  },

  saveRule: () => {
    const { rule, chapters } = get()
    if (rule) {
      localStorage.setItem(ruleKey(rule.projectId), JSON.stringify(rule))
      localStorage.setItem(chaptersKey(rule.projectId), JSON.stringify(chapters))
    }
  },
}))
