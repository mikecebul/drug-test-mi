'use client'

import type { CompanyInfo, Header } from '@/payload-types'
import { cn } from '@/utilities/cn'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/Icons'
import { MainNav } from './MainNav'
import { MobileNav } from './MobileNav'
import { DashboardLogo, Logo } from '@/components/Logo'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import { baseUrl } from '@/utilities/baseUrl'
import { AuthButton } from '@/components/AuthButton'

export const HeaderClient = ({
  header,
  contact,
}: {
  header: Header
  contact: CompanyInfo['contact']
}) => {
  const navItems = header?.navItems || []
  const { phone, name: companyName } = contact || {}
  const cleanedPhone = phone ? phone.replace(/\D/g, '') : null

  return (
    <header className="bg-background/50 sticky top-0 z-40 flex w-full flex-col overflow-clip backdrop-blur-xs">
      <PayloadAdminBar
        cmsURL={baseUrl}
        collectionSlug="pages"
        logo={<DashboardLogo name={'Dashboard'} />}
        classNames={{
          logout: 'mr-8',
          logo: 'ml-8 text-white',
        }}
        className="static!"
      />
      <div className="flex w-full items-center px-4 py-3 md:px-8 2xl:container 2xl:mx-auto">
        <Logo name={companyName ?? 'MI Drug Test LLC'} />
        <MainNav navItems={navItems} />
        <MobileNav navItems={navItems} contact={contact} />
        <div className="lg:flex flex-col items-center gap-4 hidden">
          <AuthButton />
          <div className="flex flex-col items-center text-lg lg:flex-row 2xl:space-x-2">
            <a
              href={cleanedPhone ? `tel:${cleanedPhone}` : '#'}
              className={cn(
                buttonVariants({ variant: 'text' }),
                'text-primary pr-0 md:text-lg',
              )}
            >
              <Icons.phone className="mr-2 size-4 shrink-0 md:size-5 lg:size-4" />
              {phone}
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}
