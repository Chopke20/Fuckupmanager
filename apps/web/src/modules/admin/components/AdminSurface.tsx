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
        // Podbijamy kontrast: panel wyraźnie jaśniejszy od tła aplikacji.
        'rounded-xl border border-[#2A2A2A] bg-[#141414]',
        'shadow-[0_22px_56px_rgba(0,0,0,0.72)]',
        'ring-1 ring-white/5',
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
        // Header ma być jednoznacznie "paskiem".
        'px-4 py-3 bg-[#202020] border-b border-[#2E2E2E]',
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
        // Karta jeszcze jaśniejsza od panelu: widoczne "karta w panelu".
        'rounded-lg border border-[#2F2F2F] bg-[#1A1A1A]',
        'shadow-[0_10px_22px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]',
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
        'px-3 py-2 bg-[#262626] border-b border-[#333333]',
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

