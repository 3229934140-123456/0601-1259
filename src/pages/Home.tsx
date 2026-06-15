import { useState, useMemo } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { Plus, FolderOpen, Clock, Trash2, ArrowRight } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { CARD_PRESETS } from '@/types'
import type { Project } from '@/types'
import Modal from '@/components/Modal'
import { cn } from '@/lib/utils'

type SizePreset = Project['sizePreset']

const SIZE_OPTIONS: { value: SizePreset; label: string; desc: string }[] = [
  { value: 'poker', label: '扑克牌', desc: '63×88mm' },
  { value: 'bridge', label: '桥牌', desc: '57×89mm' },
  { value: 'tarot', label: '塔罗牌', desc: '70×120mm' },
  { value: 'custom', label: '自定义', desc: '自由尺寸' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function Home() {
  const navigate = useNavigate()
  const projects = useProjectStore(s => s.projects)
  const addProject = useProjectStore(s => s.addProject)
  const deleteProject = useProjectStore(s => s.deleteProject)

  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<SizePreset>('poker')
  const [customW, setCustomW] = useState(63)
  const [customH, setCustomH] = useState(88)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const sortedByRecent = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [projects]
  )

  const recentProjects = sortedByRecent.slice(0, 4)

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    const w = preset === 'custom' ? customW : undefined
    const h = preset === 'custom' ? customH : undefined
    const id = addProject(trimmed, preset, w, h)
    setName('')
    setPreset('poker')
    setCustomW(63)
    setCustomH(88)
    setModalOpen(false)
    navigate(`/canvas/${id}`)
  }

  function handleDelete(id: string) {
    deleteProject(id)
    setDeleteId(null)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden font-body">
      <aside className="w-[72px] flex flex-col items-center py-4 gap-1 wood-texture border-r border-forge-border flex-shrink-0">
        <div className="mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-forge-gold-dark to-forge-gold-light flex items-center justify-center">
            <span className="font-display text-forge-bg text-lg font-bold">C</span>
          </div>
        </div>
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all duration-200',
              isActive
                ? 'bg-forge-gold/15 text-forge-gold'
                : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-gold/8'
            )
          }
        >
          <FolderOpen size={20} />
          <span className="text-[10px] mt-0.5">首页</span>
        </NavLink>
      </aside>

      <main className="flex-1 overflow-y-auto bg-forge-bg">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <header className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl font-display gold-shimmer mb-3">卡牌工坊</h1>
            <p className="text-forge-text-secondary text-base tracking-wide">
              打造属于你的桌游卡牌世界
            </p>
          </header>

          <section className="flex justify-center mb-12 animate-fade-in">
            <button
              className="btn-gold text-lg px-8 py-3 flex items-center gap-2 rounded-xl"
              onClick={() => setModalOpen(true)}
            >
              <Plus size={22} />
              新建项目
            </button>
          </section>

          {projects.length === 0 ? (
            <section className="animate-fade-in">
              <div className="card-frame rounded-2xl p-12 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                <div className="w-28 h-36 rounded-xl border-2 border-dashed border-forge-border flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-2 rounded-lg border border-forge-gold/20 bg-forge-elevated/40" />
                  <span className="font-display text-forge-gold/50 text-3xl">?</span>
                </div>
                <h3 className="text-forge-text text-lg font-medium mb-2">还没有项目</h3>
                <p className="text-forge-text-secondary text-sm mb-6 max-w-xs">
                  点击「新建项目」开始你的第一副卡牌设计，选择卡牌尺寸，释放无限创意
                </p>
                <button
                  className="btn-outline flex items-center gap-2 text-sm"
                  onClick={() => setModalOpen(true)}
                >
                  <Plus size={16} />
                  立即开始
                </button>
              </div>
            </section>
          ) : (
            <>
              {recentProjects.length > 0 && (
                <section className="mb-10 animate-fade-in">
                  <h2 className="text-forge-text text-base font-medium mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-forge-gold" />
                    最近编辑
                  </h2>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {recentProjects.map(p => (
                      <button
                        key={p.id}
                        className="card-frame flex-shrink-0 w-52 p-4 text-left group hover:card-frame-gold rounded-xl transition-all duration-300"
                        onClick={() => navigate(`/canvas/${p.id}`)}
                      >
                        <div className="w-12 h-16 rounded-md bg-forge-elevated border border-forge-border mb-3 flex items-center justify-center overflow-hidden">
                          {p.thumbnail ? (
                            <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FolderOpen size={16} className="text-forge-text-muted" />
                          )}
                        </div>
                        <p className="text-forge-text text-sm font-medium truncate">{p.name}</p>
                        <p className="text-forge-text-muted text-xs mt-1">
                          {p.cardWidth}×{p.cardHeight}mm
                        </p>
                        <div className="mt-2 flex items-center text-forge-gold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          打开 <ArrowRight size={12} className="ml-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="animate-fade-in">
                <h2 className="text-forge-text text-base font-medium mb-4 flex items-center gap-2">
                  <FolderOpen size={18} className="text-forge-gold" />
                  所有项目
                </h2>
                <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
                  {sortedByRecent.map(p => (
                    <div
                      key={p.id}
                      className="card-frame p-5 group hover:border-forge-gold hover:shadow-[0_0_20px_rgba(212,168,83,0.15)] rounded-xl transition-all duration-300 relative"
                    >
                      <button
                        className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-forge-text-muted hover:text-forge-crimson hover:bg-forge-crimson/10 opacity-0 group-hover:opacity-100 transition-all"
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteId(p.id)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>

                      <button
                        className="w-full text-left"
                        onClick={() => navigate(`/canvas/${p.id}`)}
                      >
                        <div className="w-14 h-[4.5rem] rounded-lg bg-forge-elevated border border-forge-border mb-3 flex items-center justify-center overflow-hidden">
                          {p.thumbnail ? (
                            <img src={p.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <div
                                className="border border-forge-gold/30 rounded bg-forge-gold/5"
                                style={{
                                  width: `${(p.cardWidth / 120) * 100}%`,
                                  height: `${(p.cardHeight / 120) * 100}%`,
                                  maxWidth: '90%',
                                  maxHeight: '90%',
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <p className="text-forge-text text-sm font-medium truncate">{p.name}</p>
                        <p className="text-forge-text-muted text-xs mt-1">
                          {p.sizePreset === 'custom' ? '自定义' : CARD_PRESETS[p.sizePreset]?.label} · {p.cardWidth}×{p.cardHeight}mm
                        </p>
                        <p className="text-forge-text-muted text-xs mt-0.5">{formatDate(p.createdAt)}</p>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新建项目">
        <div className="space-y-5">
          <div>
            <label className="block text-forge-text-secondary text-sm mb-1.5">项目名称</label>
            <input
              className="input-field w-full"
              placeholder="输入项目名称…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-forge-text-secondary text-sm mb-2">卡牌尺寸</label>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left transition-all duration-200',
                    preset === opt.value
                      ? 'border-forge-gold bg-forge-gold/10 text-forge-gold'
                      : 'border-forge-border bg-forge-elevated text-forge-text-secondary hover:border-forge-gold/40'
                  )}
                  onClick={() => setPreset(opt.value)}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="block text-xs mt-0.5 opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' && (
            <div className="flex gap-3 animate-fade-in">
              <div className="flex-1">
                <label className="block text-forge-text-secondary text-sm mb-1.5">宽度 (mm)</label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={customW}
                  onChange={e => setCustomW(Number(e.target.value))}
                  min={20}
                  max={300}
                />
              </div>
              <div className="flex-1">
                <label className="block text-forge-text-secondary text-sm mb-1.5">高度 (mm)</label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={customH}
                  onChange={e => setCustomH(Number(e.target.value))}
                  min={20}
                  max={300}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              取消
            </button>
            <button
              className="btn-gold"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              创建
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="删除项目"
      >
        <p className="text-forge-text-secondary mb-6">确定要删除此项目吗？此操作不可撤销。</p>
        <div className="flex justify-end gap-3">
          <button className="btn-outline" onClick={() => setDeleteId(null)}>
            取消
          </button>
          <button
            className="bg-forge-crimson text-white px-5 py-2 rounded-lg font-medium hover:bg-forge-crimson/80 transition-colors"
            onClick={() => deleteId && handleDelete(deleteId)}
          >
            确认删除
          </button>
        </div>
      </Modal>
    </div>
  )
}
