import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import { Film, LayoutDashboard, PlaySquare, FolderOpen, Settings, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Layout() {
  const routerState = useRouterState()
  const activePath = routerState.location.pathname

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'YouTube Engine', icon: PlaySquare, path: '/youtube' },
    { name: 'TikTok Engine', icon: Film, path: '/tiktok' },
    { name: 'Voice Lab', icon: Mic, path: '/voicelab' },
    { name: 'Generations', icon: FolderOpen, path: '/generations' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ]

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar Vercel-like Minimalist */}
      <aside className="w-64 border-r border-border bg-card flex flex-col z-10 transition-all">
        <div className="p-6 flex items-center gap-3 border-b border-border">
          <Film className="w-6 h-6 text-primary" />
          <h1 className="font-semibold tracking-tight text-lg">Nexus Media</h1>
        </div>
        
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                activePath === item.path 
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-inner" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-background">
        <div className="absolute top-[-200px] right-[-200px] w-[800px] h-[800px] bg-primary/5 rounded-full blur-[200px] pointer-events-none" />
        <Outlet />
      </main>
    </div>
  )
}
