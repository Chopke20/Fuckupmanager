import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Users, Package, Boxes, Trash2, Shield } from 'lucide-react'
import { useAuth } from '../../../modules/auth/AuthProvider'

export default function Sidebar() {
  const { hasPermission, user } = useAuth()
  const appName = 'Lama Stage'
  const logoSrc = user?.logoDarkBgUrl || '/logo.png'
  const companyCode = user?.companyCode || 'main'
  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/orders', label: 'Zlecenia', icon: ClipboardList },
    { to: '/clients', label: 'Klienci', icon: Users },
    { to: '/equipment', label: 'Sprzęt', icon: Package },
    { to: '/resources', label: 'Zasoby', icon: Boxes },
    { to: '/trash', label: 'Kosz', icon: Trash2 },
    ...(hasPermission('admin.users.read') ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <aside className="w-44 shrink-0 bg-black border-r border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <img src={logoSrc} alt={appName} className="h-8 w-8 object-contain" />
        <div className="min-w-0">
          <h1 className="text-base font-bold text-primary font-heading truncate">
            {appName.toUpperCase()}
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            Fuckup Manager
          </p>
        </div>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 text-sm transition-colors ${isActive
                      ? 'bg-surface text-primary border-l-2 border-primary'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="font-medium truncate">{item.label}</span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-3 border-t border-border space-y-1.5">
        <div className="text-xs text-muted-foreground leading-snug">
          v.0.5.0 • {appName} © 2026
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Firma: {companyCode}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/90 bg-surface/80 border border-border rounded px-2 py-1 leading-tight break-all">
          {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'main-unknown'}
        </div>
      </div>
    </aside>
  )
}