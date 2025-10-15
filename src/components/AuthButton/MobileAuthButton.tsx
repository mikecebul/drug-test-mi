'use client'

import { cn } from '@/utilities/cn'
import { CMSLink } from '@/components/Link'
import { Icons } from '@/components/Icons'
import { useAuth } from '@payloadcms/ui'

interface MobileAuthButtonProps {
  onClose?: () => void
}

export function MobileAuthButton({ onClose }: MobileAuthButtonProps) {
  const { user } = useAuth()

  if (user) {
    const accountUrl = user.collection === 'clients' ? '/dashboard' : '/admin'
    const accountLabel = user.collection === 'clients' ? 'My Account' : 'Admin Panel'

    return (
      <div className="border-border mb-4 border-b pb-4">
        <CMSLink
          type="custom"
          url={accountUrl}
          appearance="default"
          className={cn('w-full justify-center')}
          onClick={onClose}
        >
          <Icons.user className="mr-2 h-4 w-4" />
          {accountLabel}
        </CMSLink>
      </div>
    )
  }

  return (
    <div className="border-border mb-4 space-y-2 border-b pb-4">
      <CMSLink
        type="custom"
        url="/sign-in"
        appearance="outline"
        className={cn('w-full justify-center')}
        onClick={onClose}
      >
        Sign In
      </CMSLink>
      <CMSLink
        type="custom"
        url="/register"
        appearance="default"
        className={cn('w-full justify-center')}
        onClick={onClose}
      >
        Register
      </CMSLink>
    </div>
  )
}