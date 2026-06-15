import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Image, Link2, Copy, Check, Settings, Grid3X3, Plus, Minus } from 'lucide-react'
import { useDeckStore } from '@/stores/deckStore'
import { useCardStore } from '@/stores/cardStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Card } from '@/types'
import CardPreview from '@/components/CardPreview'
import Modal from '@/components/Modal'
import { cn } from '@/lib/utils'

const PAPER_SIZES = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
}

const BLEED_MM = 3
const CROP_LINE_LENGTH = 8

interface PrintCard {
  cardId: string
  quantity: number
}

export default function Export() {
  const { projectId } = useParams()

  const decks = useDeckStore(s => s.decks)
  const { loadDecks, getDeckCards, getDeckTotal } = useDeckStore()
  const { loadCards, getCard, getProjectCards } = useCardStore()
  const { getProject } = useProjectStore()

  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4')
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(3)
  const [cardGap, setCardGap] = useState(5)
  const [showCropLines, setShowCropLines] = useState(true)
  const [showBleed, setShowBleed] = useState(true)
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId) {
      loadDecks(projectId)
      loadCards(projectId)
    }
  }, [projectId, loadDecks, loadCards])

  useEffect(() => {
    if (decks.length > 0 && selectedDeckIds.length === 0) {
      setSelectedDeckIds(decks.map(d => d.id))
    }
  }, [decks, selectedDeckIds.length])

  const project = projectId ? getProject(projectId) : null
  const paper = PAPER_SIZES[paperSize]

  const allCards: PrintCard[] = selectedDeckIds.flatMap(deckId => {
    const deckCards = getDeckCards(deckId)
    return deckCards.map(dc => ({
      cardId: dc.cardId,
      quantity: dc.quantity,
    }))
  })

  const cardMap = new Map<string, number>()
  allCards.forEach(pc => {
    cardMap.set(pc.cardId, (cardMap.get(pc.cardId) || 0) + pc.quantity)
  })

  const flattenedCards: string[] = []
  cardMap.forEach((qty, cardId) => {
    for (let i = 0; i < qty; i++) {
      flattenedCards.push(cardId)
    }
  })

  const totalCards = flattenedCards.length
  const cardsPerPage = cols * rows
  const totalPages = Math.max(1, Math.ceil(totalCards / cardsPerPage))

  const previewScale = 0.8
  const mmToPx = 3.78
  const previewWidth = paper.width * mmToPx * previewScale
  const previewHeight = paper.height * mmToPx * previewScale

  const cardWidthPx = project ? project.cardWidth * mmToPx * previewScale : 0
  const cardHeightPx = project ? project.cardHeight * mmToPx * previewScale : 0
  const gapPx = cardGap * mmToPx * previewScale
  const bleedPx = BLEED_MM * mmToPx * previewScale

  const availableWidth = previewWidth - 20 * mmToPx * previewScale
  const availableHeight = previewHeight - 20 * mmToPx * previewScale

  const maxCols = Math.floor((availableWidth + gapPx) / (cardWidthPx + gapPx))
  const maxRows = Math.floor((availableHeight + gapPx) / (cardHeightPx + gapPx))

  const autoCols = Math.min(maxCols, 3)
  const autoRows = Math.min(maxRows, 3)

  useEffect(() => {
    if (cols > maxCols) setCols(maxCols)
    if (rows > maxRows) setRows(maxRows)
  }, [maxCols, maxRows, cols, rows])

  const getCardPosition = (index: number, pageIndex: number) => {
    const pageOffset = pageIndex * cardsPerPage
    const idx = index - pageOffset
    if (idx < 0 || idx >= cardsPerPage) return null

    const col = idx % cols
    const row = Math.floor(idx / cols)

    const totalCardsWidth = cols * cardWidthPx + (cols - 1) * gapPx
    const totalCardsHeight = rows * cardHeightPx + (rows - 1) * gapPx
    const startX = (previewWidth - totalCardsWidth) / 2
    const startY = (previewHeight - totalCardsHeight) / 2

    return {
      x: startX + col * (cardWidthPx + gapPx),
      y: startY + row * (cardHeightPx + gapPx),
    }
  }

  const generateShareLink = useCallback(() => {
    if (!projectId || !project) return

    const projectCards = getProjectCards(projectId)
    const shareData = {
      project,
      cards: projectCards,
      decks: decks,
      deckCards: useDeckStore.getState().deckCards,
      timestamp: Date.now(),
    }

    const encoded = encodeURIComponent(JSON.stringify(shareData))
    const link = `${window.location.origin}/#/preview-share?data=${encoded}`
    setShareLink(link)
    setShowShareModal(true)
  }, [projectId, project, getProjectCards, decks])

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = shareLink
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [shareLink])

  const handleExportPDF = useCallback(async () => {
    if (!previewRef.current || exporting) return

    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const pdf = new jsPDF({
        orientation: paper.height > paper.width ? 'portrait' : 'landscape',
        unit: 'mm',
        format: paperSize.toLowerCase(),
      })

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const canvas = await html2canvas(previewRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          windowWidth: previewRef.current.scrollWidth,
          windowHeight: previewRef.current.scrollHeight,
          ignoreElements: (el) => {
            if (el.classList.contains('page-indicator')) {
              return (el as HTMLElement).dataset.pageIndex !== String(pageIdx)
            }
            return false
          },
        })

        const imgData = canvas.toDataURL('image/png')
        if (pageIdx > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, 0, paper.width, paper.height)
      }

      pdf.save(`${project?.name || 'cards'}_print.pdf`)
    } catch (error) {
      console.error('Export PDF failed:', error)
    } finally {
      setExporting(false)
    }
  }, [exporting, paper, paperSize, totalPages, project?.name])

  const handleExportPNG = useCallback(async () => {
    if (!previewRef.current || exporting) return

    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const canvas = await html2canvas(previewRef.current, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
          useCORS: true,
          windowWidth: previewRef.current.scrollWidth,
          windowHeight: previewRef.current.scrollHeight,
          ignoreElements: (el) => {
            if (el.classList.contains('page-indicator')) {
              return (el as HTMLElement).dataset.pageIndex !== String(pageIdx)
            }
            return false
          },
        })

        const link = document.createElement('a')
        link.download = `${project?.name || 'cards'}_page_${pageIdx + 1}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()

        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error('Export PNG failed:', error)
    } finally {
      setExporting(false)
    }
  }, [exporting, totalPages, project?.name])

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds(prev =>
      prev.includes(deckId)
        ? prev.filter(id => id !== deckId)
        : [...prev, deckId]
    )
  }

  const cardDistribution = Array.from(cardMap.entries()).reduce<{ card: Card; quantity: number }[]>((acc, [cardId, qty]) => {
    const card = getCard(cardId)
    if (card) {
      acc.push({ card, quantity: qty })
    }
    return acc
  }, [])

  const renderCropLines = (x: number, y: number, w: number, h: number) => {
    if (!showCropLines) return null

    const lineLength = CROP_LINE_LENGTH * previewScale
    const style: React.CSSProperties = {
      position: 'absolute',
      borderColor: '#ef4444',
      borderStyle: 'dashed',
      borderWidth: 1,
    }

    return (
      <>
        <div style={{ ...style, left: x - bleedPx, top: y - bleedPx, width: lineLength, borderRight: 0, borderBottom: 0 }} />
        <div style={{ ...style, left: x - bleedPx, top: y - bleedPx, height: lineLength, borderRight: 0, borderBottom: 0 }} />
        <div style={{ ...style, right: (previewWidth - x - w - bleedPx), top: y - bleedPx, width: lineLength, borderLeft: 0, borderBottom: 0 }} />
        <div style={{ ...style, left: x + w + bleedPx - 1, top: y - bleedPx, height: lineLength, borderLeft: 0, borderBottom: 0 }} />
        <div style={{ ...style, left: x - bleedPx, bottom: (previewHeight - y - h - bleedPx), width: lineLength, borderRight: 0, borderTop: 0 }} />
        <div style={{ ...style, left: x - bleedPx, top: y + h + bleedPx - 1, height: lineLength, borderRight: 0, borderTop: 0 }} />
        <div style={{ ...style, right: (previewWidth - x - w - bleedPx), bottom: (previewHeight - y - h - bleedPx), width: lineLength, borderLeft: 0, borderTop: 0 }} />
        <div style={{ ...style, left: x + w + bleedPx - 1, top: y + h + bleedPx - 1, height: lineLength, borderLeft: 0, borderTop: 0 }} />
        <div style={{ ...style, left: x + w / 2 - lineLength / 2, top: y - bleedPx, width: lineLength, borderBottom: 0, borderLeft: 0, borderRight: 0 }} />
        <div style={{ ...style, left: x + w / 2 - 0.5, top: y - bleedPx - lineLength, height: lineLength, borderRight: 0, borderBottom: 0, borderTop: 0 }} />
        <div style={{ ...style, left: x + w / 2 - lineLength / 2, bottom: (previewHeight - y - h - bleedPx), width: lineLength, borderTop: 0, borderLeft: 0, borderRight: 0 }} />
        <div style={{ ...style, left: x + w / 2 - 0.5, top: y + h + bleedPx, height: lineLength, borderRight: 0, borderBottom: 0, borderTop: 0 }} />
        <div style={{ ...style, left: x - bleedPx, top: y + h / 2 - lineLength / 2, height: lineLength, borderRight: 0, borderTop: 0, borderBottom: 0 }} />
        <div style={{ ...style, left: x - bleedPx - lineLength, top: y + h / 2 - 0.5, width: lineLength, borderBottom: 0, borderRight: 0, borderTop: 0 }} />
        <div style={{ ...style, right: (previewWidth - x - w - bleedPx), top: y + h / 2 - lineLength / 2, height: lineLength, borderLeft: 0, borderTop: 0, borderBottom: 0 }} />
        <div style={{ ...style, left: x + w + bleedPx, top: y + h / 2 - 0.5, width: lineLength, borderBottom: 0, borderLeft: 0, borderTop: 0 }} />
      </>
    )
  }

  return (
    <div className="flex h-full bg-forge-bg">
      <aside className="w-[280px] flex-shrink-0 border-r border-forge-border bg-forge-surface flex flex-col">
        <div className="p-4 border-b border-forge-border">
          <h2 className="text-forge-text font-medium flex items-center gap-2">
            <Settings size={18} />
            打印设置
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <div>
            <label className="block text-sm text-forge-text-secondary mb-2">纸张尺寸</label>
            <div className="flex gap-2">
              {(['A4', 'Letter'] as const).map(size => (
                <button
                  key={size}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    paperSize === size
                      ? 'bg-forge-gold text-forge-bg'
                      : 'bg-forge-elevated text-forge-text-secondary hover:text-forge-text'
                  )}
                  onClick={() => setPaperSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-forge-text-secondary mb-2 flex items-center gap-2">
              <Grid3X3 size={14} />
              排列密度
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-forge-text-muted mb-1 block">列数</label>
                <div className="flex items-center gap-2">
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-50"
                    onClick={() => setCols(c => Math.max(1, c - 1))}
                    disabled={cols <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={cols}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) setCols(Math.min(maxCols, Math.max(1, v)))
                    }}
                    className="input-field w-14 text-center text-sm py-1.5 px-0"
                    min={1}
                    max={maxCols}
                  />
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-50"
                    onClick={() => setCols(c => Math.min(maxCols, c + 1))}
                    disabled={cols >= maxCols}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-[10px] text-forge-text-muted mt-1">自动建议: {autoCols}</div>
              </div>
              <div>
                <label className="text-xs text-forge-text-muted mb-1 block">行数</label>
                <div className="flex items-center gap-2">
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-50"
                    onClick={() => setRows(r => Math.max(1, r - 1))}
                    disabled={rows <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={rows}
                    onChange={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) setRows(Math.min(maxRows, Math.max(1, v)))
                    }}
                    className="input-field w-14 text-center text-sm py-1.5 px-0"
                    min={1}
                    max={maxRows}
                  />
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-50"
                    onClick={() => setRows(r => Math.min(maxRows, r + 1))}
                    disabled={rows >= maxRows}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="text-[10px] text-forge-text-muted mt-1">自动建议: {autoRows}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-forge-text-secondary mb-2">卡牌间距 (mm)</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                value={cardGap}
                onChange={e => setCardGap(parseInt(e.target.value))}
                min={0}
                max={20}
                className="flex-1"
              />
              <span className="text-sm text-forge-text w-10 text-right">{cardGap}mm</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-forge-text-secondary">显示裁切线</span>
              <div
                className={cn(
                  'w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer',
                  showCropLines ? 'bg-forge-gold' : 'bg-forge-elevated'
                )}
                onClick={() => setShowCropLines(!showCropLines)}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white transition-transform',
                    showCropLines ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </div>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-forge-text-secondary">显示出血区域</span>
              <div
                className={cn(
                  'w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer',
                  showBleed ? 'bg-forge-gold' : 'bg-forge-elevated'
                )}
                onClick={() => setShowBleed(!showBleed)}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white transition-transform',
                    showBleed ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm text-forge-text-secondary mb-2">选择要导出的牌组</label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {decks.length === 0 ? (
                <div className="text-sm text-forge-text-muted text-center py-4">
                  暂无牌组
                </div>
              ) : (
                decks.map(deck => {
                  const total = getDeckTotal(deck.id)
                  const isSelected = selectedDeckIds.includes(deck.id)
                  return (
                    <label
                      key={deck.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        isSelected ? 'bg-forge-gold/15' : 'hover:bg-forge-elevated'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleDeck(deck.id)}
                        className="w-4 h-4 accent-forge-gold"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-forge-text truncate">{deck.name}</div>
                        <div className="text-xs text-forge-text-muted">{total} 张</div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-forge-border bg-forge-surface/40">
          <h2 className="text-forge-text font-medium">打印预览</h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-forge-text-muted">
              共 <span className="text-forge-gold">{totalPages}</span> 页
            </span>
            <span className="text-forge-text-muted">
              <span className="text-forge-gold">{totalCards}</span> 张卡牌
            </span>
            <span className="text-forge-text-muted">
              每页 <span className="text-forge-gold">{cardsPerPage}</span> 张
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-forge-bg/50 flex items-start justify-center">
          <div
            ref={previewRef}
            className="relative shadow-2xl"
            style={{
              width: previewWidth,
              height: previewHeight,
              background: '#ffffff',
            }}
          >
            {Array.from({ length: totalPages }).map((_, pageIdx) => (
              <div
                key={pageIdx}
                className="page-indicator"
                data-page-index={pageIdx}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: pageIdx === 0 ? 'block' : 'none',
                }}
              >
                {flattenedCards.map((cardId, idx) => {
                  const pos = getCardPosition(idx, pageIdx)
                  if (!pos) return null

                  const card = getCard(cardId)
                  if (!card) return null

                  return (
                    <div key={`${cardId}-${idx}`}>
                      {showBleed && (
                        <div
                          className="absolute"
                          style={{
                            left: pos.x - bleedPx,
                            top: pos.y - bleedPx,
                            width: cardWidthPx + bleedPx * 2,
                            height: cardHeightPx + bleedPx * 2,
                            background: card.background,
                            opacity: 0.3,
                            borderRadius: 8,
                          }}
                        />
                      )}
                      <div
                        className="absolute"
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: cardWidthPx,
                          height: cardHeightPx,
                        }}
                      >
                        <CardPreview
                          card={card}
                          width={cardWidthPx}
                          height={cardHeightPx}
                          showNumber={false}
                        />
                      </div>
                      {renderCropLines(pos.x, pos.y, cardWidthPx, cardHeightPx)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-forge-border bg-forge-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-forge-text-muted mb-1">打印统计</div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-forge-text">
                    总页数: <span className="text-forge-gold font-medium">{totalPages}</span>
                  </span>
                  <span className="text-forge-text">
                    总卡牌: <span className="text-forge-gold font-medium">{totalCards}</span>
                  </span>
                  <span className="text-forge-text">
                    卡牌种类: <span className="text-forge-gold font-medium">{cardDistribution.length}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="btn-outline flex items-center gap-2"
                onClick={generateShareLink}
              >
                <Link2 size={16} />
                生成分享链接
              </button>
              <button
                className="btn-outline flex items-center gap-2"
                onClick={handleExportPNG}
                disabled={exporting || totalCards === 0}
              >
                <Image size={16} />
                {exporting ? '导出中...' : '导出PNG'}
              </button>
              <button
                className="btn-gold flex items-center gap-2"
                onClick={handleExportPDF}
                disabled={exporting || totalCards === 0}
              >
                <FileText size={16} />
                {exporting ? '导出中...' : '导出PDF'}
              </button>
            </div>
          </div>

          {cardDistribution.length > 0 && (
            <div className="mt-3 pt-3 border-t border-forge-border">
              <div className="text-xs text-forge-text-muted mb-2">卡牌数量分布</div>
              <div className="flex flex-wrap gap-2">
                {cardDistribution.map(({ card, quantity }) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-2 px-2 py-1 bg-forge-elevated rounded text-xs"
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ background: card.background }}
                    />
                    <span className="text-forge-text-secondary truncate max-w-[120px]">{card.name}</span>
                    <span className="text-forge-gold font-medium">×{quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="分享试玩链接"
      >
        <p className="text-forge-text-secondary text-sm mb-4">
          生成的链接包含当前项目的所有数据，其他人可以通过链接直接查看和试玩。
        </p>

        <div className="mb-4">
          <label className="text-sm text-forge-text-muted mb-2 block">分享链接</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="input-field flex-1 text-sm"
            />
            <button
              className={cn(
                'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-forge-gold text-forge-bg hover:bg-forge-gold-light'
              )}
              onClick={copyToClipboard}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        <div className="bg-forge-elevated rounded-lg p-3">
          <div className="text-xs text-forge-text-muted">
            <p className="mb-1">💡 链接有效期说明：</p>
            <ul className="list-disc list-inside space-y-0.5 text-forge-text-secondary">
              <li>链接永久有效，除非浏览器数据被清除</li>
              <li>所有数据已编码到URL中，无需服务器存储</li>
              <li>项目数据较多时链接会较长，建议使用短链接服务缩短</li>
              <li>移动端打开时请确保网络连接正常</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-outline" onClick={() => setShowShareModal(false)}>关闭</button>
        </div>
      </Modal>
    </div>
  )
}
