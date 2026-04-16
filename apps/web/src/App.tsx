import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppRouterProvider from './lib/router'
import { AuthProvider } from './modules/auth/AuthProvider'
import { BrandingProvider } from './modules/branding/BrandingProvider'

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
      <BrandingProvider>
        <AuthProvider>
          <AppRouterProvider />
        </AuthProvider>
      </BrandingProvider>
    </QueryClientProvider>
  )
}

export default App