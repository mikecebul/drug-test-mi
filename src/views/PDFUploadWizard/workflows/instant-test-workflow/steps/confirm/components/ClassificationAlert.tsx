import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/utilities/cn'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const CLASSIFICATION_MAP = {
  negative: {
    variant: 'success' as const,
    icon: CheckCircle2,
    title: 'All Negative (Pass)',
    description:
      'No substances detected and no medications expected. This result will be automatically accepted.',
  },
  'expected-positive': {
    variant: 'success' as const,
    icon: CheckCircle2,
    title: 'Expected Positive (Pass)',
    description: "All detected substances match client's prescribed medications.",
  },
  'unexpected-positive': {
    variant: 'destructive' as const,
    icon: XCircle,
    title: 'Unexpected Positive (Fail)',
    description: "Detected substances that are NOT in client's prescribed medications.",
  },
  'unexpected-negative-critical': {
    variant: 'destructive' as const,
    icon: XCircle,
    title: 'Unexpected Negative - Critical (Fail)',
    description: 'Critical medications were expected but not found in the sample.',
  },
  'unexpected-negative-warning': {
    variant: 'warning' as const,
    icon: AlertTriangle,
    title: 'Unexpected Negative - Warning (Pass with Note)',
    description: 'Some expected medications were missing, but do not trigger a critical failure.',
  },
  'mixed-unexpected': {
    variant: 'destructive' as const,
    icon: XCircle,
    title: 'Mixed Unexpected Results (Fail)',
    description: 'This sample contains both missing expected substances and unexpected detections.',
  },
} as const

export function ClassificationAlert({ preview }: { preview: any }) {
  // Guard clause for missing preview data
  if (!preview || !preview.initialScreenResult) {
    return (
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Loading Classification</AlertTitle>
        <AlertDescription>
          <p>Computing test result classification...</p>
        </AlertDescription>
      </Alert>
    )
  }

  const config = CLASSIFICATION_MAP[preview.initialScreenResult]
  if (!config)
    return (
      <Alert variant="destructive">
        <XCircle />
        <AlertTitle>Unknown Classification</AlertTitle>
        <AlertDescription>
          <p>The classification result is not recognized.</p>
        </AlertDescription>
      </Alert>
    )

  const Icon = config.icon

  return (
    <Alert variant={config.variant}>
      <Icon />
      <AlertTitle>{config.title}</AlertTitle>
      <AlertDescription>
        <p>{config.description}</p>

        <div className="mt-3 space-y-3">
          {/* Expected Substances */}
          <SubstanceList
            label="Expected substances:"
            items={preview.expectedPositives}
            variant="success"
          />

          {/* Unexpected Substances */}
          <SubstanceList
            label="Unexpected substances:"
            items={preview.unexpectedPositives}
            variant="destructive"
          />

          {/* Missing Expected */}
          <SubstanceList
            label="Missing expected:"
            items={preview.unexpectedNegatives}
            variant="warning"
          />
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Helper component for the Badge groups
 */
function SubstanceList({
  label,
  items,
  variant,
  className,
}: {
  label: string
  items: string[]
  variant: 'success' | 'warning' | 'destructive' | 'default'
  className?: string
}) {
  if (!items || items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item}
          variant={variant}
          className={cn('text-[10px] tracking-wider uppercase', className)}
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}
