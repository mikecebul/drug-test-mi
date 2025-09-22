import { cn } from '@/utilities/cn'

export function HeroMedium({
  title,
  description,
  subtitle,
  heading = 'h2',
}: {
  title?: string
  description?: string
  subtitle?: string
  heading?: 'h1' | 'h2'
}) {
  return (
    <div className="flex max-w-prose flex-col justify-center gap-4 text-left text-pretty xl:mx-auto xl:justify-center xl:text-center">
      <div>
        {!!subtitle && <Subtitle text={subtitle} />}
        {!!title && <Title text={title} heading={heading} />}
      </div>
      {!!description && <Description text={description} />}
    </div>
  )
}

export const Subtitle = ({ text }: { text: string }) => {
  return (
    <h3 className="text-primary max-w-prose text-base leading-7 font-semibold capitalize">
      {text}
    </h3>
  )
}
export const Title = ({
  text,
  className,
  heading = 'h2',
}: {
  text: string
  className?: string
  heading?: 'h1' | 'h2'
}) => {
  if (heading === 'h1') {
    return (
      <h1
        className={cn(
          'max-w-prose text-5xl font-bold tracking-tight text-balance md:text-7xl',
          className,
        )}
      >
        {text}
      </h1>
    )
  }
  if (heading === 'h2') {
    return (
      <h2
        className={cn(
          'max-w-prose text-4xl font-bold tracking-tight text-balance md:text-6xl',
          className,
        )}
      >
        {text}
      </h2>
    )
  }
}
export const Description = ({ text, className }: { text: string; className?: string }) => {
  return (
    <p className={cn('text-muted-foreground max-w-prose text-lg leading-7 text-pretty', className)}>
      {text}
    </p>
  )
}
