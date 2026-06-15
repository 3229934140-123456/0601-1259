import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Bold, Italic, List, Heading1, Link2, ChevronUp, ChevronDown, Layers, AlertTriangle, CheckCircle, XCircle, ExternalLink, Eye } from 'lucide-react'
import { useRuleStore } from '@/stores/ruleStore'
import { useCardStore } from '@/stores/cardStore'
import { useDeckStore } from '@/stores/deckStore'
import CardPreview from '@/components/CardPreview'
import Modal, { ConfirmModal } from '@/components/Modal'
import { cn } from '@/lib/utils'

interface RefCheckResult {
  type: 'invalid' | 'mismatch'
  cardId: string
  cardName: string
  chapterId: string
  chapterTitle: string
  message: string
  expectedQty?: number
  actualQty?: number
}

export default function Rules() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { rule, chapters, loadRule, createRule, addChapter, deleteChapter, updateChapter, reorderChapters, addCardRef } = useRuleStore()
  const { loadCards, getProjectCards, getCard } = useCardStore()
  const { decks, loadDecks, getDeckCards, getDeckTotal } = useDeckStore()

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)
  const [showCardSelector, setShowCardSelector] = useState(false)
  const [previewCard, setPreviewCard] = useState<string | null>(null)
  const [showRefCheck, setShowRefCheck] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  useEffect(() => {
    if (projectId) {
      loadRule(projectId)
      loadCards(projectId)
      loadDecks(projectId)
    }
  }, [projectId, loadRule, loadCards, loadDecks])

  useEffect(() => {
    if (projectId && rule === null && useRuleStore.getState().rule === null) {
      createRule(projectId, '游戏规则')
    }
  }, [projectId, rule, createRule])

  useEffect(() => {
    if (chapters.length > 0 && !selectedChapterId) {
      const sorted = [...chapters].sort((a, b) => a.order - b.order)
      setSelectedChapterId(sorted[0].id)
    }
  }, [chapters, selectedChapterId])

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order)
  const selectedChapter = chapters.find(c => c.id === selectedChapterId)
  const projectCards = projectId ? getProjectCards(projectId) : []

  const getCardTotalInDecks = useCallback((cardId: string) => {
    let total = 0
    decks.forEach(deck => {
      const deckCards = getDeckCards(deck.id)
      const cardInDeck = deckCards.find(dc => dc.cardId === cardId)
      if (cardInDeck) total += cardInDeck.quantity
    })
    return total
  }, [decks, getDeckCards])

  const parseQuantityFromText = (text: string, cardName: string): number | null => {
    const patterns = [
      new RegExp(`${cardName}[^\\d]{0,10}(\\d+)[^\\d]{0,5}张`, 'i'),
      new RegExp(`${cardName}[^\\d]{0,10}×(\\d+)`, 'i'),
      new RegExp(`${cardName}[^\\d]{0,10}\\*(\\d+)`, 'i'),
      new RegExp(`(\\d+)[^\\d]{0,10}张[^\\d]{0,10}${cardName}`, 'i'),
      new RegExp(`(\\d+)\\s*张\\s*${cardName}`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) return parseInt(match[1])
    }
    return null
  }

  const refCheckResults = useMemo((): RefCheckResult[] => {
    const results: RefCheckResult[] = []
    const cardIdSet = new Set(projectCards.map(c => c.id))

    chapters.forEach(chapter => {
      const plainText = chapter.content.replace(/<[^>]*>/g, '')

      chapter.cardRefs.forEach(cardId => {
        const card = getCard(cardId)

        if (!card || !cardIdSet.has(cardId)) {
          results.push({
            type: 'invalid',
            cardId,
            cardName: card?.name || `未知卡牌(${cardId.slice(0, 8)})`,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            message: `卡牌不存在或已被删除`,
          })
          return
        }

        const actualQty = getCardTotalInDecks(cardId)
        const expectedQty = parseQuantityFromText(plainText, card.name)

        if (expectedQty !== null && expectedQty !== actualQty) {
          results.push({
            type: 'mismatch',
            cardId,
            cardName: card.name,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            message: `规则写的 ${expectedQty} 张，牌组实际 ${actualQty} 张`,
            expectedQty,
            actualQty,
          })
        }
      })
    })

    return results
  }, [chapters, projectCards, getCard, getCardTotalInDecks])

  const invalidRefs = refCheckResults.filter(r => r.type === 'invalid')
  const mismatchRefs = refCheckResults.filter(r => r.type === 'mismatch')

  const jumpToCard = (cardId: string) => {
    if (projectId) {
      navigate(`/canvas/${projectId}?cardId=${cardId}`)
    }
  }

  const jumpToDeck = (cardId: string) => {
    if (projectId) {
      navigate(`/decks/${projectId}?highlightCardId=${cardId}`)
    }
  }

  const saveSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    if (savedRangeRef.current && editorRef.current) {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
        editorRef.current.focus()
      }
    }
  }, [])

  const execCommand = useCallback((command: string, value?: string) => {
    saveSelection()
    restoreSelection()
    document.execCommand(command, false, value)
    if (editorRef.current && selectedChapterId) {
      updateChapter(selectedChapterId, { content: editorRef.current.innerHTML })
    }
  }, [saveSelection, restoreSelection, selectedChapterId, updateChapter])

  const handleContentChange = useCallback(() => {
    if (editorRef.current && selectedChapterId) {
      updateChapter(selectedChapterId, { content: editorRef.current.innerHTML })
    }
  }, [selectedChapterId, updateChapter])

  const handleAddChapter = useCallback(() => {
    if (!projectId) return
    const id = addChapter(`章节 ${chapters.length + 1}`)
    setSelectedChapterId(id)
  }, [projectId, chapters.length, addChapter])

  const handleRename = useCallback((chapterId: string) => {
    if (!editingName.trim()) {
      setEditingChapterId(null)
      return
    }
    updateChapter(chapterId, { title: editingName.trim() })
    setEditingChapterId(null)
  }, [editingName, updateChapter])

  const handleDeleteChapter = useCallback(() => {
    if (!deleteConfirm) return
    deleteChapter(deleteConfirm.id)
    if (selectedChapterId === deleteConfirm.id) {
      const remaining = chapters.filter(c => c.id !== deleteConfirm.id)
      setSelectedChapterId(remaining.length > 0 ? [...remaining].sort((a, b) => a.order - b.order)[0].id : null)
    }
    setDeleteConfirm(null)
  }, [deleteConfirm, deleteChapter, selectedChapterId, chapters])

  const handleMoveUp = useCallback((chapterId: string) => {
    const sorted = [...chapters].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(c => c.id === chapterId)
    if (idx <= 0) return
    const newOrder = [...sorted]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    reorderChapters(newOrder.map(c => c.id))
  }, [chapters, reorderChapters])

  const handleMoveDown = useCallback((chapterId: string) => {
    const sorted = [...chapters].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(c => c.id === chapterId)
    if (idx < 0 || idx >= sorted.length - 1) return
    const newOrder = [...sorted]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    reorderChapters(newOrder.map(c => c.id))
  }, [chapters, reorderChapters])

  const handleInsertCardRef = useCallback((cardId: string) => {
    const card = getCard(cardId)
    if (!card || !selectedChapterId) return

    saveSelection()
    restoreSelection()

    const span = document.createElement('span')
    span.setAttribute('data-card-id', cardId)
    span.className = 'bg-forge-gold/30 text-forge-gold px-1.5 py-0.5 rounded cursor-pointer hover:bg-forge-gold/50 transition-colors font-medium'
    span.textContent = `[${card.name}]`
    span.contentEditable = 'false'

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(span)
      range.setStartAfter(span)
      range.setEndAfter(span)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    if (editorRef.current) {
      updateChapter(selectedChapterId, { content: editorRef.current.innerHTML })
    }
    addCardRef(selectedChapterId, cardId)
    setShowCardSelector(false)
  }, [getCard, selectedChapterId, saveSelection, restoreSelection, updateChapter, addCardRef])

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const span = target.closest('span[data-card-id]')
    if (span) {
      const cardId = span.getAttribute('data-card-id')
      if (cardId) {
        setPreviewCard(cardId)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedChapter && editorRef.current) {
      if (editorRef.current.innerHTML !== selectedChapter.content) {
        editorRef.current.innerHTML = selectedChapter.content
      }
    }
  }, [selectedChapterId, selectedChapter])

  const previewCardData = previewCard ? getCard(previewCard) : null

  return (
    <div className="flex h-full">
      <aside className="w-[240px] flex-shrink-0 border-r border-forge-border bg-forge-surface flex flex-col">
        <div className="p-4 border-b border-forge-border">
          <button className="btn-gold w-full flex items-center justify-center gap-2" onClick={handleAddChapter}>
            <Plus size={16} />
            <span>添加章节</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sortedChapters.length === 0 && (
            <div className="text-center text-forge-text-muted text-sm py-8">
              <List size={32} className="mx-auto mb-2 opacity-40" />
              <p>暂无章节</p>
              <p className="text-xs mt-1">点击上方按钮创建</p>
            </div>
          )}
          {sortedChapters.map(chapter => {
            const isSelected = chapter.id === selectedChapterId
            const idx = sortedChapters.findIndex(c => c.id === chapter.id)
            return (
              <div
                key={chapter.id}
                className={cn(
                  'group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1',
                  isSelected
                    ? 'bg-forge-gold/15 text-forge-gold border-l-[3px] border-forge-gold'
                    : 'text-forge-text-secondary hover:bg-forge-gold/8 hover:text-forge-text'
                )}
                onClick={() => setSelectedChapterId(chapter.id)}
              >
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-0.5 rounded hover:bg-forge-elevated disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); handleMoveUp(chapter.id) }}
                    disabled={idx === 0}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    className="p-0.5 rounded hover:bg-forge-elevated disabled:opacity-30 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); handleMoveDown(chapter.id) }}
                    disabled={idx === sortedChapters.length - 1}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  {editingChapterId === chapter.id ? (
                    <input
                      className="input-field w-full text-sm py-0.5 px-1"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => handleRename(chapter.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(chapter.id)
                        if (e.key === 'Escape') setEditingChapterId(null)
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="block text-sm truncate"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingChapterId(chapter.id)
                        setEditingName(chapter.title)
                      }}
                    >
                      {chapter.title}
                    </span>
                  )}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-forge-crimson/30 text-forge-text-muted hover:text-forge-crimson transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm({ id: chapter.id, title: chapter.title })
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-forge-bg">
        {!selectedChapter ? (
          <div className="flex-1 flex items-center justify-center text-forge-text-muted">
            <div className="text-center">
              <List size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">选择或创建一个章节</p>
              <p className="text-sm mt-1 opacity-60">从左侧选择章节开始编辑</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-forge-border bg-forge-surface/40">
              <div className="flex items-center gap-2">
                <button
                  className="toolbar-btn"
                  onClick={() => execCommand('bold')}
                  title="加粗"
                >
                  <Bold size={16} />
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => execCommand('italic')}
                  title="斜体"
                >
                  <Italic size={16} />
                </button>
                <div className="w-px h-6 bg-forge-border mx-1" />
                <button
                  className="toolbar-btn"
                  onClick={() => execCommand('formatBlock', 'h1')}
                  title="标题1"
                >
                  <Heading1 size={16} />
                </button>
                <button
                  className="toolbar-btn"
                  onClick={() => execCommand('insertUnorderedList')}
                  title="无序列表"
                >
                  <List size={16} />
                </button>
                <div className="w-px h-6 bg-forge-border mx-1" />
                <button
                  className="toolbar-btn text-forge-gold hover:text-forge-gold"
                  onClick={() => { saveSelection(); setShowCardSelector(true) }}
                  title="引用卡牌"
                >
                  <Link2 size={16} />
                </button>
              </div>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                  showRefCheck
                    ? 'bg-forge-gold text-forge-bg'
                    : refCheckResults.length > 0
                    ? 'bg-forge-crimson/20 text-forge-crimson hover:bg-forge-crimson/30'
                    : 'bg-forge-elevated text-forge-text-secondary hover:text-forge-text'
                )}
                onClick={() => setShowRefCheck(!showRefCheck)}
              >
                {refCheckResults.length > 0 ? (
                  <AlertTriangle size={14} />
                ) : (
                  <CheckCircle size={14} />
                )}
                引用检查
                {refCheckResults.length > 0 && (
                  <span className="bg-forge-crimson text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {refCheckResults.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6">
                <h1 className="text-2xl font-bold text-forge-text mb-6">{selectedChapter.title}</h1>
                <div
                  ref={editorRef}
                  contentEditable
                  className="min-h-[400px] text-forge-text leading-relaxed focus:outline-none prose prose-invert max-w-none"
                  onClick={handleEditorClick}
                  onInput={handleContentChange}
                  onBlur={handleContentChange}
                  onSelect={saveSelection}
                  suppressContentEditableWarning
                />
              </div>

              {showRefCheck && (
                <aside className="w-[320px] border-l border-forge-border bg-forge-surface/50 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-forge-border bg-forge-surface flex items-center justify-between">
                    <h3 className="text-sm font-medium text-forge-text flex items-center gap-2">
                      <AlertTriangle size={14} className="text-forge-gold" />
                      卡牌引用检查
                    </h3>
                    {refCheckResults.length === 0 && (
                      <span className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle size={12} />
                        全部正常
                      </span>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {invalidRefs.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-forge-crimson mb-2 flex items-center gap-1.5">
                          <XCircle size={12} />
                          失效引用 ({invalidRefs.length})
                        </h4>
                        <div className="space-y-2">
                          {invalidRefs.map((ref, idx) => (
                            <div
                              key={`invalid-${idx}`}
                              className="bg-forge-crimson/10 border border-forge-crimson/30 rounded-lg p-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-forge-crimson truncate">
                                    {ref.cardName}
                                  </div>
                                  <div className="text-xs text-forge-text-muted mt-0.5">
                                    章节: {ref.chapterTitle}
                                  </div>
                                  <div className="text-xs text-forge-crimson mt-1">
                                    {ref.message}
                                  </div>
                                </div>
                                <button
                                  className="p-1 rounded hover:bg-forge-crimson/20 text-forge-crimson flex-shrink-0"
                                  onClick={() => setSelectedChapterId(ref.chapterId)}
                                  title="跳转到章节"
                                >
                                  <Eye size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {mismatchRefs.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-forge-gold mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          数量不一致 ({mismatchRefs.length})
                        </h4>
                        <div className="space-y-2">
                          {mismatchRefs.map((ref, idx) => (
                            <div
                              key={`mismatch-${idx}`}
                              className="bg-forge-gold/10 border border-forge-gold/30 rounded-lg p-2.5"
                            >
                              <div className="text-sm font-medium text-forge-gold truncate">
                                {ref.cardName}
                              </div>
                              <div className="text-xs text-forge-text-muted mt-0.5">
                                章节: {ref.chapterTitle}
                              </div>
                              <div className="text-xs text-forge-gold mt-1">
                                {ref.message}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  className="flex-1 text-[11px] px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary hover:text-forge-text flex items-center justify-center gap-1"
                                  onClick={() => jumpToCard(ref.cardId)}
                                >
                                  <ExternalLink size={10} />
                                  查看卡牌
                                </button>
                                <button
                                  className="flex-1 text-[11px] px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary hover:text-forge-text flex items-center justify-center gap-1"
                                  onClick={() => jumpToDeck(ref.cardId)}
                                >
                                  <Layers size={10} />
                                  查看牌组
                                </button>
                                <button
                                  className="text-[11px] px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary hover:text-forge-text"
                                  onClick={() => setSelectedChapterId(ref.chapterId)}
                                  title="跳转到章节"
                                >
                                  <Eye size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {refCheckResults.length === 0 && (
                      <div className="text-center py-8">
                        <CheckCircle size={32} className="mx-auto mb-2 text-green-400 opacity-60" />
                        <p className="text-sm text-forge-text-muted">所有引用检查通过</p>
                        <p className="text-xs text-forge-text-muted mt-1 opacity-60">
                          共检查 {chapters.reduce((sum, c) => sum + c.cardRefs.length, 0)} 个卡牌引用
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 border-t border-forge-border bg-forge-surface/50">
                    <div className="text-[10px] text-forge-text-muted space-y-0.5">
                      <p>💡 检查说明：</p>
                      <p>• 失效引用：引用的卡牌已被删除</p>
                      <p>• 数量不一致：规则文字描述数量与牌组实际数量不符</p>
                      <p>• 支持识别"3张攻击牌"、"攻击牌×3"等格式</p>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}
      </main>

      <Modal
        open={showCardSelector}
        onClose={() => setShowCardSelector(false)}
        title="选择卡牌"
      >
        <div className="max-h-[400px] overflow-y-auto">
          {projectCards.length === 0 ? (
            <div className="text-center text-forge-text-muted py-8 text-sm">
              项目中暂无卡牌
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {projectCards.map(card => (
                <div
                  key={card.id}
                  className="card-frame p-2 flex flex-col items-center cursor-pointer transition-all hover:scale-[1.02]"
                  onClick={() => handleInsertCardRef(card.id)}
                >
                  <CardPreview card={card} width={60} showNumber={false} />
                  <div className="mt-1.5 text-xs text-forge-text text-center truncate w-full">{card.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!previewCardData}
        onClose={() => setPreviewCard(null)}
        title={previewCardData?.name || ''}
      >
        {previewCardData && (
          <div className="flex flex-col items-center">
            <CardPreview card={previewCardData} width={160} showNumber />
            {previewCardData.attributes.length > 0 && (
              <div className="mt-4 w-full">
                <h4 className="text-sm font-medium text-forge-text mb-2">卡牌属性</h4>
                {previewCardData.attributes.map(attr => (
                  <div key={attr.id} className="flex justify-between py-1 border-b border-forge-border text-sm">
                    <span className="text-forge-text-muted">{attr.label}</span>
                    <span className="text-forge-text">{attr.value || '-'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 w-full">
              <h4 className="text-sm font-medium text-forge-text mb-2 flex items-center gap-2">
                <Layers size={14} className="text-forge-gold" />
                所属牌组
              </h4>
              {decks.length === 0 ? (
                <p className="text-sm text-forge-text-muted">暂无牌组</p>
              ) : (
                <div className="space-y-2">
                  {decks.map(deck => {
                    const deckCards = getDeckCards(deck.id)
                    const cardInDeck = deckCards.find(dc => dc.cardId === previewCardData.id)
                    if (!cardInDeck) return null
                    return (
                      <div
                        key={deck.id}
                        className="flex items-center justify-between px-3 py-2 bg-forge-elevated rounded-lg"
                      >
                        <span className="text-sm text-forge-text">{deck.name}</span>
                        <span className="text-sm text-forge-gold font-medium">×{cardInDeck.quantity}</span>
                      </div>
                    )
                  })}
                  {decks.filter(deck => getDeckCards(deck.id).some(dc => dc.cardId === previewCardData.id)).length === 0 && (
                    <p className="text-sm text-forge-text-muted">这张卡牌还没有加入任何牌组</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteChapter}
        title="删除章节"
        message={`确定要删除章节"${deleteConfirm?.title}"吗？此操作不可撤销。`}
      />
    </div>
  )
}
