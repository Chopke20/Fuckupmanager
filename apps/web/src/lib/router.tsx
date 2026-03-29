import type { ReactNode } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../shared/components/layout/AppLayout'
import OverviewPage from '../modules/overview/pages/OverviewPage'
import OverviewPageV4 from '../modules/overview/pages/OverviewPageV4'
import OrdersPage from '../modules/orders/pages/OrdersPage'
import OrderFormPage from '../modules/orders/pages/OrderFormPage'
import OrderOfferPage from '../modules/orders/pages/OrderOfferPage'
import OrderProposalPage from '../modules/orders/pages/OrderProposalPage'
import OrderWarehousePage from '../modules/orders/pages/OrderWarehousePage'
import OrderBriefPage from '../modules/orders/pages/OrderBriefPage'
import ClientsPage from '../modules/clients/pages/ClientsPage'
import EquipmentPage from '../modules/equipment/pages/EquipmentPage'
import ResourcesPage from '../modules/resources/pages/ResourcesPage'
import TrashPage from '../modules/trash/pages/TrashPage'
import NotFoundPage from '../shared/pages/NotFoundPage'
import FinanceDashboardPage from '../modules/finance/pages/FinanceDashboardPage'
import LoginPage from '../modules/auth/pages/LoginPage'
import ForgotPasswordPage from '../modules/auth/pages/ForgotPasswordPage'
import ResetPasswordPage from '../modules/auth/pages/ResetPasswordPage'
import AcceptInvitePage from '../modules/auth/pages/AcceptInvitePage'
import { RequireAuth, RequirePermission } from '../modules/auth/RequireAuth'
import AdminUsersPage from '../modules/admin/pages/AdminUsersPage'

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  )
}

/** Data router — wymagany m.in. dla `useBlocker` w formularzu zlecenia. */
export const appRouter = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  { path: '/', element: <ProtectedLayout><OverviewPage /></ProtectedLayout> },
  { path: '/v4', element: <ProtectedLayout><OverviewPageV4 /></ProtectedLayout> },
  { path: '/orders', element: <ProtectedLayout><OrdersPage /></ProtectedLayout> },
  { path: '/orders/new', element: <ProtectedLayout><OrderFormPage /></ProtectedLayout> },
  { path: '/orders/:id', element: <ProtectedLayout><OrderFormPage /></ProtectedLayout> },
  { path: '/orders/:id/offer', element: <ProtectedLayout><OrderOfferPage /></ProtectedLayout> },
  { path: '/orders/:id/proposal', element: <ProtectedLayout><OrderProposalPage /></ProtectedLayout> },
  { path: '/orders/:id/warehouse', element: <ProtectedLayout><OrderWarehousePage /></ProtectedLayout> },
  { path: '/orders/:id/brief', element: <ProtectedLayout><OrderBriefPage /></ProtectedLayout> },
  { path: '/clients', element: <ProtectedLayout><ClientsPage /></ProtectedLayout> },
  { path: '/equipment', element: <ProtectedLayout><EquipmentPage /></ProtectedLayout> },
  { path: '/resources', element: <ProtectedLayout><ResourcesPage /></ProtectedLayout> },
  { path: '/trash', element: <ProtectedLayout><TrashPage /></ProtectedLayout> },
  { path: '/finance', element: <ProtectedLayout><FinanceDashboardPage /></ProtectedLayout> },
  {
    path: '/admin',
    element: (
      <ProtectedLayout>
        <RequirePermission permission="admin.users.read">
          <AdminUsersPage />
        </RequirePermission>
      </ProtectedLayout>
    ),
  },
  { path: '*', element: <ProtectedLayout><NotFoundPage /></ProtectedLayout> },
])

export default function AppRouterProvider() {
  return <RouterProvider router={appRouter} />
}
