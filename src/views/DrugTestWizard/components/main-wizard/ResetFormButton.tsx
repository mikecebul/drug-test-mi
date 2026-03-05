'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/utilities/cn'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

export const ResetFormButton = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const targetPath = '/admin/drug-test-upload'

  const isOnTargetPath = pathname === targetPath
  const hasNoQueryParams = searchParams.toString() === ''
  const isDisabled = isOnTargetPath && hasNoQueryParams

  if (isDisabled) {
    return null
  }

  return (
    <Link
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'absolute top-0 right-0')}
      href={targetPath}
      title="Reset Wizard"
    >
      <RotateCcw className="size-6" />
    </Link>
  )
}
