'use client'

import { PlusCircleIcon, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isActiveRoute } from '@/utilities/isActiveRoute'
import type { Client } from '@/payload-types'
import { CalPopupButton } from '@/components/cal-popup-button'
import { buildCalConfig, getClientBookingCalLink } from '@/utilities/calcom-config'

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
  const { isMobile, setOpenMobile, state } = useSidebar()

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
            <Tooltip>
              <TooltipTrigger asChild>
                <CalPopupButton
                  calUsername={getClientBookingCalLink(client)}
                  config={buildCalConfig(client)}
                  className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                  onModalOpen={() => {
                    if (isMobile) {
                      setOpenMobile(false)
                    }
                  }}
                >
                  <PlusCircleIcon />
                  <span className="group-data-[collapsible=icon]:hidden">Quick Booking</span>
                </CalPopupButton>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" hidden={state !== 'collapsed' || isMobile}>
                Quick Booking
              </TooltipContent>
            </Tooltip>
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
