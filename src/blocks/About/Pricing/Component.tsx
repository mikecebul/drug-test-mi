import { Card } from '@/components/ui/card'
import { cn } from '@/utilities/cn'
import type { AboutPricingBlock } from '@/payload-types'
import { aboutSectionClassName, getSectionAnchorId, SectionHeader } from '../shared/components'

export const AboutPricingBlockComponent = (section: AboutPricingBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />

      <div className="grid gap-4 md:grid-cols-2">
        {section.pricingCards?.map((card) => (
          <Card
            key={card.id ?? card.title}
            className={cn('p-6', card.featured ? 'border-primary border-2' : '')}
          >
            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-lg font-semibold">{card.title}</h3>
                {card.price ? (
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'text-4xl font-bold',
                        card.featured ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {card.price}
                    </span>
                  </div>
                ) : null}
              </div>
              {card.description ? (
                <p className="text-muted-foreground text-sm">{card.description}</p>
              ) : null}
            </div>
          </Card>
        ))}

        {section.confirmation ? (
          <Card className="bg-muted/50 p-6">
            <div className="space-y-3">
              {section.confirmation.title ? (
                <h3 className="text-lg font-semibold">{section.confirmation.title}</h3>
              ) : null}
              {!!section.confirmation.rows?.length && (
                <div className="space-y-2 text-sm">
                  {section.confirmation.rows.map((row, index) => (
                    <div key={row.id ?? `${row.label}-${index}`} className="flex justify-between">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  </section>
)
