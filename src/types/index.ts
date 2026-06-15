export interface Project {
  id: string
  name: string
  cardWidth: number
  cardHeight: number
  createdAt: string
  updatedAt: string
  thumbnail: string
  sizePreset: 'poker' | 'bridge' | 'tarot' | 'custom'
}

export interface CardElement {
  id: string
  type: 'text' | 'rect' | 'circle' | 'line' | 'image' | 'icon'
  x: number
  y: number
  width: number
  height: number
  style: {
    color?: string
    fontSize?: number
    fontWeight?: string
    fontFamily?: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    borderRadius?: number
    textAlign?: string
    opacity?: number
    rotation?: number
  }
  content: string
}

export interface CardAttribute {
  id: string
  label: string
  value: string
}

export interface Card {
  id: string
  projectId: string
  name: string
  template: string
  number: string
  background: string
  frontElements: CardElement[]
  backElements: CardElement[]
  attributes: CardAttribute[]
}

export interface Deck {
  id: string
  projectId: string
  name: string
  description: string
}

export interface DeckCard {
  id: string
  deckId: string
  cardId: string
  quantity: number
}

export interface Icon {
  id: string
  projectId: string
  name: string
  category: string
  dataUrl: string
  format: string
  tags: string[]
}

export interface Rule {
  id: string
  projectId: string
  title: string
}

export interface RuleChapter {
  id: string
  ruleId: string
  title: string
  content: string
  order: number
  cardRefs: string[]
}

export type CanvasTool = 'select' | 'text' | 'rect' | 'circle' | 'line' | 'pen' | 'image' | 'icon'

export interface CanvasState {
  selectedTool: CanvasTool
  selectedElementId: string | null
  zoom: number
  showGrid: boolean
  activeSide: 'front' | 'back'
}

export const CARD_PRESETS = {
  poker: { label: '扑克牌', width: 63, height: 88 },
  bridge: { label: '桥牌', width: 57, height: 89 },
  tarot: { label: '塔罗牌', width: 70, height: 120 },
} as const

export const CARD_TEMPLATES = [
  { id: 'attack', name: '攻击卡', background: '#8B3A3A', attrs: ['名称', '攻击力', '法力消耗', '描述'] },
  { id: 'defense', name: '防御卡', background: '#2D5F4A', attrs: ['名称', '防御力', '法力消耗', '描述'] },
  { id: 'magic', name: '魔法卡', background: '#4A3A8B', attrs: ['名称', '法力值', '效果', '描述'] },
  { id: 'event', name: '事件卡', background: '#8B7A3A', attrs: ['名称', '触发条件', '效果', '描述'] },
  { id: 'blank', name: '空白卡', background: '#F5E6C8', attrs: ['名称', '描述'] },
] as const

export const ICON_CATEGORIES = ['元素', '种族', '状态', '装备', '地形', '其他'] as const
