import { Card } from '@/components/ui/card'
import { RichText } from '@/components/RichText'
import { CMSLink } from '@/components/Link'
import { cn } from '@/utilities/cn'
import type { AboutRegisterBlock } from '@/payload-types'
import { aboutSectionClassName, getSectionAnchorId, SectionHeader } from '../shared/components'

export const AboutRegisterBlockComponent = (section: AboutRegisterBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
    <div className="space-y-6">
      <SectionHeader badge={section.badge} heading={section.heading} />

      <Card className="from-primary/10 to-accent/10 border-primary/20 bg-gradient-to-br p-8">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <div className="space-y-3">
            {section.title ? (
              <h3 className="text-2xl font-semibold text-balance">{section.title}</h3>
            ) : null}
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
