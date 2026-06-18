import type { Hero as HeroType, HomepageHero, Link, Page } from '@/payload-types'
import { HeroMedium } from '@/components/Hero/HeroMedium'
import { Hero } from '@/components/Hero'
import { HomepageHeroBlock } from './HomepageHero/Component'
import Container from '@/components/Container'

type Props = Extract<Page['layout'][number], HeroType>
type LegacyLocationSplitHero = Omit<Props, 'type'> & {
  type: 'locationSplit'
  locationSplit?: {
    headingPrefix?: string
    headingHighlight?: string
    description?: string
    links?: Array<{ link?: HomepageHero['primaryCta'] }>
    mapImage?: HomepageHero['mapImage']
    directionsUrl?: string
  }
}

const fallbackPrimaryCta: Link = {
  type: 'custom',
  url: '/register',
  label: 'Register',
  appearance: 'default',
  newTab: false,
}

const fallbackSecondaryCta: Link = {
  type: 'custom',
  url: 'tel:2313736341',
  label: 'Call',
  appearance: 'outline',
  newTab: false,
}

export async function HeroBlock(props: Props) {
  const { highImpact, mediumImpact } = props
  const legacyProps = props as Props | LegacyLocationSplitHero
  const { type } = legacyProps
  const legacyLocationSplit =
    type === 'locationSplit' ? legacyProps.locationSplit : undefined

  return (
    <>
      {type === 'highImpact' && !!highImpact ? (
        <Hero {...highImpact} />
      ) : type === 'mediumImpact' && !!mediumImpact ? (
        <Container>
          <HeroMedium
            {...mediumImpact}
            description={mediumImpact.description ?? undefined}
            subtitle={mediumImpact.subtitle ?? undefined}
            heading={mediumImpact.heading ?? undefined}
          />
        </Container>
      ) : type === 'locationSplit' && !!legacyLocationSplit ? (
        <HomepageHeroBlock
          blockType="homepageHero"
          title={[legacyLocationSplit.headingPrefix, legacyLocationSplit.headingHighlight]
            .filter(Boolean)
            .join(' ')}
          description={legacyLocationSplit.description || ''}
          primaryCta={legacyLocationSplit.links?.[0]?.link || fallbackPrimaryCta}
          secondaryCta={legacyLocationSplit.links?.[1]?.link || fallbackSecondaryCta}
          mapImage={legacyLocationSplit.mapImage}
          directionsUrl={
            legacyLocationSplit.directionsUrl ||
            'https://maps.google.com/?q=MI+Drug+Test+Charlevoix+MI'
          }
        />
      ) : null}
    </>
  )
}
