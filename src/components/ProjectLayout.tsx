import { NavLink, useParams } from 'react-router-dom'
import {
  Home,
  PenTool,
  Layers,
  Shapes,
  BookOpen,
  Play,
  Printer,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'

const navItems = [
  { to: '/', icon: Home, label: '首页' },
]

const projectNavItems = (pid: string) => [
  { to: `/canvas/${pid}`, icon: PenTool, label: '画布' },
  { to: `/decks/${pid}`, icon: Layers, label: '牌组' },
  { to: `/icons/${pid}`, icon: Shapes, label: '图标' },
  { to: `/rules/${pid}`, icon: BookOpen, label: '规则' },
  { to: `/preview/${pid}`, icon: Play, label: '试玩' },
  { to: `/export/${pid}`, icon: Printer, label: '导出' },
]

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams()
  const project = useProjectStore(s => s.getProject(projectId || ''))
  const items = projectId ? projectNavItems(projectId) : navItems

  return (
    <div className="flex h-screen w-screen overflow-hidden font-body">
      <aside className="w-[72px] flex flex-col items-center py-4 gap-1 wood-texture border-r border-forge-border flex-shrink-0">
        <div className="mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-forge-gold-dark to-forge-gold-light flex items-center justify-center">
            <span className="font-display text-forge-bg text-lg font-bold">C</span>
          </div>
        </div>

        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-forge-gold/15 text-forge-gold'
                  : 'text-forge-text-secondary hover:text-forge-text hover:bg-forge-gold/8'
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        ))}

        {projectId && (
          <NavLink
            to="/"
            className="mt-auto w-12 h-12 flex flex-col items-center justify-center rounded-lg text-forge-text-secondary hover:text-forge-text hover:bg-forge-gold/8 transition-all duration-200"
          >
            <Home size={20} />
            <span className="text-[10px] mt-0.5">首页</span>
          </NavLink>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {project && (
          <header className="h-12 flex items-center px-6 border-b border-forge-border bg-forge-surface/60 backdrop-blur-sm flex-shrink-0">
            <h1 className="text-sm font-medium text-forge-text">{project.name}</h1>
            <span className="ml-3 text-xs text-forge-text-muted">
              {project.cardWidth}×{project.cardHeight}mm
            </span>
          </header>
        )}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
