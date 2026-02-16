'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button, buttonVariants } from '@/components/ui/button'
import { Icons } from '../../components/Icons'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { isActiveRoute } from '@/utilities/isActiveRoute'
import { CompanyInfo, Header } from '@/payload-types'
import { CMSLink } from '@/components/Link'
import { SheetLogo } from '@/components/Logo'
import { MobileAuthButton } from '@/components/AuthButton/MobileAuthButton'

export type NavItem = NonNullable<Header['navItems']>[number]

export function MobileNav({ navItems, contact }: { navItems: NavItem[]; contact?: CompanyInfo['contact']  }) {
  const [open, setOpen] = useState(false)
  const currentPathName = usePathname()

  const cleanedPhone = contact?.phone ? contact.phone.replace(/\D/g, '') : null

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
        <SheetContent side="right" className="w-72 p-8 sm:w-1/2">
          <SheetHeader>
            <SheetTitle>
              {/* <span className="sr-only">{companyName}</span> */}
              <SheetLogo name={contact?.name ?? 'MI Drug Test LLC'} />
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-9rem)] py-10">
            <nav className="flex flex-col items-center space-y-4">
              <MobileAuthButton onClose={() => setOpen(false)} />
              {navItems.map(({ link }, i) => {
                const slug =
                  link.type === 'custom' && link.url
                    ? link.url.replace(/^\//, '') // Remove leading slash for custom URLs
                    : typeof link.reference?.value === 'object'
                      ? link.reference?.relationTo === 'pages' &&
                        typeof link.reference.value.slug === 'string'
                        ? link.reference.value.slug
                        : link.reference?.relationTo === 'media' &&
                            typeof link.reference.value.url === 'string'
                          ? link.reference.value.url
                          : ''
                      : ''
                return (
                  <CMSLink
                    key={i}
                    {...link}
                    appearance="nav"
                    className={cn('text-lg', {
                      'border-b-primary border-opacity-100 text-primary rounded-br-lg rounded-bl-lg border-b-2':
                        isActiveRoute(currentPathName as string, slug),
                    })}
                    onClick={() => {
                      setOpen(false)
                    }}
                  />
                )
              })}
            </nav>
          </ScrollArea>
          {/* Fixed Footer with Call and Directions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
            <div className="flex flex-col space-y-2">
              <a
                href={cleanedPhone ? `tel:${cleanedPhone}` : '#'}
                className={cn(
                  buttonVariants({ variant: 'default', size: 'default' }),
                  'w-full justify-center'
                )}
                onClick={() => setOpen(false)}
              >
                <Icons.phone className="mr-2 size-4" />
                Call Now
              </a>
              <a
                href={contact?.physicalAddress?.googleMapLink ?? '#'}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'default' }),
                  'w-full justify-center'
                )}
                onClick={() => setOpen(false)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icons.navigation className="mr-2 size-4" />
                Get Directions
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
