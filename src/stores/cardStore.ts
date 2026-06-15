import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Card, CardElement, CardAttribute } from '@/types'
import { CARD_TEMPLATES } from '@/types'

interface CardStore {
  cards: Card[]
  loadCards: (projectId: string) => void
  addCard: (projectId: string, template?: string) => string
  deleteCard: (id: string) => void
  updateCard: (id: string, updates: Partial<Card>) => void
  getProjectCards: (projectId: string) => Card[]
  getCard: (id: string) => Card | undefined
  addElement: (cardId: string, side: 'front' | 'back', element: CardElement) => void
  updateElement: (cardId: string, side: 'front' | 'back', elementId: string, updates: Partial<CardElement>) => void
  deleteElement: (cardId: string, side: 'front' | 'back', elementId: string) => void
  batchNumber: (projectId: string, prefix: string, startNum: number) => void
  updateAttribute: (cardId: string, attrId: string, updates: Partial<CardAttribute>) => void
  addAttribute: (cardId: string, label: string, value: string) => void
  removeAttribute: (cardId: string, attrId: string) => void
  replaceBackground: (projectId: string, background: string) => void
  saveCards: () => void
}

const storageKey = (pid: string) => `cf_cards_${pid}`

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],

  loadCards: (projectId) => {
    const data = localStorage.getItem(storageKey(projectId))
    const loadedCards = data ? JSON.parse(data) : []
    const filteredCards = loadedCards.filter((c: Card) => c.projectId === projectId)
    set({ cards: filteredCards })
    if (filteredCards.length !== loadedCards.length) {
      localStorage.setItem(storageKey(projectId), JSON.stringify(filteredCards))
    }
  },

  addCard: (projectId, templateId) => {
    const tpl = CARD_TEMPLATES.find(t => t.id === templateId) || CARD_TEMPLATES[4]
    const attrs: CardAttribute[] = tpl.attrs.map(label => ({
      id: uuid(),
      label,
      value: '',
    }))
    const card: Card = {
      id: uuid(),
      projectId,
      name: '新卡牌',
      template: tpl.id,
      number: '',
      background: tpl.background,
      frontElements: [],
      backElements: [],
      attributes: attrs,
    }
    set(state => {
      const cards = [...state.cards, card]
      const projectCards = cards.filter(c => c.projectId === projectId)
      localStorage.setItem(storageKey(projectId), JSON.stringify(projectCards))
      return { cards }
    })
    return card.id
  },

  deleteCard: (id) => {
    set(state => {
      const cards = state.cards.filter(c => c.id !== id)
      const pid = state.cards.find(c => c.id === id)?.projectId
      if (pid) {
        const projectCards = cards.filter(c => c.projectId === pid)
        localStorage.setItem(storageKey(pid), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  updateCard: (id, updates) => {
    set(state => {
      const cards = state.cards.map(c => c.id === id ? { ...c, ...updates } : c)
      const updatedCard = cards.find(c => c.id === id)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  getProjectCards: (projectId) => get().cards.filter(c => c.projectId === projectId),

  getCard: (id) => get().cards.find(c => c.id === id),

  addElement: (cardId, side, element) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        const elements = side === 'front'
          ? { frontElements: [...c.frontElements, element] }
          : { backElements: [...c.backElements, element] }
        return { ...c, ...elements }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  updateElement: (cardId, side, elementId, updates) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        const key = side === 'front' ? 'frontElements' : 'backElements'
        const elements = c[key].map(e => e.id === elementId ? { ...e, ...updates } : e)
        return { ...c, [key]: elements }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  deleteElement: (cardId, side, elementId) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        const key = side === 'front' ? 'frontElements' : 'backElements'
        const elements = c[key].filter(e => e.id !== elementId)
        return { ...c, [key]: elements }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  batchNumber: (projectId, prefix, startNum) => {
    set(state => {
      const projectCards = state.cards.filter(c => c.projectId === projectId)
      const cards = state.cards.map(c => {
        if (c.projectId !== projectId) return c
        const idx = projectCards.findIndex(pc => pc.id === c.id)
        const num = startNum + idx
        return { ...c, number: `${prefix}${String(num).padStart(3, '0')}` }
      })
      const updatedProjectCards = cards.filter(c => c.projectId === projectId)
      localStorage.setItem(storageKey(projectId), JSON.stringify(updatedProjectCards))
      return { cards }
    })
  },

  updateAttribute: (cardId, attrId, updates) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        const attributes = c.attributes.map(a => a.id === attrId ? { ...a, ...updates } : a)
        return { ...c, attributes }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  addAttribute: (cardId, label, value) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        return { ...c, attributes: [...c.attributes, { id: uuid(), label, value }] }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  removeAttribute: (cardId, attrId) => {
    set(state => {
      const cards = state.cards.map(c => {
        if (c.id !== cardId) return c
        return { ...c, attributes: c.attributes.filter(a => a.id !== attrId) }
      })
      const updatedCard = cards.find(c => c.id === cardId)
      if (updatedCard?.projectId) {
        const projectCards = cards.filter(c => c.projectId === updatedCard.projectId)
        localStorage.setItem(storageKey(updatedCard.projectId), JSON.stringify(projectCards))
      }
      return { cards }
    })
  },

  replaceBackground: (projectId, background) => {
    set(state => {
      const cards = state.cards.map(c =>
        c.projectId === projectId ? { ...c, background } : c
      )
      const projectCards = cards.filter(c => c.projectId === projectId)
      localStorage.setItem(storageKey(projectId), JSON.stringify(projectCards))
      return { cards }
    })
  },

  saveCards: () => {
    const state = get()
    const projectIds = [...new Set(state.cards.map(c => c.projectId))]
    projectIds.forEach(pid => {
      const projectCards = state.cards.filter(c => c.projectId === pid)
      localStorage.setItem(storageKey(pid), JSON.stringify(projectCards))
    })
  },
}))
