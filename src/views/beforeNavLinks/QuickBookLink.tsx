'use client'

import dynamic from 'next/dynamic'
import { useCallback, useRef, useState } from 'react'
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

export default function QuickBookLink() {
  const [open, setOpen] = useState(false)
  const closeResolverRef = useRef<(() => void) | null>(null)

  const closeDrawerBeforeBooking = useCallback(async () => {
    if (!open) return

    await new Promise<void>((resolve) => {
      closeResolverRef.current = resolve
      setOpen(false)
    })
  }, [open])

  const handleOpenChangeComplete = useCallback((isOpen: boolean) => {
    if (isOpen) return

    const resolve = closeResolverRef.current
    closeResolverRef.current = null
    resolve?.()
  }, [])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) {
      closeResolverRef.current = null
    }
  }, [])

  return (
    <ShadcnWrapper className="w-full py-1.5">
      <Drawer
        swipeDirection="right"
        open={open}
        onOpenChange={handleOpenChange}
        onOpenChangeComplete={handleOpenChangeComplete}
      >
        <DrawerTrigger
          render={<Button type="button" variant="secondary" className="w-full min-w-0 justify-start" />}
        >
          <Search data-icon="inline-start" />
          Quick Book
        </DrawerTrigger>
        <DrawerContent className="bg-background shadow-2xl data-[swipe-direction=right]:w-[min(704px,calc(100vw-16px))] data-[swipe-direction=right]:border-l-2 data-[swipe-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b">
            <DrawerTitle>Quick Book</DrawerTitle>
            <DrawerDescription>
              Book an existing client or start a clean appointment from anywhere in admin.
            </DrawerDescription>
          </DrawerHeader>
          <div className="no-scrollbar flex-1 overflow-y-auto p-4">
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
