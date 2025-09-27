'use client'

import { cn } from '@/utilities/cn'
import { CMSLink } from '@/components/Link'
import { Icons } from '@/components/Icons'
import { useAuth } from '@/hooks/useAuth'

export function AuthButton() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center">
        <Icons.spinner className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  if (user) {
    const accountUrl = user.collection === 'clients' ? '/dashboard' : '/admin'
    const accountLabel = user.collection === 'clients' ? 'Account' : 'Admin'

    return (
      <CMSLink
        type="custom"
        url={accountUrl}
        appearance="default"
        className={cn('hidden md:inline-flex')}
        size={'sm'}
      >
        <Icons.user className="mr-2 h-4 w-4" />
        {accountLabel}
      </CMSLink>
    )
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <CMSLink type="custom" url="/sign-in" appearance="inline" size='sm' className={cn('sm:min-w-0')}>
        Sign In
      </CMSLink>
      <CMSLink type="custom" url="/register" appearance="default" size="sm" className={cn('sm:min-w-0')}>
        Register
      </CMSLink>
    </div>
  )
}