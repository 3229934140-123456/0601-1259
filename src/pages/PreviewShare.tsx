import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Shuffle, Plus, RotateCcw, Eye, ChevronDown, Layers, Home, Share2, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react'
import CardPreview from '@/components/CardPreview'
import type { Card, Deck, DeckCard, Project, Rule, RuleChapter } from '@/types'
import { cn } from '@/lib/utils'

interface ShareData {
  project: Project
  cards: Card[]
  decks: Deck[]
  deckCards: DeckCard[]
  rule?: Rule
  chapters?: RuleChapter[]
  timestamp: number
}

const SHARE_STORAGE_KEY = 'cf_share_data'
const SHARE_STATE_KEY_PREFIX = 'cf_share_state_'

interface DrawHistoryItem {
  id: string
  card: Card
  timestamp: number
  isFlipped: boolean
  showBack: boolean
}

interface ShareState {
  selectedDeckId: string | null
  drawPool: string[]
  drawnCards: DrawHistoryItem[]
  currentCardId: string | null
  isFlipped: boolean
  showBack: boolean
  lastUpdated: number
}

const defaultShareState: ShareState = {
  selectedDeckId: null,
  drawPool: [],
  drawnCards: [],
  currentCardId: null,
  isFlipped: false,
  showBack: false,
  lastUpdated: 0,
}

const getShareIdentity = (data: ShareData | null): string => {
  if (!data) return 'default'
  return `${data.project.id}_${data.timestamp}`
}

const getShareStateKey = (identity: string): string => {
  return `${SHARE_STATE_KEY_PREFIX}${identity}`
}

export default function PreviewShare() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [shareState, setShareState] = useState<ShareState>(defaultShareState)
  const [isShuffling, setIsShuffling] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRuleSummary, setShowRuleSummary] = useState(false)

  const shareIdentity = useMemo(() => getShareIdentity(shareData), [shareData])

  const saveShareState = useCallback((state: ShareState) => {
    try {
      const key = getShareStateKey(shareIdentity)
      localStorage.setItem(key, JSON.stringify({
        ...state,
        lastUpdated: Date.now(),
      }))
    } catch (e) {
      console.error('Failed to save share state:', e)
    }
  }, [shareIdentity])

  const loadShareState = useCallback((identity: string): ShareState | null => {
    try {
      const key = getShareStateKey(identity)
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Date.now() - parsed.lastUpdated < 24 * 60 * 60 * 1000) {
          return parsed
        }
      }
    } catch (e) {
      console.error('Failed to load share state:', e)
    }
    return null
  }, [])

  useEffect(() => {
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const decoded = decodeURIComponent(dataParam)
        const parsed = JSON.parse(decoded) as ShareData
        setShareData(parsed)
        localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(parsed))
        setLoadError(null)

        const identity = getShareIdentity(parsed)
        const savedState = loadShareState(identity)
        if (savedState) {
          setShareState(savedState)
        } else {
          setShareState(defaultShareState)
        }
      } catch (e) {
        console.error('Failed to parse share data:', e)
        const saved = localStorage.getItem(SHARE_STORAGE_KEY)
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ShareData
            setShareData(parsed)
            setLoadError('链接数据解析失败，已加载上次访问的分享数据')

            const identity = getShareIdentity(parsed)
            const savedState = loadShareState(identity)
            if (savedState) {
              setShareState(savedState)
            } else {
              setShareState(defaultShareState)
            }
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

          const identity = getShareIdentity(parsed)
          const savedState = loadShareState(identity)
          if (savedState) {
            setShareState(savedState)
          } else {
            setShareState(defaultShareState)
          }
        } catch {
          setLoadError('没有找到分享数据')
        }
      } else {
        setLoadError('没有找到分享数据')
      }
    }
  }, [searchParams, loadShareState])

  const project = shareData?.project
  const cards = shareData?.cards || []
  const decks = shareData?.decks || []
  const deckCards = shareData?.deckCards || []
  const chapters = shareData?.chapters || []

  const projectCover = useMemo(() => {
    if (project?.thumbnail) {
      return project.thumbnail
    }
    const firstCard = cards[0]
    const bgColor = firstCard?.background || '#2E2824'
    const accentColor = '#d4a853'
    const initialChar = (project?.name || '卡').charAt(0)
    const cardCount = cards.length
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${bgColor}" />
            <stop offset="100%" stop-color="#1A1614" />
          </linearGradient>
        </defs>
        <rect width="112" height="112" rx="8" fill="url(#g)" />
        <rect x="8" y="8" width="96" height="96" rx="6" fill="none" stroke="${accentColor}" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.4" />
        <text x="56" y="58" text-anchor="middle" font-family="serif" font-size="40" font-weight="bold" fill="${accentColor}" opacity="0.9">${initialChar}</text>
        <text x="56" y="86" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#ffffff" opacity="0.7">${cardCount} 张卡牌</text>
        <rect x="40" y="94" width="32" height="2" rx="1" fill="${accentColor}" opacity="0.6" />
      </svg>
    `
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [project?.thumbnail, project?.name, cards])

  const getCard = useCallback((cardId: string) => {
    return cards.find(c => c.id === cardId) || null
  }, [cards])

  const getDeckCards = useCallback((deckId: string) => {
    return deckCards.filter(dc => dc.deckId === deckId)
  }, [deckCards])

  const getDeckTotal = useCallback((deckId: string) => {
    return getDeckCards(deckId).reduce((sum, dc) => sum + dc.quantity, 0)
  }, [getDeckCards])

  const selectedDeck = useMemo(() => decks.find(d => d.id === shareState.selectedDeckId), [decks, shareState.selectedDeckId])
  const selectedDeckCards = useMemo(() => shareState.selectedDeckId ? getDeckCards(shareState.selectedDeckId) : [], [shareState.selectedDeckId, getDeckCards])
  const deckTotal = shareState.selectedDeckId ? getDeckTotal(shareState.selectedDeckId) : 0
  const currentCard = useMemo(() => shareState.currentCardId ? getCard(shareState.currentCardId) : null, [shareState.currentCardId, getCard])

  useEffect(() => {
    if (decks.length > 0 && !shareState.selectedDeckId) {
      const newState = {
        ...shareState,
        selectedDeckId: decks[0].id,
      }
      setShareState(newState)
      saveShareState(newState)
    }
  }, [decks, shareState, saveShareState])

  const buildDrawPool = useCallback(() => {
    if (!shareState.selectedDeckId) return []
    const pool: string[] = []
    selectedDeckCards.forEach(dc => {
      for (let i = 0; i < dc.quantity; i++) {
        pool.push(dc.cardId)
      }
    })
    return pool
  }, [shareState.selectedDeckId, selectedDeckCards])

  useEffect(() => {
    if (shareState.selectedDeckId && shareState.drawPool.length === 0 && shareState.drawnCards.length === 0) {
      const pool = buildDrawPool()
      const newState = {
        ...shareState,
        drawPool: pool,
      }
      setShareState(newState)
      saveShareState(newState)
    }
  }, [shareState.selectedDeckId, shareState.drawPool.length, shareState.drawnCards.length, buildDrawPool, shareState, saveShareState])

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const handleShuffle = useCallback(() => {
    if (shareState.drawPool.length === 0) return
    setIsShuffling(true)
    setTimeout(() => {
      const newState = {
        ...shareState,
        drawPool: shuffleArray(shareState.drawPool),
      }
      setShareState(newState)
      saveShareState(newState)
      setIsShuffling(false)
    }, 600)
  }, [shareState, saveShareState])

  const handleDraw = useCallback(() => {
    if (shareState.drawPool.length === 0 || isDrawing) return
    setIsDrawing(true)
    const [first, ...rest] = shareState.drawPool
    const card = getCard(first)
    if (card) {
      const newDrawnCard: DrawHistoryItem = {
        id: `${Date.now()}-${Math.random()}`,
        card,
        timestamp: Date.now(),
        isFlipped: false,
        showBack: false,
      }
      const newState = {
        ...shareState,
        drawPool: rest,
        drawnCards: [newDrawnCard, ...shareState.drawnCards],
        currentCardId: card.id,
        isFlipped: false,
        showBack: false,
      }
      setShareState(newState)
      saveShareState(newState)
    }
    setTimeout(() => {
      setIsDrawing(false)
    }, 400)
  }, [shareState, getCard, isDrawing, saveShareState])

  const handleReturnToDeck = useCallback((historyId: string) => {
    const item = shareState.drawnCards.find(d => d.id === historyId)
    if (!item) return
    const newDrawnCards = shareState.drawnCards.filter(d => d.id !== historyId)
    const newState = {
      ...shareState,
      drawnCards: newDrawnCards,
      drawPool: [...shareState.drawPool, item.card.id],
      currentCardId: shareState.currentCardId === item.card.id ? (newDrawnCards.length > 0 ? newDrawnCards[0].card.id : null) : shareState.currentCardId,
    }
    setShareState(newState)
    saveShareState(newState)
  }, [shareState, saveShareState])

  const handleFlip = useCallback(() => {
    const newShowBack = !shareState.showBack
    const newState = {
      ...shareState,
      isFlipped: true,
      showBack: newShowBack,
    }
    setShareState(newState)
    saveShareState(newState)

    setTimeout(() => {
      const finalState = {
        ...newState,
        isFlipped: false,
      }
      setShareState(finalState)
      saveShareState(finalState)
    }, 300)
  }, [shareState, saveShareState])

  const handleResetDeck = useCallback(() => {
    const pool = buildDrawPool()
    const newState = {
      ...shareState,
      drawPool: pool,
      drawnCards: [],
      currentCardId: null,
      isFlipped: false,
      showBack: false,
    }
    setShareState(newState)
    saveShareState(newState)
  }, [shareState, buildDrawPool, saveShareState])

  const handleGoHome = () => {
    navigate('/')
  }

  const getRuleSummary = () => {
    if (!chapters || chapters.length === 0) return null
    const sorted = [...chapters].sort((a, b) => a.order - b.order)
    return sorted.slice(0, 3).map(ch => ({
      title: ch.title,
      preview: ch.content.replace(/<[^>]*>/g, '').slice(0, 80),
      hasContent: ch.content.length > 0,
    }))
  }

  const ruleSummary = getRuleSummary()

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
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-forge-border shadow-lg flex-shrink-0">
              <img src={projectCover} alt={project?.name || '项目封面'} className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-display text-forge-text">{project?.name || '分享试玩'}</h1>
              <p className="text-xs text-forge-text-muted">卡牌设计工坊 · 分享试玩</p>
              {chapters && chapters.length > 0 && (
                <button
                  className="text-xs text-forge-gold hover:text-forge-gold-light mt-0.5 flex items-center gap-1"
                  onClick={() => setShowRuleSummary(!showRuleSummary)}
                >
                  <BookOpen size={12} />
                  查看规则摘要 ({chapters.length}章)
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn-outline text-sm"
              onClick={handleGoHome}
            >
              <Home size={14} className="inline mr-1.5" />
              返回首页
            </button>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="bg-forge-gold/10 border-b border-forge-gold/30 px-6 py-2 text-center">
          <p className="text-sm text-forge-gold">{loadError}</p>
        </div>
      )}

      {showRuleSummary && ruleSummary && (
        <div className="bg-forge-surface border-b border-forge-border px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <h3 className="text-sm font-medium text-forge-text mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-forge-gold" />
              规则摘要
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ruleSummary.map((item, idx) => (
                <div key={idx} className="bg-forge-elevated rounded-lg p-3">
                  <h4 className="text-sm font-medium text-forge-gold mb-1">{item.title}</h4>
                  {item.hasContent ? (
                    <p className="text-xs text-forge-text-secondary">{item.preview}...</p>
                  ) : (
                    <p className="text-xs text-forge-text-muted italic">暂无内容</p>
                  )}
                </div>
              ))}
            </div>
            {chapters.length > 3 && (
              <p className="text-xs text-forge-text-muted mt-2">还有 {chapters.length - 3} 个章节...</p>
            )}
          </div>
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
                          deck.id === shareState.selectedDeckId ? 'bg-forge-gold/10 text-forge-gold' : 'text-forge-text'
                        )}
                        onClick={() => {
                          const newState = {
                            ...defaultShareState,
                            selectedDeckId: deck.id,
                          }
                          setShareState(newState)
                          saveShareState(newState)
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
              <span className="bg-forge-elevated px-2 py-1 rounded">剩余 {shareState.drawPool.length}</span>
              <span className="bg-forge-elevated px-2 py-1 rounded">已抽 {shareState.drawnCards.length}</span>
            </div>
          </div>

          <button
            className="text-xs text-forge-text-secondary hover:text-forge-crimson flex items-center gap-1"
            onClick={handleResetDeck}
          >
            <RotateCcw size={12} />
            重置牌组
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full">
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="mb-8 flex items-center gap-4">
              <button
                className={cn(
                  'btn-gold flex items-center gap-2',
                  (shareState.drawPool.length === 0 || isShuffling) && 'opacity-50 cursor-not-allowed'
                )}
                onClick={handleShuffle}
                disabled={shareState.drawPool.length === 0 || isShuffling}
              >
                <Shuffle size={16} className={isShuffling ? 'animate-spin' : ''} />
                洗牌
              </button>
              <button
                className={cn(
                  'btn-gold flex items-center gap-2',
                  (shareState.drawPool.length === 0 || isDrawing) && 'opacity-50 cursor-not-allowed'
                )}
                onClick={handleDraw}
                disabled={shareState.drawPool.length === 0 || isDrawing}
              >
                <Plus size={16} />
                抽牌
              </button>
            </div>

            <div className="relative w-[280px] h-[390px] flex items-center justify-center">
              {shareState.drawPool.length > 0 && (
                <div className="absolute left-[-120px] top-1/2 -translate-y-1/2">
                  <div className="relative w-[80px] h-[112px]">
                    {Array.from({ length: Math.min(5, shareState.drawPool.length) }).map((_, i) => (
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
                    牌堆 {shareState.drawPool.length}
                  </div>
                </div>
              )}

              <div className="perspective-1000">
                {currentCard ? (
                  <div
                    className={cn(
                      'relative cursor-pointer transition-transform duration-300',
                      isDrawing && 'draw-card',
                      shareState.isFlipped && 'card-flip'
                    )}
                    style={{ transformStyle: 'preserve-3d' }}
                    onClick={handleFlip}
                  >
                    <CardPreview
                      card={currentCard}
                      width={200}
                      side={shareState.showBack ? 'back' : 'front'}
                      showNumber={true}
                    />
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-forge-text-muted whitespace-nowrap">
                      {currentCard.name} · {shareState.showBack ? '背面' : '正面'}
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
            <div className="px-4 py-3 border-b border-forge-border bg-forge-surface/50 flex items-center justify-between">
              <h3 className="text-sm font-medium text-forge-text flex items-center gap-2">
                <Layers size={14} className="text-forge-gold" />
                抽牌历史
                <span className="text-xs text-forge-text-muted ml-1">({shareState.drawnCards.length})</span>
              </h3>
              {shareState.drawnCards.length > 0 && (
                <button
                  className="text-[10px] text-forge-text-muted hover:text-forge-crimson"
                  onClick={handleResetDeck}
                  title="全部放回"
                >
                  全部放回
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {shareState.drawnCards.length === 0 ? (
                <div className="text-center text-forge-text-muted text-sm py-8">
                  <p>暂无抽牌记录</p>
                  <p className="text-xs mt-1 opacity-60">点击"抽牌"开始</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shareState.drawnCards.map((item, index) => (
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
                      <div className="relative">
                        <CardPreview card={item.card} width={36} showNumber={false} side={item.showBack ? 'back' : 'front'} />
                        {item.showBack && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full text-[8px] text-white flex items-center justify-center">
                            背
                          </div>
                        )}
                      </div>
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

            <div className="px-4 py-3 border-t border-forge-border bg-forge-surface/50">
              <div className="flex items-center gap-2 text-[10px] text-forge-text-muted">
                <CheckCircle size={12} className="text-green-400" />
                <span>抽牌记录和翻面状态已自动保存，刷新页面后可继续</span>
              </div>
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
