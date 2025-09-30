import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { SiteHeader } from '@/components/site-header'
import { GeistSans } from 'geist/font/sans'
import { cn } from '@/utilities/cn'
import { QueryProvider } from '@/providers/QueryProvider'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import type { Metadata } from 'next'

import './globals.css'
import { AppSidebar } from '@/components/app-sidebar'
import { requireClientAuth } from '@/utilities/auth/requireClientAuth'

export const metadata: Metadata = {
  title: 'Client Dashboard - MI Drug Test',
  description:
    'Secure client dashboard for managing drug test appointments, viewing results, and tracking medications.',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Protect all dashboard routes by checking authentication here
  // This will redirect to sign-in if user is not authenticated
  // or redirect to admin if user is an admin
  await requireClientAuth()

  return (
    <html className={cn(GeistSans.variable)} lang="en" suppressHydrationWarning>
      <body className={cn('antialiased')} suppressHydrationWarning>
        <QueryProvider>
          <SidebarProvider>
            {/* <DashboardSidebar variant="inset" /> */}
            <AppSidebar variant="inset" />
            <SidebarInset>
              <SiteHeader />
              <div className="flex flex-1 flex-col">
                <div className="@container/main flex flex-1 flex-col gap-2">
                  <ErrorBoundary>{children}</ErrorBoundary>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  )
}
