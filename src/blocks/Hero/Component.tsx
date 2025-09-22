import type { Hero as HeroType, Page } from '@/payload-types'
import { HeroMedium } from '@/components/Hero/HeroMedium'
import { Hero } from '@/components/Hero'

type Props = Extract<Page['layout'][number], HeroType>

export async function HeroBlock({ type, highImpact, mediumImpact }: Props) {
  return (
    <>
      {type === 'highImpact' && !!highImpact ? (
        <Hero {...highImpact} />
      ) : type === 'mediumImpact' && !!mediumImpact ? (
        <HeroMedium
          {...mediumImpact}
          description={mediumImpact.description ?? undefined}
          subtitle={mediumImpact.subtitle ?? undefined}
          heading={mediumImpact.heading ?? undefined}
        />
      ) : null}
    </>
  )
}