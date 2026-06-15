import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Minus, Palette, Layers, Search, X, Check } from 'lucide-react'
import { useDeckStore } from '@/stores/deckStore'
import { useCardStore } from '@/stores/cardStore'
import { useProjectStore } from '@/stores/projectStore'
import CardPreview from '@/components/CardPreview'
import Modal, { ConfirmModal } from '@/components/Modal'

export default function Decks() {
  const { projectId } = useParams()
  const decks = useDeckStore(s => s.decks)
  const allDeckCards = useDeckStore(s => s.deckCards)
  const {
    loadDecks,
    addDeck,
    deleteDeck,
    updateDeck,
    addCardToDeck,
    removeCardFromDeck,
    updateQuantity,
    getDeckCards,
    getDeckTotal,
  } = useDeckStore()
  const {
    loadCards,
    getProjectCards,
    getCard,
    replaceBackground,
  } = useCardStore()
  const getProject = useProjectStore(s => s.getProject)

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [bgColor, setBgColor] = useState('#2E2824')
  const [showBgPreview, setShowBgPreview] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (projectId) {
      loadDecks(projectId)
      loadCards(projectId)
    }
  }, [projectId, loadDecks, loadCards])

  const project = projectId ? getProject(projectId) : null
  const projectCards = projectId ? getProjectCards(projectId) : []
  const selectedDeck = decks.find(d => d.id === selectedDeckId)
  const deckCards = selectedDeckId ? getDeckCards(selectedDeckId) : []
  const deckTotal = selectedDeckId ? getDeckTotal(selectedDeckId) : 0

  const cardsInDeck = new Set(deckCards.map(dc => dc.cardId))
  const availableCards = projectCards.filter(c => !cardsInDeck.has(c.id))
  const filteredAvailable = searchQuery
    ? availableCards.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableCards

  const handleAddDeck = useCallback(() => {
    if (!projectId) return
    const id = addDeck(projectId, `牌组 ${decks.length + 1}`)
    setSelectedDeckId(id)
  }, [projectId, decks.length, addDeck])

  const handleRename = useCallback((deckId: string) => {
    if (!editingName.trim()) {
      setEditingDeckId(null)
      return
    }
    updateDeck(deckId, { name: editingName.trim() })
    setEditingDeckId(null)
  }, [editingName, updateDeck])

  const handleDeleteDeck = useCallback(() => {
    if (!deleteConfirm) return
    deleteDeck(deleteConfirm.id)
    if (selectedDeckId === deleteConfirm.id) {
      setSelectedDeckId(decks.length > 1 ? decks.find(d => d.id !== deleteConfirm.id)?.id || null : null)
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, deleteDeck, selectedDeckId, decks])

  const handleQuantityChange = useCallback((deckId: string, cardId: string, delta: number) => {
    const dc = getDeckCards(deckId).find(d => d.cardId === cardId)
    if (!dc) return
    const newQty = dc.quantity + delta
    if (newQty < 1) return
    updateQuantity(deckId, cardId, newQty)
  }, [getDeckCards, updateQuantity])

  const handleReplaceBg = useCallback(() => {
    if (!projectId) return
    replaceBackground(projectId, bgColor)
    setShowBgPreview(false)
  }, [projectId, bgColor, replaceBackground])

  return (
    <div className="flex h-full">
      <aside className="w-[240px] flex-shrink-0 border-r border-forge-border bg-forge-surface flex flex-col">
        <div className="p-4 border-b border-forge-border">
          <button className="btn-gold w-full flex items-center justify-center gap-2" onClick={handleAddDeck}>
            <Plus size={16} />
            <span>新建牌组</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {decks.length === 0 && (
            <div className="text-center text-forge-text-muted text-sm py-8">
              <Layers size={32} className="mx-auto mb-2 opacity-40" />
              <p>暂无牌组</p>
              <p className="text-xs mt-1">点击上方按钮创建</p>
            </div>
          )}
          {decks.map(deck => {
            const total = getDeckTotal(deck.id)
            const isSelected = deck.id === selectedDeckId
            return (
              <div
                key={deck.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 mb-1 ${
                  isSelected
                    ? 'bg-forge-gold/15 text-forge-gold border-l-[3px] border-forge-gold'
                    : 'text-forge-text-secondary hover:bg-forge-gold/8 hover:text-forge-text'
                }`}
                onClick={() => setSelectedDeckId(deck.id)}
              >
                <Layers size={16} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {editingDeckId === deck.id ? (
                    <input
                      className="input-field w-full text-sm py-0.5 px-1"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => handleRename(deck.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(deck.id)
                        if (e.key === 'Escape') setEditingDeckId(null)
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="block text-sm truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingDeckId(deck.id)
                        setEditingName(deck.name)
                      }}
                    >
                      {deck.name}
                    </span>
                  )}
                  <span className="text-xs opacity-60">{total} 张</span>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-forge-crimson/30 text-forge-text-muted hover:text-forge-crimson-light transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm({ id: deck.id, name: deck.name })
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t border-forge-border">
          <div className="flex items-center gap-2 text-forge-text-muted text-xs">
            <Palette size={14} />
            <span>统一替换背景</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative">
              <input
                type="color"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-forge-border bg-transparent"
              />
            </div>
            <input
              className="input-field flex-1 text-xs"
              value={bgColor}
              onChange={e => setBgColor(e.target.value)}
              placeholder="#000000"
            />
          </div>
          <button
            className="btn-outline w-full mt-2 text-xs flex items-center justify-center gap-1"
            onClick={() => setShowBgPreview(true)}
          >
            <Palette size={12} />
            预览并应用
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-forge-bg">
        {!selectedDeck ? (
          <div className="flex-1 flex items-center justify-center text-forge-text-muted">
            <div className="text-center">
              <Layers size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">选择或创建一个牌组</p>
              <p className="text-sm mt-1 opacity-60">从左侧选择牌组开始管理卡牌</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-forge-border bg-forge-surface/40">
              <div className="flex items-center gap-3">
                <h2 className="text-forge-text font-medium">{selectedDeck.name}</h2>
                <span className="text-xs text-forge-text-muted bg-forge-elevated px-2 py-0.5 rounded">
                  {deckCards.length} 种 / {deckTotal} 张
                </span>
              </div>
              <button
                className="btn-gold text-sm flex items-center gap-1.5 py-1.5 px-4"
                onClick={() => setShowAddCard(true)}
              >
                <Plus size={14} />
                添加卡牌
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {deckCards.length === 0 ? (
                <div className="flex items-center justify-center h-full text-forge-text-muted">
                  <div className="text-center">
                    <p className="text-lg mb-2">牌组为空</p>
                    <p className="text-sm opacity-60">点击"添加卡牌"开始添加</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 animate-fade-in">
                  {deckCards.map(dc => {
                    const card = getCard(dc.cardId)
                    if (!card) return null
                    return (
                      <div key={dc.id} className="card-frame p-3 flex flex-col items-center group relative">
                        <button
                          className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 bg-forge-crimson/80 hover:bg-forge-crimson text-white transition-all z-10"
                          onClick={() => removeCardFromDeck(selectedDeckId!, dc.cardId)}
                        >
                          <X size={12} />
                        </button>

                        <CardPreview card={card} width={80} showNumber={false} />

                        <div
                          className="mt-2 text-xs text-forge-text text-center truncate w-full"
                          title={card.name}
                        >
                          {card.name}
                        </div>

                        <div className="mt-2 flex items-center gap-1">
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text hover:bg-forge-border transition-colors"
                            onClick={() => handleQuantityChange(selectedDeckId!, dc.cardId, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={dc.quantity}
                            onChange={e => {
                              const v = parseInt(e.target.value)
                              if (!isNaN(v) && v >= 1) updateQuantity(selectedDeckId!, dc.cardId, v)
                            }}
                            className="input-field w-10 text-center text-xs py-0.5 px-0"
                          />
                          <button
                            className="w-6 h-6 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text hover:bg-forge-border transition-colors"
                            onClick={() => handleQuantityChange(selectedDeckId!, dc.cardId, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Modal
        open={showAddCard}
        onClose={() => { setShowAddCard(false); setSearchQuery('') }}
        title="添加卡牌到牌组"
      >
        <div className="mb-4 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forge-text-muted" />
          <input
            className="input-field w-full pl-9 text-sm"
            placeholder="搜索卡牌..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto -mx-2">
          {filteredAvailable.length === 0 ? (
            <div className="text-center text-forge-text-muted py-8 text-sm">
              {projectCards.length === 0 ? '项目中暂无卡牌' : '所有卡牌已添加到此牌组'}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-2">
              {filteredAvailable.map(card => {
                const inOtherDeck = allDeckCards.some(dc => dc.cardId === card.id && dc.deckId !== selectedDeckId)
                return (
                  <div
                    key={card.id}
                    className={`card-frame p-2 flex flex-col items-center cursor-pointer transition-all hover:scale-[1.02] ${inOtherDeck ? 'opacity-50' : ''}`}
                    onClick={() => {
                      if (selectedDeckId) {
                        addCardToDeck(selectedDeckId, card.id, 1)
                      }
                    }}
                  >
                    <CardPreview card={card} width={60} showNumber={false} />
                    <div className="mt-1.5 text-xs text-forge-text text-center truncate w-full">{card.name}</div>
                    <div className="mt-1 text-[10px] text-forge-gold flex items-center gap-0.5">
                      <Plus size={10} />
                      添加
                    </div>
                    {inOtherDeck && (
                      <div className="text-[10px] text-forge-text-muted">已在其他牌组</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {projectCards.length > 0 && (
          <div className="mt-4 pt-3 border-t border-forge-border">
            <p className="text-xs text-forge-text-muted mb-2">已在牌组中的卡牌</p>
            <div className="max-h-[150px] overflow-y-auto">
              {deckCards.map(dc => {
                const card = getCard(dc.cardId)
                if (!card) return null
                return (
                  <div key={dc.id} className="flex items-center gap-2 py-1.5 text-xs text-forge-text-secondary">
                    <div className="w-5 h-5 rounded" style={{ background: card.background }} />
                    <span className="flex-1 truncate">{card.name}</span>
                    <span className="text-forge-gold">×{dc.quantity}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteDeck}
        title="删除牌组"
        message={`确定要删除牌组"${deleteConfirm?.name}"吗？此操作不可撤销。`}
      />

      <Modal
        open={showBgPreview}
        onClose={() => setShowBgPreview(false)}
        title="统一替换背景"
      >
        <p className="text-forge-text-secondary text-sm mb-4">
          将项目中所有 {projectCards.length} 张卡牌的背景替换为以下颜色：
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-lg border border-forge-border shadow-lg"
            style={{ background: bgColor }}
          />
          <div>
            <div className="text-forge-text text-sm font-medium">{bgColor}</div>
            <div className="text-forge-text-muted text-xs mt-1">新背景色</div>
          </div>
        </div>

        {projectCards.length > 0 && (
          <div className="mb-6">
            <p className="text-forge-text-muted text-xs mb-2">预览效果</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {projectCards.slice(0, 5).map(card => (
                <div key={card.id} className="flex flex-col items-center flex-shrink-0">
                  <CardPreview card={{ ...card, background: bgColor }} width={50} showNumber={false} />
                  <span className="text-[10px] text-forge-text-muted mt-1 truncate max-w-[50px]">{card.name}</span>
                </div>
              ))}
              {projectCards.length > 5 && (
                <div className="flex items-center text-forge-text-muted text-xs flex-shrink-0">
                  +{projectCards.length - 5}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button className="btn-outline" onClick={() => setShowBgPreview(false)}>取消</button>
          <button className="btn-gold flex items-center gap-1.5" onClick={handleReplaceBg}>
            <Check size={14} />
            应用到全部卡牌
          </button>
        </div>
      </Modal>
    </div>
  )
}
