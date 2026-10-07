'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { materializeBrowserFile } from '../utils/materializeBrowserFile'

export function ReportLink({
  file,
  filename = false,
  compact = false,
}: {
  file: File | null
  filename?: boolean
  compact?: boolean
}) {
  const [report, setReport] = useState<{ file: File; href: string } | null>(null)
  const href = report?.file === file ? report?.href : null
  useEffect(() => {
    let active = true
    let url: string | null = null
    if (file)
      void materializeBrowserFile(file)
        .then((report) => {
          if (!active) return
          url = URL.createObjectURL(report)
          setReport({ file, href: url })
        })
        .catch(() => {
          /* Upload validation reports an unreadable file. */
        })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [file])
  const reviewButton = (
    <Button
      type="button"
      variant="link"
      size={compact ? 'sm' : 'default'}
      className={compact ? 'h-auto min-h-8 px-0' : undefined}
      render={href ? <a href={href} target="_blank" rel="noopener noreferrer" /> : undefined}
      nativeButton={!href}
      disabled={!href}
    >
      Review PDF
      <ExternalLink data-icon="inline-end" />
    </Button>
  )
  return filename ? (
    <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-3">
      <span className="text-muted-foreground min-w-0 text-sm break-all">{file?.name || 'Report PDF'}</span>
      {reviewButton}
    </div>
  ) : (
    reviewButton
  )
}
