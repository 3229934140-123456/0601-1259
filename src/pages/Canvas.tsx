import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { v4 as uuid } from 'uuid'
import { MousePointer2, Type, Square, Circle, Minus, Image, ZoomIn, ZoomOut, Grid3X3, Plus, ChevronUp, ChevronDown, Trash2, FlipHorizontal, Hash, Layers, Sliders, LayoutTemplate, RotateCcw } from 'lucide-react'
import { useCardStore } from '@/stores/cardStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Card, CardElement, CanvasTool } from '@/types'
import { CARD_TEMPLATES } from '@/types'
import { createTextElement, createRectElement, createCircleElement, createLineElement, createIconElement, retrievePendingIcon } from '@/utils/canvasElements'
import { cn } from '@/lib/utils'
import CardPreview from '@/components/CardPreview'
import Modal from '@/components/Modal'

const MM_TO_PX = 3

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null

export default function Canvas() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, elementX: 0, elementY: 0, elementW: 0, elementH: 0 })
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [rightTab, setRightTab] = useState<'attributes' | 'layers' | 'templates'>('attributes')
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchPrefix, setBatchPrefix] = useState('')
  const [batchStart, setBatchStart] = useState(1)
  const [isFlipping, setIsFlipping] = useState(false)

  const {
    loadCards,
    addCard,
    updateCard,
    getProjectCards,
    getCard,
    addElement,
    updateElement,
    deleteElement,
    batchNumber,
    updateAttribute,
    addAttribute,
    removeAttribute,
    saveCards,
    cards,
  } = useCardStore()

  const {
    selectedTool,
    selectedElementId,
    zoom,
    showGrid,
    activeSide,
    activeCardId,
    setSelectedTool,
    setSelectedElementId,
    setZoom,
    toggleGrid,
    setActiveSide,
    setActiveCardId,
  } = useCanvasStore()

  const getProject = useProjectStore(s => s.getProject)

  const project = projectId ? getProject(projectId) : null
  const projectCards = projectId ? getProjectCards(projectId) : []
  const activeCard = activeCardId ? getCard(activeCardId) : null
  const selectedElement = activeCard && selectedElementId
    ? (activeSide === 'front' ? activeCard.frontElements : activeCard.backElements).find(e => e.id === selectedElementId)
    : null

  const cardWidthPx = (project?.cardWidth || 63) * MM_TO_PX
  const cardHeightPx = (project?.cardHeight || 88) * MM_TO_PX

  useEffect(() => {
    if (projectId) {
      loadCards(projectId)
      const savedCardId = localStorage.getItem(`cf_active_card_${projectId}`)
      if (savedCardId) {
        setActiveCardId(savedCardId)
      }
    }
  }, [projectId, loadCards, setActiveCardId])

  useEffect(() => {
    const cards = getProjectCards(projectId!)
    if (projectId && cards.length > 0 && !activeCardId) {
      const firstCard = cards[0]
      setActiveCardId(firstCard.id)
      localStorage.setItem(`cf_active_card_${projectId}`, firstCard.id)
    }
  }, [cards, activeCardId, projectId, getProjectCards, setActiveCardId])

  useEffect(() => {
    const cardIdFromUrl = searchParams.get('cardId')
    if (cardIdFromUrl && projectId) {
      const cards = getProjectCards(projectId)
      const cardExists = cards.some(c => c.id === cardIdFromUrl)
      if (cardExists) {
        setActiveCardId(cardIdFromUrl)
        localStorage.setItem(`cf_active_card_${projectId}`, cardIdFromUrl)
      }
    }
  }, [searchParams, projectId, getProjectCards, setActiveCardId])

  useEffect(() => {
    if (projectId && getProjectCards(projectId).length === 0) {
      const newCardId = addCard(projectId, 'blank')
      setActiveCardId(newCardId)
      localStorage.setItem(`cf_active_card_${projectId}`, newCardId)
    }
  }, [projectId, addCard, getProjectCards, setActiveCardId])

  useEffect(() => {
    if (activeCardId && projectId) {
      localStorage.setItem(`cf_active_card_${projectId}`, activeCardId)
    }
  }, [activeCardId, projectId])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId && activeCardId && !editingTextId) {
          deleteElement(activeCardId, activeSide, selectedElementId)
          setSelectedElementId(null)
        }
      }
      if (e.key === 'Escape') {
        setSelectedElementId(null)
        setEditingTextId(null)
        setSelectedTool('select')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElementId, activeCardId, activeSide, editingTextId, deleteElement, setSelectedElementId, setSelectedTool])

  useEffect(() => {
    if (!activeCardId || !projectId) return
    const pendingIcon = retrievePendingIcon()
    if (pendingIcon) {
      const cardWidth = (project?.cardWidth || 63) * MM_TO_PX
      const cardHeight = (project?.cardHeight || 88) * MM_TO_PX
      const iconSize = Math.min(cardWidth, cardHeight) * 0.3
      const centerX = cardWidth / 2 - iconSize / 2
      const centerY = cardHeight / 2 - iconSize / 2
      const iconElement = createIconElement(centerX, centerY, pendingIcon, iconSize, iconSize)
      addElement(activeCardId, activeSide, iconElement)
      setSelectedTool('select')
      setSelectedElementId(iconElement.id)
    }
  }, [activeCardId, projectId, activeSide, addElement, project, setSelectedTool, setSelectedElementId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCards()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saveCards])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !activeCardId || selectedTool === 'select') return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom
    const y = (e.clientY - rect.top) / zoom

    if (x < 0 || y < 0 || x > cardWidthPx || y > cardHeightPx) return

    let element: CardElement | null = null

    switch (selectedTool) {
      case 'text':
        element = createTextElement(x, y)
        break
      case 'rect':
        element = createRectElement(x, y)
        break
      case 'circle':
        element = createCircleElement(x, y)
        break
      case 'line':
        element = createLineElement(x, y)
        break
      case 'image':
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string
              const img = new window.Image()
              img.onload = () => {
                const ratio = Math.min(80 / img.width, 80 / img.height)
                const w = img.width * ratio
                const h = img.height * ratio
                const imageElement: CardElement = {
                  id: uuid(),
                  type: 'image',
                  x: x - w / 2,
                  y: y - h / 2,
                  width: w,
                  height: h,
                  style: { opacity: 1 },
                  content: dataUrl,
                }
                addElement(activeCardId, activeSide, imageElement)
              }
              img.src = dataUrl
            }
            reader.readAsDataURL(file)
          }
        }
        input.click()
        return
      default:
        return
    }

    if (element) {
      addElement(activeCardId, activeSide, element)
      setSelectedTool('select')
      setSelectedElementId(element.id)
    }
  }, [selectedTool, zoom, cardWidthPx, cardHeightPx, activeCardId, activeSide, addElement, setSelectedTool, setSelectedElementId])

  const handleElementMouseDown = useCallback((e: React.MouseEvent, element: CardElement) => {
    e.stopPropagation()
    if (selectedTool !== 'select') return

    setSelectedElementId(element.id)
    setIsDragging(true)

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left) / zoom
    const mouseY = (e.clientY - rect.top) / zoom

    setDragOffset({
      x: mouseX - element.x,
      y: mouseY - element.y,
    })
  }, [selectedTool, zoom, setSelectedElementId])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !activeCardId || !selectedElementId) return

    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left) / zoom
    const mouseY = (e.clientY - rect.top) / zoom

    if (isDragging) {
      const newX = Math.max(0, Math.min(cardWidthPx - (selectedElement?.width || 0), mouseX - dragOffset.x))
      const newY = Math.max(0, Math.min(cardHeightPx - (selectedElement?.height || 0), mouseY - dragOffset.y))
      updateElement(activeCardId, activeSide, selectedElementId, { x: newX, y: newY })
    }

    if (isResizing && resizeHandle) {
      const deltaX = mouseX - resizeStart.x
      const deltaY = mouseY - resizeStart.y

      let newX = resizeStart.elementX
      let newY = resizeStart.elementY
      let newW = resizeStart.elementW
      let newH = resizeStart.elementH

      if (resizeHandle.includes('e')) newW = Math.max(10, resizeStart.elementW + deltaX)
      if (resizeHandle.includes('w')) {
        newW = Math.max(10, resizeStart.elementW - deltaX)
        newX = resizeStart.elementX + (resizeStart.elementW - newW)
      }
      if (resizeHandle.includes('s')) newH = Math.max(10, resizeStart.elementH + deltaY)
      if (resizeHandle.includes('n')) {
        newH = Math.max(10, resizeStart.elementH - deltaY)
        newY = resizeStart.elementY + (resizeStart.elementH - newH)
      }

      updateElement(activeCardId, activeSide, selectedElementId, {
        x: newX,
        y: newY,
        width: newW,
        height: newH,
      })
    }
  }, [isDragging, isResizing, dragOffset, resizeHandle, resizeStart, zoom, activeCardId, activeSide, selectedElementId, selectedElement, cardWidthPx, cardHeightPx, updateElement])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeHandle(null)
  }, [])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation()
    if (!selectedElement) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    setIsResizing(true)
    setResizeHandle(handle)
    setResizeStart({
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
      elementX: selectedElement.x,
      elementY: selectedElement.y,
      elementW: selectedElement.width,
      elementH: selectedElement.height,
    })
  }, [selectedElement, zoom])

  const handleDoubleClick = useCallback((e: React.MouseEvent, element: CardElement) => {
    e.stopPropagation()
    if (element.type === 'text') {
      setEditingTextId(element.id)
      setEditingText(element.content)
    }
  }, [])

  const handleTextBlur = useCallback(() => {
    if (editingTextId && activeCardId) {
      updateElement(activeCardId, activeSide, editingTextId, { content: editingText })
      setEditingTextId(null)
      setEditingText('')
    }
  }, [editingTextId, editingText, activeCardId, activeSide, updateElement])

  const handleSideToggle = useCallback(() => {
    setIsFlipping(true)
    setTimeout(() => {
      setActiveSide(activeSide === 'front' ? 'back' : 'front')
      setIsFlipping(false)
    }, 300)
  }, [activeSide, setActiveSide])

  const handleApplyTemplate = useCallback((templateId: string) => {
    if (!activeCardId) return
    const template = CARD_TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    const newAttrs = template.attrs.map(label => ({
      id: uuid(),
      label,
      value: '',
    }))

    updateCard(activeCardId, {
      template: template.id,
      background: template.background,
      attributes: newAttrs,
    })
  }, [activeCardId, updateCard])

  const handleBatchNumber = useCallback(() => {
    if (!projectId) return
    batchNumber(projectId, batchPrefix, batchStart)
    setShowBatchModal(false)
  }, [projectId, batchPrefix, batchStart, batchNumber])

  const handleAddCard = useCallback(() => {
    if (!projectId) return
    const newCardId = addCard(projectId, 'blank')
    setActiveCardId(newCardId)
  }, [projectId, addCard, setActiveCardId])

  const handleSelectCard = useCallback((cardId: string) => {
    setActiveCardId(cardId)
  }, [setActiveCardId])

  const handleMoveLayer = useCallback((direction: 'up' | 'down') => {
    if (!activeCardId || !selectedElementId) return
    const elements = activeSide === 'front' ? activeCard?.frontElements : activeCard?.backElements
    if (!elements) return

    const index = elements.findIndex(e => e.id === selectedElementId)
    if (index === -1) return

    const newIndex = direction === 'up'
      ? Math.min(elements.length - 1, index + 1)
      : Math.max(0, index - 1)

    if (newIndex === index) return

    const newElements = [...elements]
    const [removed] = newElements.splice(index, 1)
    newElements.splice(newIndex, 0, removed)

    updateCard(activeCardId, {
      [activeSide === 'front' ? 'frontElements' : 'backElements']: newElements,
    })
  }, [activeCardId, activeSide, selectedElementId, activeCard, updateCard])

  const handleDeleteElement = useCallback(() => {
    if (!activeCardId || !selectedElementId) return
    deleteElement(activeCardId, activeSide, selectedElementId)
    setSelectedElementId(null)
  }, [activeCardId, activeSide, selectedElementId, deleteElement, setSelectedElementId])

  const handlePropertyChange = useCallback((prop: keyof CardElement, value: any) => {
    if (!activeCardId || !selectedElementId) return
    updateElement(activeCardId, activeSide, selectedElementId, { [prop]: value })
  }, [activeCardId, activeSide, selectedElementId, updateElement])

  const handleStyleChange = useCallback((styleProp: keyof CardElement['style'], value: any) => {
    if (!activeCardId || !selectedElementId || !selectedElement) return
    updateElement(activeCardId, activeSide, selectedElementId, {
      style: { ...selectedElement.style, [styleProp]: value },
    })
  }, [activeCardId, activeSide, selectedElementId, selectedElement, updateElement])

  const tools: { id: CanvasTool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: '选择' },
    { id: 'text', icon: Type, label: '文本' },
    { id: 'rect', icon: Square, label: '矩形' },
    { id: 'circle', icon: Circle, label: '圆形' },
    { id: 'line', icon: Minus, label: '线条' },
    { id: 'image', icon: Image, label: '图片' },
  ]

  const elements = activeCard
    ? (activeSide === 'front' ? activeCard.frontElements : activeCard.backElements)
    : []

  const renderElement = (element: CardElement) => {
    const isSelected = selectedElementId === element.id
    const isEditing = editingTextId === element.id

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      color: element.style.color,
      fontSize: element.style.fontSize,
      fontWeight: element.style.fontWeight,
      fontFamily: element.style.fontFamily,
      backgroundColor: element.style.backgroundColor || 'transparent',
      borderColor: element.style.borderColor,
      borderWidth: element.style.borderWidth,
      borderRadius: element.style.borderRadius,
      textAlign: element.style.textAlign as any,
      opacity: element.style.opacity,
      transform: element.style.rotation ? `rotate(${element.style.rotation}deg)` : undefined,
      cursor: selectedTool === 'select' ? 'move' : 'default',
    }

    const renderContent = () => {
      if (isEditing && element.type === 'text') {
        return (
          <input
            className="w-full h-full bg-transparent outline-none border-none"
            style={{ color: element.style.color, fontSize: element.style.fontSize, fontWeight: element.style.fontWeight }}
            value={editingText}
            onChange={e => setEditingText(e.target.value)}
            onBlur={handleTextBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTextBlur()
              if (e.key === 'Escape') {
                setEditingTextId(null)
                setEditingText('')
              }
            }}
            autoFocus
          />
        )
      }

      switch (element.type) {
        case 'text':
          return <div className="w-full h-full flex items-center pointer-events-none">{element.content}</div>
        case 'rect':
          return <div className="w-full h-full" style={{ border: element.style.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor || '#D4A853'}` : '2px solid #D4A853' }} />
        case 'circle':
          return <div className="w-full h-full rounded-full" style={{ border: element.style.borderWidth ? `${element.style.borderWidth}px solid ${element.style.borderColor || '#D4A853'}` : '2px solid #D4A853' }} />
        case 'line':
          return <div className="w-full h-full" style={{ backgroundColor: element.style.backgroundColor || '#D4A853' }} />
        case 'image':
          return <img src={element.content} className="w-full h-full object-cover pointer-events-none" alt="" />
        case 'icon':
          return <img src={element.content} className="w-full h-full object-contain pointer-events-none" alt="" />
        default:
          return null
      }
    }

    return (
      <div
        key={element.id}
        className={cn(isSelected && 'ring-2 ring-blue-500')}
        style={baseStyle}
        onMouseDown={e => handleElementMouseDown(e, element)}
        onDoubleClick={e => handleDoubleClick(e, element)}
      >
        {renderContent()}
        {isSelected && !isEditing && (
          <>
            {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map(handle => {
              const position: Record<string, string> = {
                nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
                n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
                ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
                e: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
                se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
                s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
                sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
                w: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
              }
              const cursor: Record<string, string> = {
                nw: 'nw-resize',
                n: 'n-resize',
                ne: 'ne-resize',
                e: 'e-resize',
                se: 'se-resize',
                s: 's-resize',
                sw: 'sw-resize',
                w: 'w-resize',
              }
              return (
                <div
                  key={handle}
                  className={cn('absolute w-2.5 h-2.5 bg-blue-500 border-2 border-white rounded-sm z-10', position[handle])}
                  style={{ cursor: cursor[handle] }}
                  onMouseDown={e => handleResizeMouseDown(e, handle)}
                />
              )
            })}
          </>
        )}
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-forge-text-muted">
        <div className="text-center">
          <RotateCcw size={48} className="mx-auto mb-4 opacity-30 animate-spin" />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-forge-bg">
      <aside className="w-16 flex flex-col items-center py-3 gap-1 border-r border-forge-border bg-forge-surface flex-shrink-0">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={cn(
              'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200',
              selectedTool === tool.id
                ? 'bg-forge-gold/20 text-forge-gold'
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-gold/10'
            )}
            onClick={() => setSelectedTool(tool.id)}
            title={tool.label}
          >
            <tool.icon size={20} />
          </button>
        ))}

        <div className="w-10 h-px bg-forge-border my-2" />

        <button
          className={cn(
            'w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200',
            showGrid
              ? 'bg-forge-gold/20 text-forge-gold'
              : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-gold/10'
          )}
          onClick={toggleGrid}
          title="网格"
        >
          <Grid3X3 size={20} />
        </button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-12 flex items-center px-4 border-b border-forge-border bg-forge-surface/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-forge-gold font-display text-sm">{project.cardWidth}×{project.cardHeight}mm</span>
          </div>

          <div className="flex-1 flex justify-center">
            <div className="flex items-center bg-forge-elevated rounded-lg p-0.5">
              <button
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm transition-all duration-200',
                  activeSide === 'front'
                    ? 'bg-forge-gold text-forge-bg font-medium'
                    : 'text-forge-text-secondary hover:text-forge-text'
                )}
                onClick={() => activeSide !== 'front' && handleSideToggle()}
              >
                正面
              </button>
              <button
                className={cn(
                  'px-4 py-1.5 rounded-md text-sm transition-all duration-200',
                  activeSide === 'back'
                    ? 'bg-forge-gold text-forge-bg font-medium'
                    : 'text-forge-text-secondary hover:text-forge-text'
                )}
                onClick={() => activeSide !== 'back' && handleSideToggle()}
              >
                背面
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-outline text-sm flex items-center gap-1.5 py-1.5 px-3"
              onClick={() => setShowBatchModal(true)}
            >
              <Hash size={14} />
              批量编号
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(212, 168, 83, 0.1) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(212, 168, 83, 0.1) 1px, transparent 1px)
                `,
                backgroundSize: `${10 * zoom}px ${10 * zoom}px`,
              }}
            />
          )}

          <div
            ref={canvasRef}
            className={cn(
              'relative shadow-2xl rounded-lg overflow-hidden',
              isFlipping && 'card-flip'
            )}
            style={{
              width: cardWidthPx * zoom,
              height: cardHeightPx * zoom,
              background: activeCard?.background || '#F5E6C8',
              transform: `scale(1)`,
              transformOrigin: 'center center',
            }}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                width: cardWidthPx,
                height: cardHeightPx,
                position: 'relative',
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
            >
              {elements.map(renderElement)}
            </div>
          </div>

          <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-forge-elevated rounded-lg p-1 border border-forge-border">
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-forge-surface text-forge-text-secondary hover:text-forge-text transition-colors"
              onClick={() => setZoom(zoom - 0.1)}
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-forge-text-muted w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-forge-surface text-forge-text-secondary hover:text-forge-text transition-colors"
              onClick={() => setZoom(zoom + 0.1)}
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>

        <div className="h-28 border-t border-forge-border bg-forge-surface/60 flex-shrink-0 flex items-center px-4 gap-3 overflow-x-auto">
          {projectCards.map(card => (
            <div
              key={card.id}
              className={cn(
                'flex-shrink-0 cursor-pointer transition-all duration-200 rounded-lg p-1',
                activeCardId === card.id
                  ? 'ring-2 ring-forge-gold bg-forge-gold/10'
                  : 'hover:bg-forge-elevated'
              )}
              onClick={() => handleSelectCard(card.id)}
            >
              <CardPreview card={card} width={60} side={activeSide} />
              <div className="text-center mt-1">
                <div className="text-[10px] text-forge-text truncate w-[60px]">{card.name}</div>
                {card.number && (
                  <div className="text-[9px] text-forge-gold">{card.number}</div>
                )}
              </div>
            </div>
          ))}

          <button
            className="flex-shrink-0 w-[76px] h-[100px] border-2 border-dashed border-forge-border rounded-lg flex flex-col items-center justify-center text-forge-text-muted hover:border-forge-gold hover:text-forge-gold transition-all duration-200"
            onClick={handleAddCard}
          >
            <Plus size={24} />
            <span className="text-xs mt-1">添加卡牌</span>
          </button>
        </div>
      </main>

      <aside className="w-72 border-l border-forge-border bg-forge-surface flex flex-col flex-shrink-0">
        <div className="flex border-b border-forge-border">
          {[
            { id: 'attributes', label: '属性', icon: Sliders },
            { id: 'layers', label: '图层', icon: Layers },
            { id: 'templates', label: '模板', icon: LayoutTemplate },
          ].map(tab => (
            <button
              key={tab.id}
              className={cn(
                'flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all duration-200 border-b-2',
                rightTab === tab.id
                  ? 'text-forge-gold border-forge-gold'
                  : 'text-forge-text-secondary border-transparent hover:text-forge-text'
              )}
              onClick={() => setRightTab(tab.id as typeof rightTab)}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {rightTab === 'attributes' && activeCard && (
            <div className="animate-fade-in">
              {selectedElement ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-forge-text">元素属性</h3>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-forge-text-muted block mb-1">X</label>
                      <input
                        type="number"
                        className="input-field w-full text-xs py-1.5"
                        value={Math.round(selectedElement.x)}
                        onChange={e => handlePropertyChange('x', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-forge-text-muted block mb-1">Y</label>
                      <input
                        type="number"
                        className="input-field w-full text-xs py-1.5"
                        value={Math.round(selectedElement.y)}
                        onChange={e => handlePropertyChange('y', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-forge-text-muted block mb-1">宽度</label>
                      <input
                        type="number"
                        className="input-field w-full text-xs py-1.5"
                        value={Math.round(selectedElement.width)}
                        onChange={e => handlePropertyChange('width', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-forge-text-muted block mb-1">高度</label>
                      <input
                        type="number"
                        className="input-field w-full text-xs py-1.5"
                        value={Math.round(selectedElement.height)}
                        onChange={e => handlePropertyChange('height', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {selectedElement.type === 'text' && (
                    <>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">内容</label>
                        <input
                          type="text"
                          className="input-field w-full text-xs py-1.5"
                          value={selectedElement.content}
                          onChange={e => handlePropertyChange('content', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">字体</label>
                        <input
                          type="text"
                          className="input-field w-full text-xs py-1.5"
                          value={selectedElement.style.fontFamily || ''}
                          onChange={e => handleStyleChange('fontFamily', e.target.value)}
                          placeholder="默认"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">字号</label>
                        <input
                          type="number"
                          className="input-field w-full text-xs py-1.5"
                          value={selectedElement.style.fontSize || 14}
                          onChange={e => handleStyleChange('fontSize', Number(e.target.value))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-forge-text-muted block mb-1">颜色</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
                              value={selectedElement.style.color || '#F5E6C8'}
                              onChange={e => handleStyleChange('color', e.target.value)}
                            />
                            <input
                              type="text"
                              className="input-field flex-1 text-xs py-1.5"
                              value={selectedElement.style.color || '#F5E6C8'}
                              onChange={e => handleStyleChange('color', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-forge-text-muted block mb-1">字重</label>
                          <select
                            className="input-field w-full text-xs py-1.5"
                            value={selectedElement.style.fontWeight || '500'}
                            onChange={e => handleStyleChange('fontWeight', e.target.value)}
                          >
                            <option value="300">细</option>
                            <option value="400">常规</option>
                            <option value="500">中等</option>
                            <option value="600">半粗</option>
                            <option value="700">粗体</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {(selectedElement.type === 'rect' || selectedElement.type === 'circle') && (
                    <>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">填充色</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
                            value={selectedElement.style.backgroundColor || '#000000'}
                            onChange={e => handleStyleChange('backgroundColor', e.target.value)}
                          />
                          <input
                            type="text"
                            className="input-field flex-1 text-xs py-1.5"
                            value={selectedElement.style.backgroundColor || 'transparent'}
                            onChange={e => handleStyleChange('backgroundColor', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">边框色</label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
                            value={selectedElement.style.borderColor || '#D4A853'}
                            onChange={e => handleStyleChange('borderColor', e.target.value)}
                          />
                          <input
                            type="text"
                            className="input-field flex-1 text-xs py-1.5"
                            value={selectedElement.style.borderColor || '#D4A853'}
                            onChange={e => handleStyleChange('borderColor', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-forge-text-muted block mb-1">边框宽度</label>
                        <input
                          type="number"
                          className="input-field w-full text-xs py-1.5"
                          value={selectedElement.style.borderWidth || 2}
                          onChange={e => handleStyleChange('borderWidth', Number(e.target.value))}
                        />
                      </div>
                    </>
                  )}

                  {(selectedElement.type === 'line') && (
                    <div>
                      <label className="text-xs text-forge-text-muted block mb-1">颜色</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
                          value={selectedElement.style.backgroundColor || '#D4A853'}
                          onChange={e => handleStyleChange('backgroundColor', e.target.value)}
                        />
                        <input
                          type="text"
                          className="input-field flex-1 text-xs py-1.5"
                          value={selectedElement.style.backgroundColor || '#D4A853'}
                          onChange={e => handleStyleChange('backgroundColor', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-forge-text-muted block mb-1">透明度</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      className="w-full"
                      value={selectedElement.style.opacity ?? 1}
                      onChange={e => handleStyleChange('opacity', Number(e.target.value))}
                    />
                  </div>

                  <div className="pt-2 border-t border-forge-border">
                    <h4 className="text-xs text-forge-text-muted mb-2">图层操作</h4>
                    <div className="flex gap-2">
                      <button
                        className="flex-1 btn-outline text-xs py-1.5 flex items-center justify-center gap-1"
                        onClick={() => handleMoveLayer('up')}
                      >
                        <ChevronUp size={14} />
                        上移
                      </button>
                      <button
                        className="flex-1 btn-outline text-xs py-1.5 flex items-center justify-center gap-1"
                        onClick={() => handleMoveLayer('down')}
                      >
                        <ChevronDown size={14} />
                        下移
                      </button>
                      <button
                        className="btn-outline text-xs py-1.5 px-3 text-forge-crimson hover:bg-forge-crimson/10 hover:border-forge-crimson"
                        onClick={handleDeleteElement}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-forge-text-muted block mb-1">卡牌名称</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm py-1.5"
                      value={activeCard.name}
                      onChange={e => updateCard(activeCard.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-forge-text-muted block mb-1">卡牌编号</label>
                    <input
                      type="text"
                      className="input-field w-full text-sm py-1.5"
                      value={activeCard.number}
                      onChange={e => updateCard(activeCard.id, { number: e.target.value })}
                      placeholder="自动生成"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-forge-text-muted block mb-1">背景颜色</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
                        value={activeCard.background}
                        onChange={e => updateCard(activeCard.id, { background: e.target.value })}
                      />
                      <input
                        type="text"
                        className="input-field flex-1 text-sm py-1.5"
                        value={activeCard.background}
                        onChange={e => updateCard(activeCard.id, { background: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-forge-border">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-forge-text">卡牌属性</h3>
                      <button
                        className="text-xs text-forge-gold hover:text-forge-gold-light flex items-center gap-1"
                        onClick={() => addAttribute(activeCard.id, '新属性', '')}
                      >
                        <Plus size={12} />
                        添加
                      </button>
                    </div>

                    <div className="space-y-2">
                      {activeCard.attributes.map(attr => (
                        <div key={attr.id} className="flex gap-2 items-start">
                          <input
                            type="text"
                            className="input-field w-20 text-xs py-1.5 flex-shrink-0"
                            value={attr.label}
                            onChange={e => updateAttribute(activeCard.id, attr.id, { label: e.target.value })}
                            placeholder="标签"
                          />
                          <input
                            type="text"
                            className="input-field flex-1 text-xs py-1.5"
                            value={attr.value}
                            onChange={e => updateAttribute(activeCard.id, attr.id, { value: e.target.value })}
                            placeholder="值"
                          />
                          <button
                            className="p-1.5 rounded text-forge-text-muted hover:text-forge-crimson hover:bg-forge-crimson/10 transition-colors"
                            onClick={() => removeAttribute(activeCard.id, attr.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {activeCard.attributes.length === 0 && (
                        <div className="text-center text-forge-text-muted text-xs py-4">
                          暂无属性，点击上方添加
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {rightTab === 'layers' && (
            <div className="animate-fade-in">
              <div className="text-xs text-forge-text-muted mb-3">
                {activeSide === 'front' ? '正面' : '背面'}元素 ({elements.length})
              </div>
              {elements.length === 0 ? (
                <div className="text-center text-forge-text-muted text-xs py-8">
                  <Layers size={32} className="mx-auto mb-2 opacity-30" />
                  <p>暂无元素</p>
                  <p className="mt-1">使用左侧工具添加元素</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {[...elements].reverse().map((element, idx) => (
                    <div
                      key={element.id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-all duration-200',
                        selectedElementId === element.id
                          ? 'bg-forge-gold/15 text-forge-gold'
                          : 'text-forge-text-secondary hover:bg-forge-elevated hover:text-forge-text'
                      )}
                      onClick={() => setSelectedElementId(element.id)}
                    >
                      <div className="w-6 h-6 rounded bg-forge-elevated flex items-center justify-center text-xs">
                        {element.type === 'text' && <Type size={12} />}
                        {element.type === 'rect' && <Square size={12} />}
                        {element.type === 'circle' && <Circle size={12} />}
                        {element.type === 'line' && <Minus size={12} />}
                        {element.type === 'image' && <Image size={12} />}
                        {element.type === 'icon' && '✨'}
                      </div>
                      <span className="flex-1 text-xs truncate">
                        {element.type === 'text' ? element.content || '文本' :
                         element.type === 'rect' ? '矩形' :
                         element.type === 'circle' ? '圆形' :
                         element.type === 'line' ? '线条' :
                         element.type === 'image' ? '图片' :
                         element.type === 'icon' ? '图标' : '元素'}
                      </span>
                      <span className="text-[10px] text-forge-text-muted">
                        {elements.length - idx}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {rightTab === 'templates' && (
            <div className="animate-fade-in">
              <div className="grid grid-cols-1 gap-3">
                {CARD_TEMPLATES.map(template => (
                  <div
                    key={template.id}
                    className={cn(
                      'card-frame p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02]',
                      activeCard?.template === template.id && 'card-frame-gold'
                    )}
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    <div
                      className="w-full h-20 rounded-lg mb-2"
                      style={{ background: template.background }}
                    />
                    <div className="text-sm text-forge-text font-medium">{template.name}</div>
                    <div className="text-[10px] text-forge-text-muted mt-1">
                      {template.attrs.join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <Modal
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="批量编号"
      >
        <p className="text-forge-text-secondary text-sm mb-4">
          为项目中 {projectCards.length} 张卡牌批量生成编号
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-forge-text-muted block mb-1">前缀</label>
            <input
              type="text"
              className="input-field w-full"
              value={batchPrefix}
              onChange={e => setBatchPrefix(e.target.value)}
              placeholder="例如: CARD-"
            />
          </div>
          <div>
            <label className="text-xs text-forge-text-muted block mb-1">起始编号</label>
            <input
              type="number"
              min="1"
              className="input-field w-full"
              value={batchStart}
              onChange={e => setBatchStart(Number(e.target.value))}
            />
          </div>

          <div className="pt-2">
            <p className="text-xs text-forge-text-muted mb-2">预览效果</p>
            <div className="flex gap-2 flex-wrap">
              {projectCards.slice(0, 5).map((_, i) => (
                <span
                  key={i}
                  className="px-2 py-1 bg-forge-elevated rounded text-xs text-forge-gold font-mono"
                >
                  {batchPrefix}{String(batchStart + i).padStart(3, '0')}
                </span>
              ))}
              {projectCards.length > 5 && (
                <span className="px-2 py-1 text-xs text-forge-text-muted">
                  +{projectCards.length - 5} 更多
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-outline" onClick={() => setShowBatchModal(false)}>
            取消
          </button>
          <button className="btn-gold flex items-center gap-1.5" onClick={handleBatchNumber}>
            <Hash size={14} />
            应用编号
          </button>
        </div>
      </Modal>
    </div>
  )
}
