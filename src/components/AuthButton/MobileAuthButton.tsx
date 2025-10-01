import { cn } from '@/utilities/cn'
import { CMSLink } from '@/components/Link'
import { Icons } from '@/components/Icons'
import { getPayload } from 'payload'
import { headers } from 'next/headers'
import config from '@payload-config'

export async function MobileAuthButton() {
  // Get authenticated user
  const headersList = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: headersList })

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
      >
        Sign In
      </CMSLink>
      <CMSLink
        type="custom"
        url="/register"
        appearance="default"
        className={cn('w-full justify-center')}
      >
        Register
      </CMSLink>
    </div>
  )
}