import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Bold, Italic, List, Heading1, Link2, ChevronUp, ChevronDown } from 'lucide-react'
import { useRuleStore } from '@/stores/ruleStore'
import { useCardStore } from '@/stores/cardStore'
import CardPreview from '@/components/CardPreview'
import Modal, { ConfirmModal } from '@/components/Modal'
import { cn } from '@/lib/utils'

export default function Rules() {
  const { projectId } = useParams()
  const { rule, chapters, loadRule, createRule, addChapter, deleteChapter, updateChapter, reorderChapters, addCardRef } = useRuleStore()
  const { loadCards, getProjectCards, getCard } = useCardStore()

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null)
  const [showCardSelector, setShowCardSelector] = useState(false)
  const [previewCard, setPreviewCard] = useState<string | null>(null)

  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  useEffect(() => {
    if (projectId) {
      loadRule(projectId)
      loadCards(projectId)
    }
  }, [projectId, loadRule, loadCards])

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
            <div className="flex items-center gap-2 px-4 py-2 border-b border-forge-border bg-forge-surface/40">
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
                {previewCardData.attributes.map(attr => (
                  <div key={attr.id} className="flex justify-between py-1 border-b border-forge-border text-sm">
                    <span className="text-forge-text-muted">{attr.label}</span>
                    <span className="text-forge-text">{attr.value || '-'}</span>
                  </div>
                ))}
              </div>
            )}
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
