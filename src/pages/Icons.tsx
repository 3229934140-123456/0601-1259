import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Upload, Search, Tag, Trash2, Plus, X, Image, Check, Grid } from 'lucide-react'
import { useIconStore } from '@/stores/iconStore'
import type { Icon } from '@/types'
import { ICON_CATEGORIES } from '@/types'

const ALL_CATEGORIES = ['全部', ...ICON_CATEGORIES] as const

export default function Icons() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { loadIcons, addIcon, deleteIcon, updateIcon, getProjectIcons, searchIcons } = useIconStore()

  const [activeCategory, setActiveCategory] = useState<string>('全部')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<Icon | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadDataUrl, setUploadDataUrl] = useState('')
  const [uploadFormat, setUploadFormat] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<string>(ICON_CATEGORIES[0])
  const [uploadTags, setUploadTags] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (projectId) loadIcons(projectId)
  }, [projectId, loadIcons])

  const allIcons = projectId ? getProjectIcons(projectId) : []

  const filteredIcons = (() => {
    let result = allIcons
    if (activeCategory !== '全部') {
      result = result.filter(i => i.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        i => i.name.toLowerCase().includes(q) || i.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return result
  })()

  const handleFileRead = useCallback((file: File) => {
    if (!file.type.includes('svg') && !file.type.includes('png')) return
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setUploadDataUrl(dataUrl)
      setUploadFormat(file.type.includes('svg') ? 'svg' : 'png')
      setUploadName(file.name.replace(/\.[^.]+$/, ''))
      setUploadCategory(ICON_CATEGORIES[0])
      setUploadTags('')
      setShowUploadModal(true)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileRead(file)
  }, [handleFileRead])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileRead(file)
    e.target.value = ''
  }, [handleFileRead])

  const handleUploadConfirm = () => {
    if (!projectId || !uploadName.trim() || !uploadDataUrl) return
    const tags = uploadTags
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
    addIcon(projectId, uploadName.trim(), uploadCategory, uploadDataUrl, uploadFormat, tags)
    setShowUploadModal(false)
    setUploadDataUrl('')
  }

  const handleSelectIcon = (icon: Icon) => {
    setSelectedIcon(icon)
    setEditName(icon.name)
    setEditCategory(icon.category)
    setEditTags(icon.tags.join(', '))
  }

  const handleSaveIcon = () => {
    if (!selectedIcon) return
    const tags = editTags
      .split(/[,，\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
    updateIcon(selectedIcon.id, {
      name: editName.trim(),
      category: editCategory,
      tags,
    })
    setSelectedIcon(null)
  }

  const handleDeleteIcon = (id: string) => {
    deleteIcon(id)
    if (selectedIcon?.id === id) setSelectedIcon(null)
  }

  const handleInsertCanvas = () => {
    if (projectId) navigate(`/canvas/${projectId}`)
  }

  return (
    <div className="h-full flex animate-fade-in">
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forge-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索图标名称或标签..."
              className="input-field w-full pl-9 pr-3 text-sm"
            />
          </div>
          <button
            className="btn-gold flex items-center gap-2 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            导入图标
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png"
            className="hidden"
            onChange={handleFilePick}
          />
        </div>

        <div className="flex gap-1 mb-5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {ALL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-sm whitespace-nowrap rounded-lg transition-all relative flex-shrink-0 ${
                activeCategory === cat
                  ? 'text-forge-gold'
                  : 'text-forge-text-secondary hover:text-forge-text'
              }`}
            >
              {cat}
              {activeCategory === cat && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-forge-gold rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div
          className={`mb-5 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
            isDragOver
              ? 'border-forge-gold bg-forge-gold/5'
              : 'border-forge-border hover:border-forge-gold/40'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={32} className={isDragOver ? 'text-forge-gold' : 'text-forge-text-muted'} />
          <p className="text-forge-text-secondary text-sm">
            拖放 SVG / PNG 文件到此处，或点击选择文件
          </p>
        </div>

        {filteredIcons.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Image size={48} className="text-forge-text-muted" />
            <p className="text-forge-text-muted text-sm">
              {allIcons.length === 0
                ? '还没有图标，点击上方"导入图标"开始添加'
                : '没有匹配的图标，试试其他分类或搜索词'}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredIcons.map(icon => (
                <div
                  key={icon.id}
                  className="card-frame p-3 relative group cursor-pointer"
                  onClick={() => handleSelectIcon(icon)}
                >
                  <div className="aspect-square flex items-center justify-center mb-2 rounded-lg bg-forge-elevated overflow-hidden">
                    <img
                      src={icon.dataUrl}
                      alt={icon.name}
                      className="max-w-full max-h-full object-contain p-2"
                    />
                  </div>
                  <p className="text-sm text-forge-text truncate">{icon.name}</p>
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-forge-gold/15 text-forge-gold">
                    {icon.category}
                  </span>
                  <button
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-forge-bg/80 text-forge-text-muted hover:text-forge-crimson-light hover:bg-forge-crimson/20 opacity-0 group-hover:opacity-100 transition-all"
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteIcon(icon.id)
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedIcon && (
        <div className="w-80 border-l border-forge-border bg-forge-surface flex flex-col animate-fade-in flex-shrink-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-forge-border">
            <h3 className="text-sm font-medium text-forge-text">图标详情</h3>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg text-forge-text-secondary hover:text-forge-text hover:bg-forge-elevated transition-colors"
              onClick={() => setSelectedIcon(null)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            <div className="aspect-square flex items-center justify-center rounded-xl bg-forge-elevated overflow-hidden">
              <img
                src={selectedIcon.dataUrl}
                alt={selectedIcon.name}
                className="max-w-full max-h-full object-contain p-4"
              />
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="input-field w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">分类</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  {ICON_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="火, 攻击, 元素"
                  className="input-field w-full text-sm"
                />
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-forge-border flex flex-col gap-2">
            <button className="btn-gold w-full text-sm" onClick={handleSaveIcon}>
              <Check size={16} className="inline mr-1.5 -mt-0.5" />
              保存修改
            </button>
            <button className="btn-outline w-full text-sm" onClick={handleInsertCanvas}>
              <Grid size={16} className="inline mr-1.5 -mt-0.5" />
              插入画布
            </button>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowUploadModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-forge-surface border border-forge-border rounded-xl shadow-2xl w-full max-w-md mx-4 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-forge-border">
              <h2 className="text-lg font-medium text-forge-text font-display">导入图标</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-forge-text-secondary hover:text-forge-text hover:bg-forge-elevated transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="aspect-video flex items-center justify-center rounded-lg bg-forge-elevated overflow-hidden">
                <img src={uploadDataUrl} alt="preview" className="max-w-full max-h-full object-contain p-4" />
              </div>
              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">图标名称</label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  className="input-field w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">分类</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="input-field w-full text-sm"
                >
                  {ICON_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-forge-text-muted mb-1.5">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={e => setUploadTags(e.target.value)}
                  placeholder="火, 攻击, 元素"
                  className="input-field w-full text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-forge-border flex justify-end gap-3">
              <button className="btn-outline text-sm" onClick={() => setShowUploadModal(false)}>取消</button>
              <button
                className="btn-gold text-sm"
                onClick={handleUploadConfirm}
                disabled={!uploadName.trim()}
              >
                <Plus size={16} className="inline mr-1.5 -mt-0.5" />
                添加图标
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
