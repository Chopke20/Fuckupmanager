import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRouterProvider from './lib/router'
import { AuthProvider } from './modules/auth/AuthProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouterProvider />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App