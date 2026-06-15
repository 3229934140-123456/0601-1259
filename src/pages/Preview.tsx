import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Shuffle, Plus, RotateCcw, Eye, AlertTriangle, ChevronDown, Layers } from 'lucide-react'
import { useDeckStore } from '@/stores/deckStore'
import { useCardStore } from '@/stores/cardStore'
import { useProjectStore } from '@/stores/projectStore'
import CardPreview from '@/components/CardPreview'
import type { Card, CardElement } from '@/types'
import { cn } from '@/lib/utils'

interface DrawHistoryItem {
  id: string
  card: Card
  timestamp: number
}

interface OverflowCard {
  card: Card
  overflowElements: { id: string; side: 'front' | 'back'; type: string }[]
}

export default function Preview() {
  const { projectId } = useParams()
  const decks = useDeckStore(s => s.decks)
  const { loadDecks, getDeckCards, getDeckTotal } = useDeckStore()
  const { loadCards, getProjectCards, getCard } = useCardStore()
  const getProject = useProjectStore(s => s.getProject)

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [drawPool, setDrawPool] = useState<string[]>([])
  const [drawnCards, setDrawnCards] = useState<DrawHistoryItem[]>([])
  const [currentCard, setCurrentCard] = useState<Card | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showBack, setShowBack] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [overflowCards, setOverflowCards] = useState<OverflowCard[]>([])
  const [showOverflowList, setShowOverflowList] = useState(false)
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadDecks(projectId)
      loadCards(projectId)
    }
  }, [projectId, loadDecks, loadCards])

  useEffect(() => {
    if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id)
    }
  }, [decks, selectedDeckId])

  const project = projectId ? getProject(projectId) : null
  const projectCards = useMemo(() => projectId ? getProjectCards(projectId) : [], [projectId, getProjectCards])
  const selectedDeck = decks.find(d => d.id === selectedDeckId)
  const deckCards = useMemo(() => selectedDeckId ? getDeckCards(selectedDeckId) : [], [selectedDeckId, getDeckCards])
  const deckTotal = selectedDeckId ? getDeckTotal(selectedDeckId) : 0

  const buildDrawPool = useCallback(() => {
    if (!selectedDeckId) return []
    const pool: string[] = []
    deckCards.forEach(dc => {
      for (let i = 0; i < dc.quantity; i++) {
        pool.push(dc.cardId)
      }
    })
    return pool
  }, [selectedDeckId, deckCards])

  useEffect(() => {
    if (selectedDeckId) {
      const pool = buildDrawPool()
      setDrawPool(pool)
      setDrawnCards([])
      setCurrentCard(null)
      setIsFlipped(false)
      setShowBack(false)
    }
  }, [selectedDeckId, buildDrawPool])

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleShuffle = useCallback(() => {
    if (drawPool.length === 0) return
    setIsShuffling(true)
    setTimeout(() => {
      setDrawPool(shuffleArray(drawPool))
      setIsShuffling(false)
    }, 600)
  }, [drawPool])

  const handleDraw = useCallback(() => {
    if (drawPool.length === 0 || isDrawing) return
    setIsDrawing(true)
    const [first, ...rest] = drawPool
    const card = getCard(first)
    if (card) {
      setCurrentCard(card)
      setIsFlipped(false)
      setShowBack(false)
      setDrawnCards(prev => [{ id: `${Date.now()}-${Math.random()}`, card, timestamp: Date.now() }, ...prev])
    }
    setDrawPool(rest)
    setTimeout(() => {
      setIsDrawing(false)
    }, 400)
  }, [drawPool, getCard, isDrawing])

  const handleReturnToDeck = useCallback((historyId: string) => {
    const item = drawnCards.find(d => d.id === historyId)
    if (!item) return
    setDrawnCards(prev => prev.filter(d => d.id !== historyId))
    setDrawPool(prev => [...prev, item.card.id])
    if (currentCard?.id === item.card.id) {
      setCurrentCard(null)
    }
  }, [drawnCards, currentCard])

  const handleFlip = useCallback(() => {
    setIsFlipped(true)
    setTimeout(() => {
      setShowBack(prev => !prev)
      setIsFlipped(false)
    }, 300)
  }, [])

  const handleCheckOverflow = useCallback(() => {
    if (!project) return
    const { cardWidth, cardHeight } = project
    const results: OverflowCard[] = []

    projectCards.forEach(card => {
      const overflow: { id: string; side: 'front' | 'back'; type: string }[] = []

      const checkElements = (elements: CardElement[], side: 'front' | 'back') => {
        elements.forEach(el => {
          if (el.type === 'text') {
            const right = el.x + (el.width || 0)
            const bottom = el.y + (el.height || 0)
            if (right > cardWidth || bottom > cardHeight || el.x < 0 || el.y < 0) {
              overflow.push({ id: el.id, side, type: el.type })
            }
          }
        })
      }

      checkElements(card.frontElements, 'front')
      checkElements(card.backElements, 'back')

      if (overflow.length > 0) {
        results.push({ card, overflowElements: overflow })
      }
    })

    setOverflowCards(results)
    setShowOverflowList(true)
  }, [project, projectCards])

  const handleJumpToCard = useCallback((card: Card) => {
    const cardId = deckCards.find(dc => dc.cardId === card.id)?.cardId
    if (cardId && !drawPool.includes(cardId)) {
      const historyItem = drawnCards.find(d => d.card.id === cardId)
      if (historyItem) {
        handleReturnToDeck(historyItem.id)
      }
    }
    setTimeout(() => {
      const index = drawPool.indexOf(card.id)
      if (index > 0) {
        const newPool = [...drawPool]
        const [moved] = newPool.splice(index, 1)
        newPool.unshift(moved)
        setDrawPool(newPool)
      }
      handleDraw()
    }, 100)
  }, [drawPool, drawnCards, deckCards, handleReturnToDeck, handleDraw])

  return (
    <div className="h-full flex flex-col bg-forge-bg">
      <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border bg-forge-surface/50">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 bg-forge-elevated border border-forge-border rounded-lg text-forge-text hover:border-forge-gold transition-colors min-w-[180px]"
              onClick={() => setDeckDropdownOpen(!deckDropdownOpen)}
            >
              <Layers size={16} className="text-forge-gold" />
              <span className="flex-1 text-left text-sm">
                {selectedDeck?.name || '选择牌组'}
              </span>
              <ChevronDown size={16} className={cn('text-forge-text-muted transition-transform', deckDropdownOpen && 'rotate-180')} />
            </button>
            {deckDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-forge-surface border border-forge-border rounded-lg shadow-xl z-50 overflow-hidden">
                {decks.map(deck => {
                  const total = getDeckTotal(deck.id)
                  return (
                    <button
                      key={deck.id}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-forge-elevated transition-colors',
                        deck.id === selectedDeckId ? 'bg-forge-gold/10 text-forge-gold' : 'text-forge-text'
                      )}
                      onClick={() => {
                        setSelectedDeckId(deck.id)
                        setDeckDropdownOpen(false)
                      }}
                    >
                      <span>{deck.name}</span>
                      <span className="text-forge-text-muted text-xs">{total} 张</span>
                    </button>
                  )
                })}
                {decks.length === 0 && (
                  <div className="px-4 py-3 text-sm text-forge-text-muted text-center">
                    暂无牌组
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-forge-text-muted">
            <span className="bg-forge-elevated px-2 py-1 rounded">{deckCards.length} 种</span>
            <span className="bg-forge-elevated px-2 py-1 rounded">{deckTotal} 张</span>
            <span className="bg-forge-elevated px-2 py-1 rounded">剩余 {drawPool.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-outline flex items-center gap-1.5 text-sm py-1.5 px-4"
            onClick={handleCheckOverflow}
          >
            <AlertTriangle size={14} />
            检查溢出
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="mb-8 flex items-center gap-4">
            <button
              className={cn(
                'btn-gold flex items-center gap-2',
                (drawPool.length === 0 || isShuffling) && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleShuffle}
              disabled={drawPool.length === 0 || isShuffling}
            >
              <Shuffle size={16} className={isShuffling ? 'animate-spin' : ''} />
              洗牌
            </button>
            <button
              className={cn(
                'btn-gold flex items-center gap-2',
                (drawPool.length === 0 || isDrawing) && 'opacity-50 cursor-not-allowed'
              )}
              onClick={handleDraw}
              disabled={drawPool.length === 0 || isDrawing}
            >
              <Plus size={16} />
              抽牌
            </button>
          </div>

          <div className="relative w-[280px] h-[390px] flex items-center justify-center">
            {drawPool.length > 0 && (
              <div className="absolute left-[-120px] top-1/2 -translate-y-1/2">
                <div className="relative w-[80px] h-[112px]">
                  {Array.from({ length: Math.min(5, drawPool.length) }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'absolute w-full h-full rounded-lg border border-forge-border shadow-lg',
                        isShuffling && 'card-flip'
                      )}
                      style={{
                        background: `linear-gradient(135deg, #2E2824, #1A1614)`,
                        transform: `translate(${i * 2}px, ${-i * 2}px) rotate(${i * 0.5}deg)`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    >
                      <div className="absolute inset-2 border border-forge-gold/30 rounded" />
                    </div>
                  ))}
                </div>
                <div className="text-center mt-2 text-xs text-forge-text-muted">
                  牌堆 {drawPool.length}
                </div>
              </div>
            )}

            <div className="perspective-1000">
              {currentCard ? (
                <div
                  className={cn(
                    'relative cursor-pointer transition-transform duration-300',
                    isDrawing && 'draw-card',
                    isFlipped && 'card-flip'
                  )}
                  style={{ transformStyle: 'preserve-3d' }}
                  onClick={handleFlip}
                >
                  <CardPreview
                    card={currentCard}
                    width={200}
                    side={showBack ? 'back' : 'front'}
                    showNumber={true}
                  />
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-forge-text-muted whitespace-nowrap">
                    {currentCard.name} · {showBack ? '背面' : '正面'}
                  </div>
                </div>
              ) : (
                <div className="w-[200px] h-[279px] rounded-lg border-2 border-dashed border-forge-border flex items-center justify-center text-forge-text-muted">
                  <div className="text-center">
                    <Eye size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">点击抽牌</p>
                  </div>
                </div>
              )}
            </div>

            {currentCard && (
              <div className="absolute right-[-100px] top-1/2 -translate-y-1/2 flex flex-col gap-3">
                <div className="text-center">
                  <CardPreview
                    card={currentCard}
                    width={60}
                    side="front"
                    showNumber={false}
                  />
                  <div className="text-[10px] text-forge-text-muted mt-1">正面</div>
                </div>
                <div className="text-center">
                  <CardPreview
                    card={currentCard}
                    width={60}
                    side="back"
                    showNumber={false}
                  />
                  <div className="text-[10px] text-forge-text-muted mt-1">背面</div>
                </div>
                <button
                  className="mt-2 flex items-center justify-center gap-1 text-xs text-forge-gold hover:text-forge-gold-light transition-colors"
                  onClick={handleFlip}
                >
                  <RotateCcw size={12} />
                  翻转
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-[320px] border-l border-forge-border bg-forge-surface/30 flex flex-col">
          <div className="px-4 py-3 border-b border-forge-border bg-forge-surface/50">
            <h3 className="text-sm font-medium text-forge-text flex items-center gap-2">
              <Layers size={14} className="text-forge-gold" />
              抽牌历史
              <span className="text-xs text-forge-text-muted ml-1">({drawnCards.length})</span>
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {drawnCards.length === 0 ? (
              <div className="text-center text-forge-text-muted text-sm py-8">
                <p>暂无抽牌记录</p>
                <p className="text-xs mt-1 opacity-60">点击"抽牌"开始</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drawnCards.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg border transition-all group',
                      currentCard?.id === item.card.id
                        ? 'border-forge-gold bg-forge-gold/10'
                        : 'border-forge-border bg-forge-elevated/50 hover:border-forge-gold/50'
                    )}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardPreview card={item.card} width={36} showNumber={false} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-forge-text truncate">{item.card.name}</div>
                      <div className="text-[10px] text-forge-text-muted">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-forge-crimson/30 text-forge-text-muted hover:text-forge-crimson transition-all"
                      onClick={() => handleReturnToDeck(item.id)}
                      title="放回牌堆"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showOverflowList && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowOverflowList(false)}>
          <div className="bg-forge-surface border border-forge-border rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-forge-border flex items-center justify-between">
              <h3 className="text-lg font-medium text-forge-text flex items-center gap-2">
                <AlertTriangle size={18} className="text-forge-crimson" />
                文字溢出检查结果
              </h3>
              <button
                className="text-forge-text-muted hover:text-forge-text"
                onClick={() => setShowOverflowList(false)}
              >
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {overflowCards.length === 0 ? (
                <div className="text-center py-8 text-forge-text-muted">
                  <div className="text-4xl mb-2">✓</div>
                  <p>所有卡牌文字都在边界内</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-forge-text-secondary mb-4">
                    发现 <span className="text-forge-crimson font-medium">{overflowCards.length}</span> 张卡牌存在文字溢出
                  </p>
                  <div className="space-y-3">
                    {overflowCards.map(({ card, overflowElements }) => (
                      <div
                        key={card.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-forge-elevated border border-forge-crimson/30 hover:border-forge-crimson/60 transition-colors cursor-pointer group"
                        onClick={() => {
                          handleJumpToCard(card)
                          setShowOverflowList(false)
                        }}
                      >
                        <CardPreview card={card} width={48} showNumber={false} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-forge-text font-medium">{card.name}</div>
                          <div className="text-xs text-forge-crimson mt-0.5">
                            {overflowElements.length} 处溢出
                            {overflowElements.map((el, i) => (
                              <span key={i} className="ml-2 text-forge-text-muted">
                                {el.side === 'front' ? '正面' : '背面'}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-forge-gold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          点击跳转 →
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t border-forge-border flex justify-end">
              <button className="btn-gold" onClick={() => setShowOverflowList(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
