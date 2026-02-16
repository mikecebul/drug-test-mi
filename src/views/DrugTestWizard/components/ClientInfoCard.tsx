import React from 'react'
import { formatDateOnly } from '@/lib/date-utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert } from '@/components/ui/alert'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/utilities/cn'

interface Client {
  id: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  email: string
  dob?: string | null
  headshot?: string | null
}

interface ClientInfoCardProps {
  client: Client
  size?: 'sm' | 'md' | 'lg'
  variant?: 'card' | 'alert' | 'ghost'
  className?: string
}

/**
 * Reusable client information display card
 * Replaces the duplicated client info patterns across field groups
 *
 * Sizes:
 * - sm: Avatar h-12/w-12, text-base name, compact layout
 * - md: Avatar h-16/w-16, text-lg name, default layout
 * - lg: Avatar size-24, text-2xl name, spacious layout
 *
 * Variants:
 * - card: Standard card with border
 * - alert: Green alert/success style
 */
export function ClientInfoCard({
  client,
  size = 'md',
  variant = 'card',
  className,
}: ClientInfoCardProps) {
  // Defensive check - should never happen with TypeScript, but guards against runtime errors
  if (!client) {
    console.error('ClientInfoCard: client prop is required')
    return null
  }
  const avatarSizeClass = {
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'size-24',
  }[size]

  const nameSizeClass = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  }[size]

  const gapClass = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-8',
  }[size]

  const emailSizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size]

  const fullName = [
    client.firstName,
    client.middleInitial ? `${client.middleInitial}. ` : '',
    client.lastName,
  ]
    .filter(Boolean)
    .join(' ')

  const initials = `${client.firstName?.charAt(0) || ''}${client.lastName?.charAt(0) || ''}`

  const content = (
    <div className={cn('flex items-center', gapClass)}>
      <Avatar className={cn(avatarSizeClass, 'shrink-0')}>
        <AvatarImage
          src={client.headshot ?? undefined}
          alt={`${client.firstName} ${client.lastName}`}
        />
        <AvatarFallback className={size === 'lg' ? 'text-lg' : undefined}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <p className={cn('font-semibold', nameSizeClass)}>{fullName}</p>
        <div className="space-y-0.5">
          <p className={cn('text-muted-foreground', emailSizeClass)}>{client.email}</p>
          {client.dob && (
            <p className={cn('text-muted-foreground', emailSizeClass)}>
              DOB: {formatDateOnly(client.dob)}
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (variant === 'alert') {
    return (
      <Alert
        className={cn(
          'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          {content}
          <CheckCircle2 className="text-primary h-5 w-5 shrink-0" />
        </div>
      </Alert>
    )
  }

  return (
    <div
      className={cn(
        'bg-card border-border w-full rounded-xl border p-6 shadow-md',
        { 'border-none bg-none p-0 shadow-none': variant === 'ghost' },
        className,
      )}
    >
      {content}
    </div>
  )
}
