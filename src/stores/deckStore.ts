import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Deck, DeckCard } from '@/types'

interface DeckStore {
  decks: Deck[]
  deckCards: DeckCard[]
  loadDecks: (projectId: string) => void
  addDeck: (projectId: string, name: string) => string
  deleteDeck: (id: string) => void
  updateDeck: (id: string, updates: Partial<Deck>) => void
  addCardToDeck: (deckId: string, cardId: string, quantity?: number) => void
  removeCardFromDeck: (deckId: string, cardId: string) => void
  updateQuantity: (deckId: string, cardId: string, quantity: number) => void
  getDeckCards: (deckId: string) => DeckCard[]
  getDeckTotal: (deckId: string) => number
  saveDecks: (projectId: string) => void
}

const decksKey = (pid: string) => `cf_decks_${pid}`
const deckCardsKey = (pid: string) => `cf_deckcards_${pid}`

export const useDeckStore = create<DeckStore>((set, get) => ({
  decks: [],
  deckCards: [],

  loadDecks: (projectId) => {
    const d = localStorage.getItem(decksKey(projectId))
    const dc = localStorage.getItem(deckCardsKey(projectId))
    set({
      decks: d ? JSON.parse(d) : [],
      deckCards: dc ? JSON.parse(dc) : [],
    })
  },

  addDeck: (projectId, name) => {
    const deck: Deck = { id: uuid(), projectId, name, description: '' }
    set(state => {
      const decks = [...state.decks, deck]
      localStorage.setItem(decksKey(projectId), JSON.stringify(decks))
      return { decks }
    })
    return deck.id
  },

  deleteDeck: (id) => {
    set(state => {
      const decks = state.decks.filter(d => d.id !== id)
      const deckCards = state.deckCards.filter(dc => dc.deckId !== id)
      const pid = state.decks.find(d => d.id === id)?.projectId
      if (pid) {
        localStorage.setItem(decksKey(pid), JSON.stringify(decks))
        localStorage.setItem(deckCardsKey(pid), JSON.stringify(deckCards))
      }
      return { decks, deckCards }
    })
  },

  updateDeck: (id, updates) => {
    set(state => {
      const decks = state.decks.map(d => d.id === id ? { ...d, ...updates } : d)
      const pid = state.decks.find(d => d.id === id)?.projectId
      if (pid) localStorage.setItem(decksKey(pid), JSON.stringify(decks))
      return { decks }
    })
  },

  addCardToDeck: (deckId, cardId, quantity = 1) => {
    set(state => {
      const existing = state.deckCards.find(dc => dc.deckId === deckId && dc.cardId === cardId)
      let deckCards: DeckCard[]
      if (existing) {
        deckCards = state.deckCards.map(dc =>
          dc.id === existing.id ? { ...dc, quantity: dc.quantity + quantity } : dc
        )
      } else {
        deckCards = [...state.deckCards, { id: uuid(), deckId, cardId, quantity }]
      }
      const pid = state.decks.find(d => d.id === deckId)?.projectId
      if (pid) localStorage.setItem(deckCardsKey(pid), JSON.stringify(deckCards))
      return { deckCards }
    })
  },

  removeCardFromDeck: (deckId, cardId) => {
    set(state => {
      const deckCards = state.deckCards.filter(dc => !(dc.deckId === deckId && dc.cardId === cardId))
      const pid = state.decks.find(d => d.id === deckId)?.projectId
      if (pid) localStorage.setItem(deckCardsKey(pid), JSON.stringify(deckCards))
      return { deckCards }
    })
  },

  updateQuantity: (deckId, cardId, quantity) => {
    set(state => {
      const deckCards = state.deckCards.map(dc =>
        dc.deckId === deckId && dc.cardId === cardId ? { ...dc, quantity: Math.max(1, quantity) } : dc
      )
      const pid = state.decks.find(d => d.id === deckId)?.projectId
      if (pid) localStorage.setItem(deckCardsKey(pid), JSON.stringify(deckCards))
      return { deckCards }
    })
  },

  getDeckCards: (deckId) => get().deckCards.filter(dc => dc.deckId === deckId),

  getDeckTotal: (deckId) => {
    return get().deckCards
      .filter(dc => dc.deckId === deckId)
      .reduce((sum, dc) => sum + dc.quantity, 0)
  },

  saveDecks: (projectId) => {
    const state = get()
    localStorage.setItem(decksKey(projectId), JSON.stringify(state.decks))
    localStorage.setItem(deckCardsKey(projectId), JSON.stringify(state.deckCards))
  },
}))
