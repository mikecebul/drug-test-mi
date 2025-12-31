import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/utilities/cn'

interface BreathalyzerDisplayProps {
  result: number | null | undefined
}

export function BreathalyzerDisplay({ result }: BreathalyzerDisplayProps) {
  // Guard clause for missing data
  if (result === null || result === undefined) {
    return <span className="text-muted-foreground text-sm italic">No result recorded</span>
  }

  const isPositive = result > 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge
          variant={isPositive ? 'destructive' : 'success'}
          className={cn(
            'gap-1.5 px-2 py-0.5 text-xs font-bold tracking-wide uppercase',
            // If it's a pass, we use a custom green instead of the default primary blue
          )}
        >
          {isPositive ? (
            <>
              <XCircle className="size-3" />
              Positive (Fail)
            </>
          ) : (
            <>
              <CheckCircle2 className="size-3" />
              Negative (Pass)
            </>
          )}
        </Badge>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground text-xs font-medium tracking-tight uppercase">
          BAC Level:
        </span>
        <span
          className={cn(
            'font-mono text-lg font-bold',
            isPositive ? 'text-destructive' : 'text-foreground',
          )}
        >
          {result.toFixed(3)}
        </span>
      </div>

      {isPositive && (
        <p className="text-muted-foreground max-w-60 text-[11px] leading-snug italic">
          Note: Any detectable alcohol level constitutes a positive result for this policy.
        </p>
      )}
    </div>
  )
}
