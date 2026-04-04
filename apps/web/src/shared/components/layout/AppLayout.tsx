import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

interface AppLayoutProps {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'main-unknown'

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
      <div className="fixed left-3 bottom-2 z-40 text-[10px] font-mono text-muted-foreground/90 bg-surface/80 border border-border rounded px-2 py-1">
        {appVersion}
      </div>
    </div>
  )
}