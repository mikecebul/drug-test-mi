import { Card } from '@/components/ui/card'
import { RichText } from '@/components/RichText'
import { Icon } from '@/components/Icons/Icon'
import type { AboutContactBlock } from '@/payload-types'
import {
  aboutSectionClassName,
  getSectionAnchorId,
  renderTextWithBreaks,
  SectionHeader,
} from '../shared/components'

export const AboutContactAvailabilityBlockComponent = (section: AboutContactBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
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
