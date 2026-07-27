import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'
import { formatGuidedGender, getGuidedGenderBadgeClass } from '../schedule-utils'

type ScheduleInfoBadgesProps = {
  gender?: string | null
  isCompleted?: boolean
  needsRegistration?: boolean
  needsTestType?: boolean
  paymentLabel: string
}

const badgeClassName = 'w-[5.5rem] min-w-0 justify-center'

export function ScheduleInfoBadges({
  gender,
  isCompleted = false,
  needsRegistration = false,
  needsTestType = false,
  paymentLabel,
}: ScheduleInfoBadgesProps) {
  const statusLabel = isCompleted ? 'Completed' : paymentLabel

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={cn(badgeClassName, getGuidedGenderBadgeClass(gender), isCompleted && 'opacity-70')}
        title={formatGuidedGender(gender)}
      >
        <span className="truncate">{formatGuidedGender(gender)}</span>
      </Badge>
      <Badge
        variant={
          isCompleted
            ? 'secondary'
            : paymentLabel === 'Paid' || paymentLabel === 'Pre-paid' || paymentLabel === 'Collected'
              ? 'success'
              : paymentLabel === 'Unpaid' || paymentLabel === 'Still owes'
                ? 'outline'
                : 'default'
        }
        className={cn(badgeClassName, paymentLabel === 'Still owes' && 'border-destructive text-destructive')}
        title={statusLabel}
      >
        <span className="truncate">{statusLabel}</span>
      </Badge>
      {!isCompleted && needsRegistration && (
        <Badge variant="secondary" className={badgeClassName}>
          Register
        </Badge>
      )}
      {!isCompleted && needsTestType && (
        <Badge variant="secondary" className={badgeClassName}>
          Set test
        </Badge>
      )}
    </span>
  )
}
