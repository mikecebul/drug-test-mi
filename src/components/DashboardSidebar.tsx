'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowUpCircleIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileIcon,
  FlaskConical,
  HelpCircleIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { ClientLogoutButton } from '@/components/ClientLogoutButton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useClientDashboard } from '@/hooks/useClientDashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const navMainItems = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboardIcon,
  },
  {
    title: 'Test Results',
    url: '/dashboard/results',
    icon: ClipboardListIcon,
  },
  {
    title: 'Medications',
    url: '/dashboard/medications',
    icon: FileIcon,
  },
  {
    title: 'Appointments',
    url: '/dashboard/appointments',
    icon: DatabaseIcon,
  },
  {
    title: 'Profile',
    url: '/dashboard/profile',
    icon: UsersIcon,
  },
]

const navSecondaryItems = [
  {
    title: 'Settings',
    url: '/dashboard/settings',
    icon: SettingsIcon,
  },
  {
    title: 'Get Help',
    url: '/dashboard/help',
    icon: HelpCircleIcon,
  },
]

function SidebarUserSection() {
  const { data: dashboardData, isLoading } = useClientDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-32" />
        </div>
      </div>
    )
  }

  const { user } = dashboardData || {}
  if (!user) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-medium">Unknown User</p>
          <p className="text-muted-foreground text-xs">Loading...</p>
        </div>
      </div>
    )
  }

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '??'

  return (
    <div className="flex items-center gap-2 p-2">
      <Avatar  className="h-8 w-8">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
      </div>
    </div>
  )
}

export function DashboardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/dashboard">
                <FlaskConical className="h-5 w-5" />
                <span className="text-base font-semibold">MI Drug Test</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavSecondary items={navSecondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserSection />
      </SidebarFooter>
    </Sidebar>
  )
}
