'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  ClipboardListIcon,
  DatabaseIcon,
  FileIcon,
  FlaskConical,
  LayoutDashboardIcon,
  PillBottle,
  UserPen,
  UsersIcon,
} from 'lucide-react'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { Client } from '@/payload-types'

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: LayoutDashboardIcon,
    },
    // {
    //   title: "Technicians",
    //   url: "/dashboard/technicians",
    //   icon: UsersIcon,
    // },
    {
      title: 'Test Results',
      url: '/dashboard/results',
      icon: ClipboardList,
    },
    {
      title: 'Medications',
      url: '/dashboard/medications',
      icon: PillBottle,
    },
    // TODO: Implement appointments page with real data
    {
      title: 'Appointments',
      url: '/dashboard/appointments',
      icon: DatabaseIcon,
    },
    {
      title: 'Profile',
      url: '/dashboard/profile',
      icon: UserPen,
    },
  ],
  navSecondary: [
    // TODO: Create settings page with user preferences
    // {
    //   title: "Settings",
    //   url: "/dashboard/settings",
    //   icon: SettingsIcon,
    // },
    // TODO: Create help/support page with documentation
    // {
    //   title: "Get Help",
    //   url: "/dashboard/help",
    //   icon: HelpCircleIcon,
    // },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: Client
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
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
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
