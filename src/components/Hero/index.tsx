import type { Hero as HeroType } from '@/payload-types'
import { CMSLink } from '../Link'
import { HeroMedium } from './HeroMedium'
import Container from '../Container'

type Props = NonNullable<HeroType['highImpact']>

export async function Hero({ title, description, links }: Props) {
  return (
    <div className="from-background to-muted bg-gradient-to-b">
      <Container className="space-y-12 pb-24 text-left xl:justify-center xl:text-center">
        <HeroMedium title={title} description={description} heading="h1" />
        <div className="flex flex-col justify-start gap-4 sm:flex-row xl:justify-center">
          {links != null &&
            links.map(({ link, id }) => (
              <CMSLink key={id} {...link} size="lg" className="px-8 py-3 text-lg" />
            ))}
        </div>
      </Container>
    </div>
  )
}
