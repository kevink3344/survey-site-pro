import { BarChart3, ClipboardList, Menu, MessageSquareText, Moon, Pin, Settings, Sun, UserRound, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../lib/helpers'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/surveys', label: 'Surveys', icon: ClipboardList },
  { to: '/responses', label: 'Responses', icon: MessageSquareText },
]

export function AppShell({
  children,
  darkMode,
  onToggleMode,
}: {
  children: ReactNode
  darkMode: boolean
  onToggleMode: () => void
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const isSettings = location.pathname === '/settings'
  const isPinnedSurveys = location.pathname === '/surveys/pinned'

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="h-14 px-4 border-b border-border flex items-center justify-between">
        <p className="text-lg font-semibold">HR Survey Pro</p>
        <button
          type="button"
          className="md:hidden h-8 w-8 border border-border rounded-sm grid place-items-center"
          onClick={() => setMobileNavOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="px-3 py-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/dashboard'}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'h-9 px-3 rounded-sm text-sm flex items-center gap-2',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          )
        })}
      </nav>

    </div>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:block md:fixed md:inset-y-0 md:left-0 md:w-56 md:border-r md:border-border md:bg-background">
        {sidebarContent}
      </aside>

      <div
        className={cn(
          'fixed inset-0 bg-black/30 z-40 md:hidden transition-opacity',
          mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 border-r border-border bg-background transition-transform md:hidden',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <main className="w-full min-h-screen md:ml-56 md:h-screen md:overflow-y-auto md:w-[calc(100vw-224px)]">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <div className="h-14 px-4 md:px-6 max-w-[1200px] mx-auto flex items-center justify-between">
            <div>
              <button
                type="button"
                className="md:hidden h-9 px-3 border border-border rounded-sm inline-flex items-center gap-2 text-sm"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-4 w-4" />
                Menu
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Pinned surveys"
                onClick={() => navigate('/surveys/pinned')}
                className={cn(
                  'h-9 w-9 rounded-sm border border-border inline-flex items-center justify-center',
                  isPinnedSurveys ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Pin className="h-4 w-4" />
              </button>

              <button
                type="button"
                aria-label="Settings"
                onClick={() => navigate('/settings')}
                className={cn(
                  'h-9 w-9 rounded-sm border border-border inline-flex items-center justify-center',
                  isSettings ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                type="button"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={onToggleMode}
                className="h-9 w-9 rounded-sm border border-border inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <div className="relative group">
                <button
                  type="button"
                  aria-label="User profile"
                  className="h-9 w-9 rounded-sm border border-border inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <UserRound className="h-4 w-4" />
                </button>
                <div className="absolute right-0 mt-2 w-52 border border-border rounded-sm bg-popover p-3 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
                  <p className="text-sm font-medium">Test User</p>
                  <p className="text-xs text-muted-foreground">Administrator</p>
                  <p className="text-xs text-muted-foreground mt-1">admin@wcpss.net</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6 max-w-[1200px] mx-auto">{children}</div>
      </main>
    </div>
  )
}
