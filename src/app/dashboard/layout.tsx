import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/site-header'
import { GeistSans } from 'geist/font/sans'
import { cn } from '@/utilities/cn'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { Metadata } from 'next'

import './globals.css'
import { AppSidebar } from '@/components/app-sidebar'
import { getAuthenticatedClient } from '@/utilities/auth/getAuthenticatedClient'
import { VersionSkewToastHydrator } from '@/components/VersionSkewToastHydrator'

export const metadata: Metadata = {
  title: 'Client Dashboard - MI Drug Test',
  description:
    'Secure client dashboard for managing drug test appointments, viewing results, and tracking medications.',
  robots: {
    index: false,
    follow: false,
  },
}

// Force dynamic rendering for fresh data on every request
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Get authenticated client - this will redirect if not authenticated
  const client = await getAuthenticatedClient()

  return (
    <html className={cn(GeistSans.variable)} lang="en" suppressHydrationWarning>
      <body className={cn('antialiased')} suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar variant="inset" user={client} />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <VersionSkewToastHydrator />
        <Toaster />
      </body>
    </html>
  )
}
