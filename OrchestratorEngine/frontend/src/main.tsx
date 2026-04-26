import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRoute, createRootRoute } from '@tanstack/react-router'
import './index.css'

// Import Pages
import { Layout } from './pages/Layout'
import { Dashboard } from './pages/Dashboard'
import { YouTubeEngine } from './pages/YouTubeEngine'
import { VoiceLab } from './pages/VoiceLab'
import { Generations } from './pages/Generations'

const queryClient = new QueryClient()

// Configuração Roteamento Root
const rootRoute = createRootRoute({
  component: Layout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const youtubeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/youtube',
  component: YouTubeEngine,
})

const voiceLabRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/voicelab',
  component: VoiceLab,
})

const generationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/generations',
  component: Generations,
})

const routeTree = rootRoute.addChildren([indexRoute, youtubeRoute, voiceLabRoute, generationsRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
