'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/utilities/cn'

type IdentityRow = {
  label: string
  clientValue?: string | null
  sourceValue?: string | null
  different?: boolean
}

function IdentityValue({ value, comparison, different }: { value: string; comparison: string; different: boolean }) {
  const comparisonParts = comparison.split(/(\s+|\/)/)
  const normalize = (part: string) => part.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return value.split(/(\s+|\/)/).map((part, index) =>
    different && normalize(part) && normalize(part) !== normalize(comparisonParts[index] ?? '') ? (
      <mark key={index} className="bg-warning-border/40 text-warning-foreground rounded px-0.5 font-semibold">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

/** Compact identity comparison; acknowledgements remain owned by the active workflow. */
export function IdentityNotice({
  title,
  description,
  sourceLabel,
  clientLabel = 'Client profile',
  sourceName,
  clientName,
  rows,
  variant = 'warning',
  children,
}: {
  title: string
  description?: string
  sourceLabel?: string
  clientLabel?: string
  sourceName?: string | null
  clientName?: string | null
  rows?: IdentityRow[]
  variant?: 'success' | 'warning' | 'destructive'
  children?: ReactNode
}) {
  const Icon = variant === 'success' ? CheckCircle2 : AlertTriangle
  const comparisonRows = rows ?? [{ label: 'Name', sourceValue: sourceName, clientValue: clientName, different: true }]
  return (
    <div
      data-testid="identity-notice"
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-md border p-3 sm:p-4',
        variant === 'success'
          ? 'border-success-border bg-success-muted text-success-foreground'
          : variant === 'destructive'
            ? 'border-destructive/40 bg-destructive/5 text-destructive'
            : 'border-warning-border bg-warning-muted text-warning-foreground',
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-1 text-sm">{description}</p>}
        </div>
      </div>
      {sourceLabel && (
        <table className="text-foreground w-full table-fixed text-sm" aria-label="Client identification comparison">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th scope="col" className="w-1/2 pr-4 pb-2 font-medium">
                {clientLabel}
              </th>
              <th scope="col" className="w-1/2 pb-2 pl-4 font-medium">
                {sourceLabel}
              </th>
            </tr>
          </thead>
          {comparisonRows.map((row) => (
            <tbody key={row.label} aria-label={row.label}>
              {comparisonRows.length > 1 && (
                <tr>
                  <th colSpan={2} scope="rowgroup" className="text-muted-foreground pt-2 text-left text-xs font-medium">
                    {row.label}
                  </th>
                </tr>
              )}
              <tr className="align-top">
                <td className="py-1 pr-4 font-medium wrap-anywhere">{row.clientValue || 'Not found'}</td>
                <td className="border-l border-current/10 py-1 pl-4 font-medium wrap-anywhere">
                  <IdentityValue
                    value={row.sourceValue || 'Not found'}
                    comparison={row.clientValue || ''}
                    different={Boolean(row.different)}
                  />
                </td>
              </tr>
            </tbody>
          ))}
        </table>
      )}
      {children && <div className="text-foreground border-t border-current/10 pt-3">{children}</div>}
    </div>
  )
}
