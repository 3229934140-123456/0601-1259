import { v4 as uuid } from 'uuid'
import type { CardElement } from '@/types'

export function createTextElement(x: number, y: number, content: string = '文本'): CardElement {
  return {
    id: uuid(),
    type: 'text',
    x,
    y,
    width: 100,
    height: 30,
    style: {
      color: '#F5E6C8',
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'left',
      opacity: 1,
    },
    content,
  }
}

export function createRectElement(x: number, y: number, width: number = 80, height: number = 60): CardElement {
  return {
    id: uuid(),
    type: 'rect',
    x,
    y,
    width,
    height,
    style: {
      backgroundColor: 'transparent',
      borderColor: '#D4A853',
      borderWidth: 2,
      borderRadius: 4,
      opacity: 1,
    },
    content: '',
  }
}

export function createCircleElement(x: number, y: number, size: number = 60): CardElement {
  return {
    id: uuid(),
    type: 'circle',
    x,
    y,
    width: size,
    height: size,
    style: {
      backgroundColor: 'transparent',
      borderColor: '#D4A853',
      borderWidth: 2,
      opacity: 1,
    },
    content: '',
  }
}

export function createLineElement(x: number, y: number, width: number = 100, height: number = 2): CardElement {
  return {
    id: uuid(),
    type: 'line',
    x,
    y,
    width,
    height,
    style: {
      backgroundColor: '#D4A853',
      opacity: 1,
    },
    content: '',
  }
}

export function createImageElement(x: number, y: number, dataUrl: string, width: number = 80, height: number = 80): CardElement {
  return {
    id: uuid(),
    type: 'image',
    x,
    y,
    width,
    height,
    style: {
      opacity: 1,
    },
    content: dataUrl,
  }
}

export function createIconElement(x: number, y: number, dataUrl: string, width: number = 40, height: number = 40): CardElement {
  return {
    id: uuid(),
    type: 'icon',
    x,
    y,
    width,
    height,
    style: {
      opacity: 1,
    },
    content: dataUrl,
  }
}

export const PENDING_ICON_KEY = 'cf_pending_icon'

export function storePendingIcon(dataUrl: string) {
  localStorage.setItem(PENDING_ICON_KEY, JSON.stringify({
    dataUrl,
    timestamp: Date.now(),
  }))
}

export function retrievePendingIcon(): string | null {
  const data = localStorage.getItem(PENDING_ICON_KEY)
  if (!data) return null
  try {
    const parsed = JSON.parse(data)
    if (Date.now() - parsed.timestamp > 60000) {
      localStorage.removeItem(PENDING_ICON_KEY)
      return null
    }
    localStorage.removeItem(PENDING_ICON_KEY)
    return parsed.dataUrl
  } catch {
    localStorage.removeItem(PENDING_ICON_KEY)
    return null
  }
}
