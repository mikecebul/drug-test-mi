'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'
import { Loader2, Search } from 'lucide-react'

import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

const AdminQuickBookWidgetClient = dynamic(
  () =>
    import('@/views/dashboard/widgets/AdminQuickBookWidget.client').then(
      (module) => module.AdminQuickBookWidgetClient,
    ),
  {
    loading: () => (
      <div className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading quick book...
      </div>
    ),
    ssr: false,
  },
)

const DRAWER_CLOSE_BEFORE_BOOKING_MS = 250

export default function QuickBookLink() {
  const [open, setOpen] = useState(false)

  const closeDrawerBeforeBooking = useCallback(async () => {
    setOpen(false)
    await new Promise((resolve) => setTimeout(resolve, DRAWER_CLOSE_BEFORE_BOOKING_MS))
  }, [])

  return (
    <ShadcnWrapper className="py-1.5">
      <Drawer direction="right" open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button type="button" size="lg" variant="secondary" className="w-full min-w-2xs gap-2">
            <Search className="size-[18px]" />
            Quick Book
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-background shadow-2xl data-[vaul-drawer-direction=right]:w-[min(44rem,calc(100vw-1rem))] data-[vaul-drawer-direction=right]:border-l-2 data-[vaul-drawer-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b px-6 py-5">
            <DrawerTitle className="text-2xl tracking-tight">Quick Book</DrawerTitle>
            <DrawerDescription>
              Book an existing client or start a clean appointment from anywhere in admin.
            </DrawerDescription>
          </DrawerHeader>
          <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <AdminQuickBookWidgetClient
              onBeforeOpenBooking={closeDrawerBeforeBooking}
              searchInputId="admin-nav-quick-book-search"
              resultsMode="inline"
            />
          </div>
        </DrawerContent>
      </Drawer>
    </ShadcnWrapper>
  )
}
