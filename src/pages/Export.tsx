import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, Image, Link2, Copy, Check, Settings, Grid3X3, Plus, Minus, ChevronLeft, ChevronRight, Layers, Download, Trash2, Clock, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useDeckStore } from '@/stores/deckStore'
import { useCardStore } from '@/stores/cardStore'
import { useProjectStore } from '@/stores/projectStore'
import { useRuleStore } from '@/stores/ruleStore'
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
  side: 'front' | 'back'
}

interface PrintJobPage {
  pageIndex: number
  thumbnail: string
  cardCount: number
  cards: { cardId: string; side: 'front' | 'back'; cardName: string }[]
}

interface PrintJob {
  id: string
  timestamp: number
  paperSize: 'A4' | 'Letter'
  doubleSided: boolean
  cols: number
  rows: number
  totalPages: number
  totalCards: number
  cardDistribution: { card: Card; frontQty: number; backQty: number }[]
  pages: PrintJobPage[]
  pdfData?: string
  pngData?: string[]
}

const PRINT_JOBS_KEY = 'cf_print_jobs'

export default function Export() {
  const { projectId } = useParams()
  const navigate = useNavigate()

  const decks = useDeckStore(s => s.decks)
  const { loadDecks, getDeckCards, getDeckTotal } = useDeckStore()
  const { loadCards, getCard, getProjectCards } = useCardStore()
  const { getProject } = useProjectStore()
  const { rule, chapters, loadRule } = useRuleStore()

  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4')
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(3)
  const [cardGap, setCardGap] = useState(5)
  const [showCropLines, setShowCropLines] = useState(true)
  const [showBleed, setShowBleed] = useState(true)
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])
  const [doubleSided, setDoubleSided] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([])
  const [showJobsPanel, setShowJobsPanel] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [showJobDetail, setShowJobDetail] = useState<PrintJob | null>(null)
  const [exportVerification, setExportVerification] = useState<{ verified: boolean; errors: string[] } | null>(null)

  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (projectId) {
      loadDecks(projectId)
      loadCards(projectId)
      loadRule(projectId)
      loadPrintJobs()
    }
  }, [projectId, loadDecks, loadCards, loadRule])

  useEffect(() => {
    if (decks.length > 0 && selectedDeckIds.length === 0) {
      setSelectedDeckIds(decks.map(d => d.id))
    }
  }, [decks, selectedDeckIds.length])

  useEffect(() => {
    setCurrentPage(0)
  }, [selectedDeckIds, doubleSided, cols, rows, cardGap])

  const loadPrintJobs = () => {
    if (!projectId) return
    try {
      const saved = localStorage.getItem(`${PRINT_JOBS_KEY}_${projectId}`)
      if (saved) {
        setPrintJobs(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load print jobs:', e)
    }
  }

  const savePrintJobs = (jobs: PrintJob[]) => {
    if (!projectId) return
    try {
      localStorage.setItem(`${PRINT_JOBS_KEY}_${projectId}`, JSON.stringify(jobs))
    } catch (e) {
      console.error('Failed to save print jobs:', e)
    }
  }

  const project = projectId ? getProject(projectId) : null
  const paper = PAPER_SIZES[paperSize]

  const allCards: PrintCard[] = selectedDeckIds.flatMap(deckId => {
    const deckCards = getDeckCards(deckId)
    return deckCards.flatMap(dc => {
      if (doubleSided) {
        return [
          { cardId: dc.cardId, quantity: dc.quantity, side: 'front' as const },
          { cardId: dc.cardId, quantity: dc.quantity, side: 'back' as const },
        ]
      }
      return [{ cardId: dc.cardId, quantity: dc.quantity, side: 'front' as const }]
    })
  })

  const cardMap = new Map<string, { front: number; back: number }>()
  allCards.forEach(pc => {
    const existing = cardMap.get(pc.cardId) || { front: 0, back: 0 }
    if (pc.side === 'front') {
      existing.front += pc.quantity
    } else {
      existing.back += pc.quantity
    }
    cardMap.set(pc.cardId, existing)
  })

  const flattenedCards: { cardId: string; side: 'front' | 'back' }[] = []
  if (doubleSided) {
    const fronts: { cardId: string; side: 'front' }[] = []
    const backs: { cardId: string; side: 'back' }[] = []
    cardMap.forEach((qty, cardId) => {
      for (let i = 0; i < qty.front; i++) {
        fronts.push({ cardId, side: 'front' })
      }
      for (let i = 0; i < qty.back; i++) {
        backs.push({ cardId, side: 'back' })
      }
    })
    flattenedCards.push(...fronts, ...backs)
  } else {
    cardMap.forEach((qty, cardId) => {
      for (let i = 0; i < qty.front; i++) {
        flattenedCards.push({ cardId, side: 'front' })
      }
    })
  }

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

  const verifyExport = useCallback((pagesData: { pageIndex: number; cards: { cardId: string; side: 'front' | 'back' }[] }[]) => {
    const errors: string[] = []

    const expectedCounts = new Map<string, number>()
    flattenedCards.forEach(item => {
      const key = `${item.cardId}-${item.side}`
      expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1)
    })

    const actualCounts = new Map<string, number>()
    pagesData.forEach(({ cards }) => {
      cards.forEach(c => {
        const key = `${c.cardId}-${c.side}`
        actualCounts.set(key, (actualCounts.get(key) || 0) + 1)
      })
    })

    expectedCounts.forEach((expected, key) => {
      const actual = actualCounts.get(key) || 0
      if (actual !== expected) {
        const [cardId, side] = key.split('-')
        const card = getCard(cardId)
        const name = card?.name || cardId.slice(0, 8)
        errors.push(`${name}(${side === 'front' ? '正面' : '背面'}): 预期${expected}张，实际导出${actual}张`)
      }
    })

    actualCounts.forEach((actual, key) => {
      if (!expectedCounts.has(key)) {
        const [cardId, side] = key.split('-')
        const card = getCard(cardId)
        const name = card?.name || cardId.slice(0, 8)
        errors.push(`存在未预期的卡牌: ${name}(${side === 'front' ? '正面' : '背面'}) 出现${actual}次`)
      }
    })

    const totalExported = pagesData.reduce((sum, p) => sum + p.cards.length, 0)
    if (totalExported !== totalCards) {
      errors.push(`导出卡牌总数不匹配: 预期${totalCards}张，实际${totalExported}张`)
    }

    const actualPageCount = pagesData.length
    if (actualPageCount < totalPages) {
      errors.push(`页数不足: 预期${totalPages}页，实际只导出${actualPageCount}页`)
    }

    return { verified: errors.length === 0, errors }
  }, [totalCards, flattenedCards, totalPages, getCard])

  const generateShareLink = useCallback(() => {
    if (!projectId || !project) return

    const projectCards = getProjectCards(projectId)
    const shareData = {
      project,
      cards: projectCards,
      decks: decks,
      deckCards: useDeckStore.getState().deckCards,
      rule: rule,
      chapters: chapters,
      timestamp: Date.now(),
    }

    const encoded = encodeURIComponent(JSON.stringify(shareData))
    const link = `${window.location.origin}/preview-share?data=${encoded}`
    setShareLink(link)
    setShowShareModal(true)
  }, [projectId, project, getProjectCards, decks, rule, chapters])

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

  const capturePage = async (pageIdx: number) => {
    if (!previewRef.current) return null

    const pageElement = previewRef.current.querySelector(`[data-page-index="${pageIdx}"]`) as HTMLElement
    if (!pageElement) return null

    const originalDisplay = pageElement.style.display
    pageElement.style.display = 'block'

    await new Promise(resolve => setTimeout(resolve, 100))

    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(pageElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      windowWidth: previewRef.current.scrollWidth,
      windowHeight: previewRef.current.scrollHeight,
    })

    pageElement.style.display = originalDisplay

    const pageCards = flattenedCards
      .map((item, idx) => {
        const pos = getCardPosition(idx, pageIdx)
        if (!pos) return null
        const card = getCard(item.cardId)
        return card ? { cardId: item.cardId, side: item.side, cardName: card.name } : null
      })
      .filter(Boolean) as { cardId: string; side: 'front' | 'back'; cardName: string }[]

    return {
      thumbnail: canvas.toDataURL('image/png'),
      cardCount: pageCards.length,
      cards: pageCards,
    }
  }

  const handleExportPDF = useCallback(async () => {
    if (!previewRef.current || exporting || totalCards === 0 || !project) return

    setExporting(true)
    setExportProgress(0)
    setExportVerification(null)

    try {
      const { jsPDF } = await import('jspdf')
      const html2canvas = (await import('html2canvas')).default

      const pdf = new jsPDF({
        orientation: paper.height > paper.width ? 'portrait' : 'landscape',
        unit: 'mm',
        format: paperSize.toLowerCase(),
      })

      const jobPages: PrintJobPage[] = []
      const pngData: string[] = []
      const verificationData: { pageIndex: number; cards: { cardId: string; side: 'front' | 'back' }[] }[] = []

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const pageData = await capturePage(pageIdx)
        if (!pageData) continue

        jobPages.push({
          pageIndex: pageIdx,
          ...pageData,
        })

        pngData.push(pageData.thumbnail)
        verificationData.push({
          pageIndex: pageIdx,
          cards: pageData.cards,
        })

        const imgData = pageData.thumbnail
        if (pageIdx > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, 0, paper.width, paper.height)

        setExportProgress(Math.round(((pageIdx + 1) / totalPages) * 100))
      }

      const pdfData = pdf.output('datauristring')
      pdf.save(`${project.name || 'cards'}_print.pdf`)

      const verification = verifyExport(verificationData)
      setExportVerification(verification)

      const cardDistribution = Array.from(cardMap.entries()).reduce<{ card: Card; frontQty: number; backQty: number }[]>((acc, [cardId, qty]) => {
        const card = getCard(cardId)
        if (card) {
          acc.push({ card, frontQty: qty.front, backQty: qty.back })
        }
        return acc
      }, [])

      const newJob: PrintJob = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        paperSize,
        doubleSided,
        cols,
        rows,
        totalPages,
        totalCards,
        cardDistribution,
        pages: jobPages,
        pdfData,
        pngData,
      }

      const updatedJobs = [newJob, ...printJobs].slice(0, 20)
      setPrintJobs(updatedJobs)
      savePrintJobs(updatedJobs)
      setSelectedJobId(newJob.id)

    } catch (error) {
      console.error('Export PDF failed:', error)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }, [exporting, paper, paperSize, totalPages, project, totalCards, doubleSided, cols, rows, printJobs, getCard, verifyExport])

  const handleExportPNG = useCallback(async () => {
    if (!previewRef.current || exporting || totalCards === 0 || !project) return

    setExporting(true)
    setExportProgress(0)
    setExportVerification(null)

    try {
      const jobPages: PrintJobPage[] = []
      const pngData: string[] = []
      const verificationData: { pageIndex: number; cards: { cardId: string; side: 'front' | 'back' }[] }[] = []

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const pageData = await capturePage(pageIdx)
        if (!pageData) continue

        jobPages.push({
          pageIndex: pageIdx,
          ...pageData,
        })

        pngData.push(pageData.thumbnail)
        verificationData.push({
          pageIndex: pageIdx,
          cards: pageData.cards,
        })

        const link = document.createElement('a')
        link.download = `${project.name || 'cards'}_page_${pageIdx + 1}.png`
        link.href = pageData.thumbnail
        link.click()

        setExportProgress(Math.round(((pageIdx + 1) / totalPages) * 100))
        await new Promise(resolve => setTimeout(resolve, 300))
      }

      const verification = verifyExport(verificationData)
      setExportVerification(verification)

      const cardDistribution = Array.from(cardMap.entries()).reduce<{ card: Card; frontQty: number; backQty: number }[]>((acc, [cardId, qty]) => {
        const card = getCard(cardId)
        if (card) {
          acc.push({ card, frontQty: qty.front, backQty: qty.back })
        }
        return acc
      }, [])

      const newJob: PrintJob = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        paperSize,
        doubleSided,
        cols,
        rows,
        totalPages,
        totalCards,
        cardDistribution,
        pages: jobPages,
        pngData,
      }

      const updatedJobs = [newJob, ...printJobs].slice(0, 20)
      setPrintJobs(updatedJobs)
      savePrintJobs(updatedJobs)
      setSelectedJobId(newJob.id)

    } catch (error) {
      console.error('Export PNG failed:', error)
    } finally {
      setExporting(false)
      setExportProgress(0)
    }
  }, [exporting, totalPages, project, totalCards, doubleSided, cols, rows, printJobs, getCard, verifyExport])

  const downloadSinglePage = (job: PrintJob, pageIdx: number) => {
    if (!job.pngData || !job.pngData[pageIdx]) return
    const link = document.createElement('a')
    link.download = `${project?.name || 'cards'}_job_${job.id}_page_${pageIdx + 1}.png`
    link.href = job.pngData[pageIdx]
    link.click()
  }

  const downloadAllPages = (job: PrintJob) => {
    if (!job.pngData) return
    job.pngData.forEach((png, idx) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.download = `${project?.name || 'cards'}_job_${job.id}_page_${idx + 1}.png`
        link.href = png
        link.click()
      }, idx * 300)
    })
  }

  const downloadJobPDF = (job: PrintJob) => {
    if (!job.pdfData) return
    const link = document.createElement('a')
    link.download = `${project?.name || 'cards'}_job_${job.id}.pdf`
    link.href = job.pdfData
    link.click()
  }

  const deleteJob = (jobId: string) => {
    const updatedJobs = printJobs.filter(j => j.id !== jobId)
    setPrintJobs(updatedJobs)
    savePrintJobs(updatedJobs)
    if (selectedJobId === jobId) {
      setSelectedJobId(null)
    }
    if (showJobDetail?.id === jobId) {
      setShowJobDetail(null)
    }
  }

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds(prev =>
      prev.includes(deckId)
        ? prev.filter(id => id !== deckId)
        : [...prev, deckId]
    )
  }

  const cardDistribution = Array.from(cardMap.entries()).reduce<{ card: Card; frontQty: number; backQty: number }[]>((acc, [cardId, qty]) => {
    const card = getCard(cardId)
    if (card) {
      acc.push({ card, frontQty: qty.front, backQty: qty.back })
    }
    return acc
  }, [])

  const getPageType = (pageIdx: number): 'front' | 'back' | 'mixed' => {
    if (!doubleSided) return 'mixed'
    const frontPageCount = Math.ceil(Array.from(cardMap.values()).reduce((sum, q) => sum + q.front, 0) / cardsPerPage)
    return pageIdx < frontPageCount ? 'front' : 'back'
  }

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
      </>
    )
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(0, Math.min(totalPages - 1, page)))
  }

  return (
    <div className="flex h-full bg-forge-bg">
      <aside className="w-[280px] flex-shrink-0 border-r border-forge-border bg-forge-surface flex flex-col">
        <div className="p-4 border-b border-forge-border flex items-center justify-between">
          <h2 className="text-forge-text font-medium flex items-center gap-2">
            <Settings size={18} />
            打印设置
          </h2>
          <button
            className={cn(
              'p-1.5 rounded transition-colors',
              showJobsPanel ? 'bg-forge-gold text-forge-bg' : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-elevated'
            )}
            onClick={() => setShowJobsPanel(!showJobsPanel)}
            title="打印任务历史"
          >
            <Clock size={16} />
          </button>
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

          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-forge-text-secondary flex items-center gap-2">
                <Layers size={14} />
                正反面成套排版
              </span>
              <div
                className={cn(
                  'w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer',
                  doubleSided ? 'bg-forge-gold' : 'bg-forge-elevated'
                )}
                onClick={() => setDoubleSided(!doubleSided)}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full bg-white transition-transform',
                    doubleSided ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </div>
            </label>
            <p className="text-xs text-forge-text-muted pl-6">
              开启后正面和背面分开排版，方便双面打印
            </p>
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

      {showJobsPanel && (
        <aside className="w-[320px] flex-shrink-0 border-r border-forge-border bg-forge-surface flex flex-col">
          <div className="p-4 border-b border-forge-border flex items-center justify-between">
            <h3 className="text-forge-text font-medium flex items-center gap-2">
              <Clock size={16} />
              打印任务历史
            </h3>
            <span className="text-xs text-forge-text-muted">{printJobs.length} 个任务</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {printJobs.length === 0 ? (
              <div className="text-center py-12 text-forge-text-muted">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无导出记录</p>
                <p className="text-xs mt-1 opacity-60">导出文件后会显示在这里</p>
              </div>
            ) : (
              <div className="divide-y divide-forge-border">
                {printJobs.map(job => (
                  <div
                    key={job.id}
                    className={cn(
                      'p-3 cursor-pointer transition-colors',
                      selectedJobId === job.id ? 'bg-forge-gold/10' : 'hover:bg-forge-elevated/50'
                    )}
                    onClick={() => {
                      setSelectedJobId(job.id)
                      setShowJobDetail(job)
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-forge-text">
                          {job.totalPages} 页 · {job.totalCards} 张
                        </div>
                        <div className="text-[10px] text-forge-text-muted mt-0.5">
                          {new Date(job.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <button
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-forge-crimson/30 text-forge-text-muted hover:text-forge-crimson transition-all"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteJob(job.id)
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 bg-forge-elevated rounded text-forge-text-muted">
                        {job.paperSize}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-forge-elevated rounded text-forge-text-muted">
                        {job.cols}×{job.rows}
                      </span>
                      {job.doubleSided && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-forge-gold/20 rounded text-forge-gold">
                          双面
                        </span>
                      )}
                      {job.pdfData && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-900/30 rounded text-green-400">
                          PDF
                        </span>
                      )}
                      {job.pngData && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 rounded text-blue-400">
                          PNG
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2 overflow-x-auto">
                      {job.pages.slice(0, 5).map(page => (
                        <img
                          key={page.pageIndex}
                          src={page.thumbnail}
                          alt={`第${page.pageIndex + 1}页`}
                          className="w-10 h-14 object-cover rounded border border-forge-border flex-shrink-0"
                        />
                      ))}
                      {job.pages.length > 5 && (
                        <div className="w-10 h-14 flex items-center justify-center text-xs text-forge-text-muted bg-forge-elevated rounded border border-forge-border flex-shrink-0">
                          +{job.pages.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-forge-border bg-forge-surface/40">
          <div className="flex items-center gap-4">
            <h2 className="text-forge-text font-medium">打印预览</h2>
            {doubleSided && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded">正面页</span>
                <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded">背面页</span>
                <span className="px-2 py-1 bg-forge-elevated text-forge-text-muted rounded">
                  {getPageType(currentPage) === 'front' ? '当前：正面页' : getPageType(currentPage) === 'back' ? '当前：背面页' : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-forge-text-muted">
              第 <span className="text-forge-gold font-medium">{currentPage + 1}</span> / {totalPages} 页
            </span>
            <span className="text-forge-text-muted">
              共 <span className="text-forge-gold">{totalCards}</span> 张卡牌
            </span>
            <span className="text-forge-text-muted">
              每页 <span className="text-forge-gold">{cardsPerPage}</span> 张
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-2 border-b border-forge-border bg-forge-surface/20">
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-30"
            onClick={() => goToPage(0)}
            disabled={currentPage === 0}
          >
            «
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-30"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1 px-3">
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              let pageNum = i
              if (totalPages > 7) {
                if (currentPage <= 3) {
                  pageNum = i
                } else if (currentPage >= totalPages - 4) {
                  pageNum = totalPages - 7 + i
                } else {
                  pageNum = currentPage - 3 + i
                }
              }
              const pageType = getPageType(pageNum)
              return (
                <button
                  key={pageNum}
                  className={cn(
                    'w-8 h-8 rounded text-sm font-medium transition-colors relative',
                    currentPage === pageNum
                      ? 'bg-forge-gold text-forge-bg'
                      : 'bg-forge-elevated text-forge-text-secondary hover:text-forge-text'
                  )}
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum + 1}
                  {doubleSided && (
                    <div
                      className={cn(
                        'absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full',
                        pageType === 'front' ? 'bg-blue-400' : pageType === 'back' ? 'bg-purple-400' : 'bg-forge-text-muted'
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-30"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages - 1}
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded bg-forge-elevated text-forge-text-secondary hover:text-forge-text disabled:opacity-30"
            onClick={() => goToPage(totalPages - 1)}
            disabled={currentPage === totalPages - 1}
          >
            »
          </button>
        </div>

        {exportVerification && (
          <div className={cn(
            'px-6 py-2 border-b flex items-center gap-2',
            exportVerification.verified
              ? 'bg-green-900/20 border-green-800/50'
              : 'bg-red-900/20 border-red-800/50'
          )}>
            {exportVerification.verified ? (
              <>
                <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-400">导出验证通过：所有页面内容正确，无串页问题</span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-red-400 flex-shrink-0" />
                <div className="text-sm text-red-400">
                  导出验证发现问题：
                  <ul className="list-disc list-inside mt-1 text-xs">
                    {exportVerification.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto p-8 bg-forge-bg/50 flex items-start justify-center">
          {exporting && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
              <div className="bg-forge-surface rounded-xl p-6 w-[320px] text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-forge-gold/30 border-t-forge-gold animate-spin" />
                <h3 className="text-forge-text font-medium mb-2">正在导出</h3>
                <p className="text-sm text-forge-text-muted mb-4">
                  正在处理第 {Math.ceil(exportProgress / 100 * totalPages)} / {totalPages} 页
                </p>
                <div className="w-full h-2 bg-forge-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-forge-gold transition-all duration-300"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <p className="text-xs text-forge-text-muted mt-2">{exportProgress}%</p>
              </div>
            </div>
          )}

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
                  display: pageIdx === currentPage ? 'block' : 'none',
                }}
              >
                {flattenedCards.map((item, idx) => {
                  const pos = getCardPosition(idx, pageIdx)
                  if (!pos) return null

                  const card = getCard(item.cardId)
                  if (!card) return null

                  return (
                    <div key={`${item.cardId}-${item.side}-${idx}`}>
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
                          side={item.side}
                          showNumber={false}
                        />
                      </div>
                      {renderCropLines(pos.x, pos.y, cardWidthPx, cardHeightPx)}
                      {doubleSided && (
                        <div
                          className={cn(
                            'absolute text-[10px] px-1.5 py-0.5 rounded font-medium',
                            item.side === 'front'
                              ? 'bg-blue-900/80 text-blue-300'
                              : 'bg-purple-900/80 text-purple-300'
                          )}
                          style={{
                            left: pos.x + 4,
                            top: pos.y + 4,
                          }}
                        >
                          {item.side === 'front' ? '正' : '反'}
                        </div>
                      )}
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
                  {doubleSided && (
                    <>
                      <span className="text-forge-text">
                        正面页: <span className="text-blue-400 font-medium">{Math.ceil(Array.from(cardMap.values()).reduce((sum, q) => sum + q.front, 0) / cardsPerPage)}</span>
                      </span>
                      <span className="text-forge-text">
                        背面页: <span className="text-purple-400 font-medium">{Math.ceil(Array.from(cardMap.values()).reduce((sum, q) => sum + q.back, 0) / cardsPerPage)}</span>
                      </span>
                    </>
                  )}
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
                {cardDistribution.map(({ card, frontQty, backQty }) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-2 px-2 py-1 bg-forge-elevated rounded text-xs"
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ background: card.background }}
                    />
                    <span className="text-forge-text-secondary truncate max-w-[120px]">{card.name}</span>
                    {doubleSided ? (
                      <span className="text-forge-gold font-medium">正×{frontQty} 反×{backQty}</span>
                    ) : (
                      <span className="text-forge-gold font-medium">×{frontQty}</span>
                    )}
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

      <Modal
        open={!!showJobDetail}
        onClose={() => setShowJobDetail(null)}
        title={`打印任务 #${showJobDetail?.id.slice(-6)}`}
      >
        {showJobDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-forge-elevated rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-forge-gold">{showJobDetail.totalPages}</div>
                <div className="text-xs text-forge-text-muted">页数</div>
              </div>
              <div className="bg-forge-elevated rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-forge-gold">{showJobDetail.totalCards}</div>
                <div className="text-xs text-forge-text-muted">卡牌数</div>
              </div>
              <div className="bg-forge-elevated rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-forge-gold">{showJobDetail.cols}×{showJobDetail.rows}</div>
                <div className="text-xs text-forge-text-muted">排列</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary">
                纸张: {showJobDetail.paperSize}
              </span>
              <span className="text-xs px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary">
                {showJobDetail.doubleSided ? '双面打印' : '单面打印'}
              </span>
              <span className="text-xs px-2 py-1 bg-forge-elevated rounded text-forge-text-secondary">
                {new Date(showJobDetail.timestamp).toLocaleString()}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-medium text-forge-text mb-2">页序预览</h4>
              <div className="grid grid-cols-5 gap-2 max-h-[240px] overflow-y-auto">
                {showJobDetail.pages.map(page => {
                  const pageType = showJobDetail.doubleSided
                    ? (page.pageIndex < Math.ceil(showJobDetail.totalCards / 2 / showJobDetail.cols / showJobDetail.rows) ? 'front' : 'back')
                    : 'mixed'
                  return (
                    <div
                      key={page.pageIndex}
                      className="group relative"
                    >
                      <img
                        src={page.thumbnail}
                        alt={`第${page.pageIndex + 1}页`}
                        className="w-full aspect-[210/297] object-cover rounded border border-forge-border"
                      />
                      <div className="absolute bottom-0.5 left-0.5 right-0.5 flex items-center justify-between">
                        <span className="text-[9px] px-1 py-0.5 bg-black/70 text-white rounded">
                          {page.pageIndex + 1}
                        </span>
                        {showJobDetail.doubleSided && (
                          <span className={cn(
                            'text-[9px] px-1 py-0.5 rounded',
                            pageType === 'front' ? 'bg-blue-600/80 text-white' : 'bg-purple-600/80 text-white'
                          )}>
                            {pageType === 'front' ? '正' : '反'}
                          </span>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                        <button
                          className="p-1.5 bg-forge-gold text-forge-bg rounded"
                          onClick={() => downloadSinglePage(showJobDetail, page.pageIndex)}
                          title="下载此页"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          className="p-1.5 bg-forge-elevated text-forge-text rounded"
                          onClick={() => {
                            const win = window.open()
                            if (win) {
                              win.document.write(`<img src="${page.thumbnail}" style="max-width:100%" />`)
                            }
                          }}
                          title="查看大图"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-forge-text mb-2">卡牌分布</h4>
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {showJobDetail.cardDistribution.map(({ card, frontQty, backQty }) => (
                  <div key={card.id} className="flex items-center gap-2 py-1 px-2 bg-forge-elevated/50 rounded">
                    <div className="w-4 h-4 rounded flex-shrink-0" style={{ background: card.background }} />
                    <span className="flex-1 text-sm text-forge-text truncate">{card.name}</span>
                    {showJobDetail.doubleSided ? (
                      <span className="text-xs text-forge-gold">正×{frontQty} 反×{backQty}</span>
                    ) : (
                      <span className="text-xs text-forge-gold">×{frontQty}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-forge-border">
              <button
                className="btn-outline text-sm text-forge-crimson border-forge-crimson/50 hover:bg-forge-crimson/10"
                onClick={() => deleteJob(showJobDetail.id)}
              >
                <Trash2 size={14} className="inline mr-1" />
                删除任务
              </button>
              <div className="flex gap-2">
                <button
                  className="btn-outline flex items-center gap-1.5"
                  onClick={() => downloadAllPages(showJobDetail)}
                  disabled={!showJobDetail.pngData}
                >
                  <Image size={14} />
                  下载全部PNG
                </button>
                <button
                  className="btn-gold flex items-center gap-1.5"
                  onClick={() => downloadJobPDF(showJobDetail)}
                  disabled={!showJobDetail.pdfData}
                >
                  <FileText size={14} />
                  下载PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
