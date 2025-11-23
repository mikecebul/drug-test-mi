'use client'

import { PlusCircleIcon, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { isActiveRoute } from '@/utilities/isActiveRoute'
import type { Client } from '@/payload-types'
import { CalPopupButton } from '@/components/cal-popup-button'
import { buildCalConfig } from '@/utilities/calcom-config'

export function NavMain({
  items,
  client,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
  client: Client
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <CalPopupButton
              config={buildCalConfig(client)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              onModalOpen={() => {
                if (isMobile) {
                  setOpenMobile(false)
                }
              }}
            >
              <PlusCircleIcon />
              <span>Quick Booking</span>
            </CalPopupButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isActiveRoute(pathname, item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} asChild isActive={isActive}>
                  <Link href={item.url} onClick={handleLinkClick}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
