import { TimelineNav } from '@/components/timeline-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RichText } from '@/components/RichText'
import { CMSLink } from '@/components/Link'
import { Icon } from '@/components/Icons/Icon'
import { cn } from '@/utilities/cn'
import type {
  About as AboutType,
  AboutMissionBlock,
  AboutServicesBlock,
  AboutProcessBlock,
  AboutPricingBlock,
  AboutRegisterBlock,
  AboutContactBlock,
} from '@/payload-types'

const renderTextWithBreaks = (text?: string | null) => {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, index) => (
    <span key={`${line}-${index}`}>
      {line}
      {index < lines.length - 1 ? <br /> : null}
    </span>
  ))
}

type SectionHeaderProps = {
  badge?: string | null
  heading?: string | null
}

const SectionHeader = ({ badge, heading }: SectionHeaderProps) => (
  <div>
    {badge ? (
      <Badge variant="secondary" className="mb-3">
        {badge}
      </Badge>
    ) : null}
    {heading ? <h2 className="mb-4 text-3xl font-semibold text-balance">{heading}</h2> : null}
  </div>
)

type AboutSection = NonNullable<AboutType['sections']>[number]

type SectionNavItem = {
  id: string
  title: string
}

const buildNavSections = (sections: AboutSection[]): SectionNavItem[] => {
  return sections
    .filter((section) => Boolean(section?.anchorId && section?.navLabel))
    .map((section) => ({
      id: section.anchorId as string,
      title: section.navLabel as string,
    }))
}

const MissionSection = (section: AboutMissionBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />
      <Card className="border-l-primary border-l-4 p-6">
        {section.intro ? (
          <RichText
            data={section.intro}
            enableGutter={false}
            enableProse={false}
            paragraphClassName="text-foreground text-lg leading-relaxed"
          />
        ) : null}
      </Card>
    </div>
  </section>
)

const ServicesSection = (section: AboutServicesBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
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

const ProcessSection = (section: AboutProcessBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
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

const PricingSection = (section: AboutPricingBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
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
                      className={cn('text-4xl font-bold', card.featured ? 'text-primary' : 'text-foreground')}
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

const RegisterSection = (section: AboutRegisterBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />

      <Card className="from-primary/10 to-accent/10 border-primary/20 bg-gradient-to-br p-8">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <div className="space-y-3">
            {section.title ? <h3 className="text-2xl font-semibold text-balance">{section.title}</h3> : null}
            {section.body ? (
              <RichText
                data={section.body}
                enableGutter={false}
                enableProse={false}
                paragraphClassName="text-muted-foreground text-lg leading-relaxed"
              />
            ) : null}
          </div>

          {!!section.links?.length && (
            <div className="flex flex-col justify-center gap-4 pt-4 sm:flex-row">
              {section.links.map(({ link, id }) =>
                link ? (
                  <CMSLink
                    key={id}
                    {...link}
                    size="lg"
                    className={cn('text-base', link?.appearance === 'outline' ? 'bg-transparent' : '')}
                  />
                ) : null,
              )}
            </div>
          )}

          {section.footerText ? (
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-center italic">{section.footerText}</p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  </section>
)

const ContactSection = (section: AboutContactBlock) => (
  <section id={section.anchorId ?? undefined} className="scroll-mt-8 lg:scroll-mt-32">
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />

      <Card className="from-primary/5 to-accent/5 bg-gradient-to-br p-8">
        <div className="space-y-6">
          {section.intro ? (
            <RichText
              data={section.intro}
              enableGutter={false}
              enableProse={false}
              paragraphClassName="text-lg leading-relaxed"
            />
          ) : null}

          {section.availability ? (
            <Card className="border-border/60 bg-background/80 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                  <Icon name={'Clock' as never} className="text-primary h-5 w-5" />
                </div>
                <div className="space-y-2 sm:flex-1">
                  {section.availability.title ? (
                    <h3 className="text-lg font-semibold">{section.availability.title}</h3>
                  ) : null}
                  {!!section.availability.times?.length && (
                    <div className="text-muted-foreground space-y-1 text-sm">
                      {section.availability.times.map((time, index) => (
                        <p key={time.id ?? `${time.text}-${index}`}>{time.text}</p>
                      ))}
                    </div>
                  )}
                  {!!section.availability.notes?.length && (
                    <div className="border-border/60 mt-3 space-y-1 border-t pt-3 text-sm">
                      {section.availability.notes.map((note, index) => (
                        <p key={note.id ?? `${note.text}-${index}`} className="text-muted-foreground">
                          {note.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {!!section.contactItems?.length && (
            <div className="grid gap-6 pt-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.contactItems.map((item) => {
                const iconName = (item.icon || 'Phone') as never
                const content = (
                  <>
                    <div className="bg-primary/10 group-hover:bg-primary/20 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors">
                      <Icon name={iconName} className="text-primary h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="group-hover:text-primary mb-1 font-semibold transition-colors">
                        {item.title}
                      </h4>
                      {item.description ? (
                        <p className="text-muted-foreground text-sm">
                          {renderTextWithBreaks(item.description)}
                        </p>
                      ) : null}
                    </div>
                  </>
                )

                return item.href ? (
                  <a
                    key={item.id ?? item.title}
                    href={item.href}
                    className="group border-border hover:border-primary/50 -ml-3 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                  >
                    {content}
                  </a>
                ) : (
                  <div key={item.id ?? item.title} className="flex items-start gap-3">
                    {content}
                  </div>
                )
              })}
            </div>
          )}

          {section.footerText ? (
            <div className="border-border/50 border-t pt-6">
              <p className="text-muted-foreground text-sm">{section.footerText}</p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  </section>
)

export function AboutBlock({ enabled, sections }: AboutType) {
  if (enabled === false) return null

  const sectionList = sections ?? []
  if (!sectionList.length) return null

  const navSections = buildNavSections(sectionList)

  const renderSection = (section: AboutSection) => {
    switch (section.blockType) {
      case 'aboutMission':
        return <MissionSection key={section.id ?? section.anchorId} {...section} />
      case 'aboutServices':
        return <ServicesSection key={section.id ?? section.anchorId} {...section} />
      case 'aboutProcess':
        return <ProcessSection key={section.id ?? section.anchorId} {...section} />
      case 'aboutPricing':
        return <PricingSection key={section.id ?? section.anchorId} {...section} />
      case 'aboutContact':
        return <ContactSection key={section.id ?? section.anchorId} {...section} />
      case 'aboutRegister':
        return <RegisterSection key={section.id ?? section.anchorId} {...section} />
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          {!!navSections.length && <TimelineNav sections={navSections} />}
        </aside>

        <main className="space-y-16">{sectionList.map(renderSection)}</main>
      </div>
    </div>
  )
}
