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
        className={cn(getGuidedGenderBadgeClass(gender), isCompleted && 'opacity-70')}
        title={formatGuidedGender(gender)}
      >
        {formatGuidedGender(gender)}
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
        className={cn(paymentLabel === 'Still owes' && 'border-destructive text-destructive')}
        title={statusLabel}
      >
        {statusLabel}
      </Badge>
      {!isCompleted && needsRegistration && <Badge variant="secondary">Register</Badge>}
      {!isCompleted && needsTestType && <Badge variant="secondary">Set test</Badge>}
    </span>
  )
}
