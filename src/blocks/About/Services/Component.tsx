import { Card } from '@/components/ui/card'
import { RichText } from '@/components/RichText'
import { Icon } from '@/components/Icons/Icon'
import type { AboutServicesBlock } from '@/payload-types'
import { aboutSectionClassName, getSectionAnchorId, SectionHeader } from '../shared/components'

export const AboutServicesBlockComponent = (section: AboutServicesBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
    <div className="space-y-6">
      <div>
        <SectionHeader badge={section.badge} heading={section.heading} />
        {section.intro ? (
          <RichText
            data={section.intro}
            enableGutter={false}
            enableProse={false}
            paragraphClassName="text-muted-foreground leading-relaxed"
          />
        ) : null}
      </div>

      {!!section.services?.length && (
        <div className="grid gap-6 md:grid-cols-2">
          {section.services.map((service) => (
            <Card key={service.id ?? service.title} className="p-6 transition-shadow hover:shadow-lg">
              <div className="flex gap-4">
                <div className="bg-primary/10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg">
                  <Icon
                    name={(service.icon || 'FlaskConical') as never}
                    className="text-primary h-6 w-6"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  {service.description ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {service.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!!section.testPanels?.length && (
        <Card className="bg-muted/50 p-6">
          <h4 className="mb-4 text-lg font-semibold">Available Test Panels</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {section.testPanels.map((panel) => (
              <div key={panel.id ?? panel.title} className="space-y-1">
                <div className="text-primary font-semibold">{panel.title}</div>
                {panel.description ? (
                  <p className="text-muted-foreground text-sm">{panel.description}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  </section>
)
