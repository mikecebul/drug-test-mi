import Container from '@/components/Container'
import { CMSLink } from '@/components/Link'
import type { CTABlock as CTABlockType } from '@/payload-types'

export function CTABlock({ title, description, links }: CTABlockType) {
  return (
    <Container>
      <div className="border-border bg-card mx-auto flex max-w-5xl flex-col items-start gap-6 rounded-lg border p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:p-10">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-foreground text-3xl font-bold tracking-normal text-balance md:text-4xl">
            {title}
          </h2>
          {!!description && (
            <p className="text-muted-foreground text-base leading-7 text-pretty md:text-lg">
              {description}
            </p>
          )}
        </div>

        {!!links?.length && (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
            {links.map(({ id, link }) => (
              <CMSLink
                key={id}
                {...link}
                size="lg"
                className="w-full justify-center rounded-lg sm:w-auto"
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}
