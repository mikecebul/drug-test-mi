import { Card } from '@/components/ui/card'
import { RichText } from '@/components/RichText'
import type { AboutMissionBlock } from '@/payload-types'
import { aboutSectionClassName, getSectionAnchorId, SectionHeader } from '../shared/components'

export const AboutMissionBlockComponent = (section: AboutMissionBlock) => (
  <section id={getSectionAnchorId(section.heading, section.blockType)} className={aboutSectionClassName}>
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
