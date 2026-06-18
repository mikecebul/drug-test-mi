import { Card } from '@/components/ui/card'
import type { AboutProcessBlock } from '@/payload-types'
import { aboutSectionClassName, getSectionAnchorId, SectionHeader } from '../shared/components'

export const AboutProcessBlockComponent = (section: AboutProcessBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />

      {!!section.steps?.length && (
        <div className="space-y-4">
          {section.steps.map((step, index) => (
            <Card key={step.id ?? step.title} className="hover:border-primary/50 p-6 transition-colors">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full font-semibold">
                    {index + 1}
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  {step.description ? (
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  </section>
)
