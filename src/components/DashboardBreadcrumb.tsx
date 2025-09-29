'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

const routeMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/medications': 'Medications',
  '/dashboard/results': 'Test Results',
  '/dashboard/profile': 'Profile',
  '/dashboard/appointments': 'Appointments',
  '/dashboard/technicians': 'Technicians',
}

export function DashboardBreadcrumb() {
  const pathname = usePathname()

  // If not in dashboard, don't render anything
  if (!pathname.startsWith('/dashboard')) {
    return null
  }

  // Handle specific route patterns
  const breadcrumbItems: Array<{ href: string; label: string; isLast: boolean }> = []

  // Always start with Dashboard
  breadcrumbItems.push({
    href: '/dashboard',
    label: 'Dashboard',
    isLast: pathname === '/dashboard'
  })

  // Handle nested routes
  if (pathname.startsWith('/dashboard/technicians/') && pathname !== '/dashboard/technicians') {
    // Technician detail page: Dashboard > Technicians > [Technician Name]
    breadcrumbItems.push({
      href: '/dashboard/technicians',
      label: 'Technicians',
      isLast: false
    })

    // Extract technician name from URL
    const technicianSlug = pathname.split('/').pop()
    const technicianName = technicianSlug
      ? technicianSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'Technician'

    breadcrumbItems.push({
      href: pathname,
      label: technicianName,
      isLast: true
    })
  } else if (pathname !== '/dashboard') {
    // Other routes: use route map or capitalize segment
    const pathSegment = pathname.split('/').pop()
    const label = routeMap[pathname] || (pathSegment ? pathSegment.charAt(0).toUpperCase() + pathSegment.slice(1) : '')
    if (label) {
      breadcrumbItems.push({
        href: pathname,
        label,
        isLast: true
      })
    }
  }

  // Update isLast flags
  breadcrumbItems.forEach((item, index) => {
    item.isLast = index === breadcrumbItems.length - 1
  })

  // Always return the same structure to avoid hydration mismatches
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <div key={item.href} className="flex items-center">
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage className="text-base font-medium">
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href} className="text-base font-medium">
                    {item.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}