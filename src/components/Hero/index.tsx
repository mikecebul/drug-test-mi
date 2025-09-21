import type { Hero as HeroType } from '@/payload-types'
import { CMSLink } from '../Link'

type Props = NonNullable<HeroType['highImpact']>

export async function Hero({ title, description, links }: Props) {
  return (
    <section className="bg-gradient-to-b from-background to-muted pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-balance">
            {title}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto text-pretty">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            {links != null &&
              links.map(({ link, id }) => (
                <CMSLink
                  key={id}
                  {...link}
                  size="lg"
                  className="text-lg px-8 py-3"
                />
              ))}
          </div>
        </div>
      </div>
    </section>
  )
}