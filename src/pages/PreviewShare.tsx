import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Shuffle, Plus, RotateCcw, Eye, ChevronDown, Layers, Home, Share2 } from 'lucide-react'
import CardPreview from '@/components/CardPreview'
import type { Card, Deck, DeckCard, Project } from '@/types'
import { cn } from '@/lib/utils'

interface ShareData {
  project: Project
  cards: Card[]
  decks: Deck[]
  deckCards: DeckCard[]
  timestamp: number
}

const SHARE_STORAGE_KEY = 'cf_share_data'

interface DrawHistoryItem {
  id: string
  card: Card
  timestamp: number
}

export default function PreviewShare() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [drawPool, setDrawPool] = useState<string[]>([])
  const [drawnCards, setDrawnCards] = useState<DrawHistoryItem[]>([])
  const [currentCard, setCurrentCard] = useState<Card | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showBack, setShowBack] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const decoded = decodeURIComponent(dataParam)
        const parsed = JSON.parse(decoded) as ShareData
        setShareData(parsed)
        localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(parsed))
        setLoadError(null)
      } catch (e) {
        console.error('Failed to parse share data:', e)
        const saved = localStorage.getItem(SHARE_STORAGE_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ShareData
            setShareData(parsed)
            setLoadError('链接数据解析失败，已加载上次访问的分享数据')
          } catch {
            setLoadError('无法解析分享数据，请检查链接是否完整')
          }
        } else {
          setLoadError('无法解析分享数据，请检查链接是否完整')
        }
      }
    } else {
      const saved = localStorage.getItem(SHARE_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ShareData
          setShareData(parsed)
        } catch {
          setLoadError('没有找到分享数据')
        }
      } else {
        setLoadError('没有找到分享数据')
      }
    }
  }, [searchParams])

  const project = shareData?.project
  const cards = shareData?.cards || []
  const decks = shareData?.decks || []
  const deckCards = shareData?.deckCards || []

  const getCard = useCallback((cardId: string) => {
    return cards.find(c => c.id === cardId) || null
  }, [cards])

  const getDeckCards = useCallback((deckId: string) => {
    return deckCards.filter(dc => dc.deckId === deckId)
  }, [deckCards])

  const getDeckTotal = useCallback((deckId: string) => {
    return getDeckCards(deckId).reduce((sum, dc) => sum + dc.quantity, 0)
  }, [getDeckCards])

  const selectedDeck = useMemo(() => decks.find(d => d.id === selectedDeckId), [decks, selectedDeckId])
  const selectedDeckCards = useMemo(() => selectedDeckId ? getDeckCards(selectedDeckId) : [], [selectedDeckId, getDeckCards])
  const deckTotal = selectedDeckId ? getDeckTotal(selectedDeckId) : 0

  useEffect(() => {
    if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id)
    }
  }, [decks, selectedDeckId])

  const buildDrawPool = useCallback(() => {
    if (!selectedDeckId) return []
    const pool: string[] = []
    selectedDeckCards.forEach(dc => {
      for (let i = 0; i < dc.quantity; i++) {
        pool.push(dc.cardId)
      }
    })
    return pool
  }, [selectedDeckId, selectedDeckCards])

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

  const handleGoHome = () => {
    navigate('/')
  }

  if (loadError && !shareData) {
    return (
      <div className="min-h-screen bg-forge-bg flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-forge-elevated flex items-center justify-center">
            <Share2 size={32} className="text-forge-text-muted" />
          </div>
          <h1 className="text-xl font-display text-forge-text mb-3">分享链接无效</h1>
          <p className="text-forge-text-secondary text-sm mb-6">{loadError}</p>
          <button
            className="btn-gold"
            onClick={handleGoHome}
          >
            <Home size={16} className="inline mr-2" />
            返回首页
          </button>
        </div>
      </div>
    )
  }

  if (!shareData) {
    return (
      <div className="min-h-screen bg-forge-bg flex items-center justify-center">
        <div className="text-forge-text-muted">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-forge-bg flex flex-col">
      <header className="border-b border-forge-border bg-forge-surface/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-forge-gold/20 flex items-center justify-center">
              <Share2 size={20} className="text-forge-gold" />
            </div>
            <div>
              <h1 className="text-lg font-display text-forge-text">{project?.name || '分享试玩'}</h1>
              <p className="text-xs text-forge-text-muted">卡牌设计工坊 · 分享试玩</p>
            </div>
          </div>
          <button
            className="btn-outline text-sm"
            onClick={handleGoHome}
          >
            <Home size={14} className="inline mr-1.5" />
            返回首页
          </button>
        </div>
      </header>

      {loadError && (
        <div className="bg-forge-gold/10 border-b border-forge-gold/30 px-6 py-2 text-center">
          <p className="text-sm text-forge-gold">{loadError}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border bg-forge-surface/30 max-w-6xl mx-auto w-full">
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
              <span className="bg-forge-elevated px-2 py-1 rounded">{selectedDeckCards.length} 种</span>
              <span className="bg-forge-elevated px-2 py-1 rounded">{deckTotal} 张</span>
              <span className="bg-forge-elevated px-2 py-1 rounded">剩余 {drawPool.length}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
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
      </div>

      <footer className="border-t border-forge-border bg-forge-surface/50 py-3">
        <div className="max-w-6xl mx-auto px-6 text-center text-xs text-forge-text-muted">
          由卡牌设计工坊生成 · 所有数据保存在本地浏览器中
        </div>
      </footer>
    </div>
  )
}
