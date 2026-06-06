'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Icons } from '../../components/Icons'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { isActiveRoute } from '@/utilities/isActiveRoute'
import { CompanyInfo, Header } from '@/payload-types'
import { SheetLogo } from '@/components/Logo'
import { Icon } from '@/components/Icons/Icon'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { HeaderAuthUser } from './types'

export type NavItem = NonNullable<Header['navItems']>[number]

export function MobileNav({
  authUser,
  navItems,
  contact,
}: {
  authUser: HeaderAuthUser
  navItems: NavItem[]
  contact?: CompanyInfo['contact']
}) {
  const [open, setOpen] = useState(false)
  const currentPathName = usePathname()

  const cleanedPhone = contact?.phone ? contact.phone.replace(/\D/g, '') : null
  const accountUrl = authUser ? (authUser.collection === 'clients' ? '/dashboard' : '/admin') : null
  const accountLabel = authUser ? (authUser.collection === 'clients' ? 'Dashboard' : 'Admin') : null

  const getHref = (link: NavItem['link']) =>
    link.type === 'reference' && typeof link.reference?.value === 'object'
      ? link.reference.relationTo === 'media' && 'url' in link.reference.value
        ? link.reference.value.url
        : link.reference.relationTo === 'pages' && 'slug' in link.reference.value
          ? `/${link.reference.value.slug}`
          : null
      : link.url

  const getSlug = (link: NavItem['link']) => {
    const href = getHref(link)
    if (!href) return ''

    return href.replace(/^\//, '')
  }

  const closeDrawer = () => setOpen(false)

  const handleSignOut = async () => {
    if (!authUser?.collection) return

    try {
      await fetch(`/api/${authUser.collection}/logout`, {
        credentials: 'include',
        method: 'POST',
      })
    } finally {
      closeDrawer()
      window.location.href = '/'
    }
  }

  return (
    <div className="flex items-center lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            className="bg-accent text-accent-foreground hover:bg-muted-foreground/20 h-8 w-8 p-0"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <Icons.closeMenu className="h-8 w-8" />
            ) : (
              <Icons.openMenu className="h-8 w-8" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex h-dvh w-[min(88vw,390px)] flex-col p-5 sm:w-[390px]"
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>
              <SheetLogo name={contact?.name ?? 'MI Drug Test LLC'} />
            </SheetTitle>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col pt-7">
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto pb-6">
              {authUser && accountUrl ? (
                <div className="border-border bg-card grid grid-cols-2 overflow-hidden rounded-xl border shadow-xs">
                  <Link
                    href={accountUrl}
                    className="border-border hover:bg-muted/60 flex h-12 items-center justify-center gap-2 border-r px-4 text-base font-semibold transition-colors"
                    onClick={closeDrawer}
                  >
                    <Icons.user className="size-4" />
                    {accountLabel}
                  </Link>
                  <button
                    type="button"
                    className="hover:bg-muted/60 flex h-12 items-center justify-center px-4 text-base font-semibold transition-colors"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="border-border bg-card grid grid-cols-2 overflow-hidden rounded-xl border shadow-xs">
                  <Link
                    href="/sign-in"
                    className="border-border hover:bg-muted/60 flex h-12 items-center justify-center border-r px-4 text-base font-semibold transition-colors"
                    onClick={closeDrawer}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 items-center justify-center px-4 text-base font-semibold transition-colors"
                    onClick={closeDrawer}
                  >
                    Register
                  </Link>
                </div>
              )}

              <nav aria-label="Primary navigation" className="divide-border border-border divide-y border-y">
                {navItems.map(({ icon, link }, i) => {
                  const href = getHref(link)
                  if (!href) return null

                  const slug = getSlug(link)
                  const isActive = isActiveRoute(currentPathName as string, slug)

                  return (
                    <Link
                      key={i}
                      href={href}
                      className={cn(
                        'text-foreground hover:text-primary flex min-h-14 items-center gap-4 px-2 text-lg font-semibold transition-colors',
                        isActive && 'bg-primary/5 text-primary',
                      )}
                      onClick={closeDrawer}
                    >
                      {icon ? (
                        <Icon name={icon as never} className="size-5 shrink-0" />
                      ) : null}
                      <span className="flex-1">{link.label}</span>
                      <ChevronRight className="size-5 shrink-0" />
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="shrink-0 border-t border-border pt-4">
              <div className="border-border bg-card grid grid-cols-2 overflow-hidden rounded-xl border shadow-xs">
                <a
                  href={cleanedPhone ? `tel:${cleanedPhone}` : '#'}
                  className="border-border hover:bg-muted/60 flex h-11 items-center justify-center gap-2 border-r px-3 text-base font-semibold transition-colors"
                  onClick={closeDrawer}
                >
                  <Icons.phone className="text-primary size-5" />
                  Call
                </a>
                <a
                  href={contact?.physicalAddress?.googleMapLink ?? '#'}
                  className="hover:bg-muted/60 flex h-11 items-center justify-center gap-2 px-3 text-base font-semibold transition-colors"
                  onClick={closeDrawer}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icons.navigation className="text-primary size-5" />
                  Directions
                </a>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
