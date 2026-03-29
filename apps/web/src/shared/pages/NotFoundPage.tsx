import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <AlertTriangle size={64} className="text-yellow-500 mb-6" />
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">
        Strona nie znaleziona
      </p>
      <Link
        to="/"
        className="px-6 py-3 border-2 border-primary text-primary bg-transparent rounded-lg font-medium hover:bg-primary/10 transition-colors"
      >
        Wróć do Overview
      </Link>
    </div>
  )
}