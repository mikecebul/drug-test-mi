import { TimelineNav } from '@/components/timeline-nav'
import type { Page } from '@/payload-types'
import { AboutContactAvailabilityBlockComponent } from './ContactAvailability/Component'
import { AboutMissionBlockComponent } from './Mission/Component'
import { AboutPricingBlockComponent } from './Pricing/Component'
import { AboutProcessBlockComponent } from './Process/Component'
import { AboutServicesBlockComponent } from './Services/Component'
import { getSectionAnchorId } from './shared/components'

type AboutPageBlock = Extract<
  Page['layout'][number],
  { blockType: 'aboutMission' | 'aboutServices' | 'aboutProcess' | 'aboutPricing' | 'aboutContact' }
>

type SectionNavItem = {
  id: string
  title: string
}

const buildNavSections = (sections: AboutPageBlock[]): SectionNavItem[] => {
  return sections
    .filter((section) => Boolean(section?.heading))
    .map((section) => ({
      id: getSectionAnchorId(section.heading, section.blockType),
      title: section.heading as string,
    }))
}

const renderAboutBlock = (block: AboutPageBlock) => {
  switch (block.blockType) {
    case 'aboutMission':
      return <AboutMissionBlockComponent key={block.id ?? block.heading} {...block} />
    case 'aboutServices':
      return <AboutServicesBlockComponent key={block.id ?? block.heading} {...block} />
    case 'aboutProcess':
      return <AboutProcessBlockComponent key={block.id ?? block.heading} {...block} />
    case 'aboutPricing':
      return <AboutPricingBlockComponent key={block.id ?? block.heading} {...block} />
    case 'aboutContact':
      return (
        <AboutContactAvailabilityBlockComponent key={block.id ?? block.heading} {...block} />
      )
  }
}

export function AboutBlocksGroup({ blocks }: { blocks: AboutPageBlock[] }) {
  const navSections = buildNavSections(blocks)

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[220px_1fr] xl:gap-12">
        <aside className="hidden lg:block">
          {!!navSections.length && <TimelineNav sections={navSections} />}
        </aside>

        <main className="space-y-16">{blocks.map(renderAboutBlock)}</main>
      </div>
    </div>
  )
}
