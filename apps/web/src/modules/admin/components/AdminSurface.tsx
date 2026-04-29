import type { ReactNode } from 'react'

type AdminSurfaceProps = {
  children: ReactNode
  className?: string
}

type AdminSurfaceHeaderProps = {
  title: ReactNode
  description?: ReactNode
  right?: ReactNode
  className?: string
}

export function AdminPanel({ children, className }: AdminSurfaceProps) {
  return (
    <section
      className={[
        // Mocniejsza separacja od tła strony (Admin ma być "warstwowy").
        'rounded-xl border border-border bg-[#0F0F0F]',
        'shadow-[0_18px_44px_rgba(0,0,0,0.65)]',
        className || '',
      ].join(' ')}
    >
      {children}
    </section>
  )
}

export function AdminPanelHeader({ title, description, right, className }: AdminSurfaceHeaderProps) {
  return (
    <div
      className={[
        'px-4 py-3 bg-[#171717] border-b border-border',
        'flex items-start justify-between gap-3',
        className || '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{title}</div>
        {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

export function AdminPanelBody({ children, className }: AdminSurfaceProps) {
  return <div className={['p-4', className || ''].join(' ')}>{children}</div>
}

export function AdminCard({ children, className }: AdminSurfaceProps) {
  return (
    <div
      className={[
        'rounded-lg border border-border/90 bg-[#131313]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
        className || '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function AdminCardHeader({ title, description, right, className }: AdminSurfaceHeaderProps) {
  return (
    <div
      className={[
        'px-3 py-2 bg-[#1B1B1B] border-b border-border',
        'flex items-start justify-between gap-3',
        className || '',
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">{title}</div>
        {description ? <div className="mt-1 text-[11px] text-muted-foreground">{description}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

export function AdminCardBody({ children, className }: AdminSurfaceProps) {
  return <div className={['p-3', className || ''].join(' ')}>{children}</div>
}

