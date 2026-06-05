import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'
import type { Technician } from '@/payload-types'

type Props = {
  gender: Technician['gender']
  className?: string
}

export function TechnicianGenderBadge({ gender, className }: Props) {
  const colorClass =
    gender === 'male'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-pink-200 bg-pink-50 text-pink-700'

  return (
    <Badge variant="outline" className={cn('capitalize', colorClass, className)}>
      {gender}
    </Badge>
  )
}
