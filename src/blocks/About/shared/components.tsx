import { Badge } from '@/components/ui/badge'

export type SectionHeaderProps = {
  badge?: string | null
  heading?: string | null
}

export const SectionHeader = ({ badge, heading }: SectionHeaderProps) => (
  <div>
    {badge ? (
      <Badge variant="secondary" className="mb-3">
        {badge}
      </Badge>
    ) : null}
    {heading ? <h2 className="mb-4 text-3xl font-semibold text-balance">{heading}</h2> : null}
  </div>
)

export const renderTextWithBreaks = (text?: string | null) => {
  if (!text) return null

  const lines = text.split('\n')

  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ))
}

export const getSectionAnchorId = (heading?: string | null, fallback = 'section') => {
  const anchor = heading
    ?.toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return anchor || fallback
}

export const aboutSectionClassName = 'scroll-mt-8 lg:scroll-mt-32'
