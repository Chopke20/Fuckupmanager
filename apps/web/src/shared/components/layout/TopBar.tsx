import { Bell, User } from 'lucide-react'
import GlobalSearch from '../GlobalSearch'
import { useState } from 'react'
import { useAuth } from '../../../modules/auth/AuthProvider'

export default function TopBar() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="h-12 bg-surface border-b border-border px-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0 max-w-3xl">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
        </button>
        <div className="h-6 w-px bg-border"></div>
        <div className="relative">
          <button className="flex items-center gap-2 p-1 hover:bg-surface-2 rounded" onClick={() => setMenuOpen((v) => !v)}>
            <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium">{user?.fullName || user?.username || 'Użytkownik'}</p>
              <p className="text-[10px] text-muted-foreground">{user?.role || 'Brak roli'}</p>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-card border border-border rounded shadow-lg z-20">
              <button
                className="w-full text-left text-sm px-3 py-2 hover:bg-surface"
                onClick={async () => {
                  setMenuOpen(false)
                  await logout()
                  window.location.href = '/login'
                }}
              >
                Wyloguj
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}