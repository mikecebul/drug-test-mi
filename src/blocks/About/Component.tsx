import { TimelineNav } from '@/components/timeline-nav'
import type { About as AboutType } from '@/payload-types'
import { AboutContactAvailabilityBlockComponent } from './ContactAvailability/Component'
import { AboutMissionBlockComponent } from './Mission/Component'
import { AboutPricingBlockComponent } from './Pricing/Component'
import { AboutProcessBlockComponent } from './Process/Component'
import { AboutRegisterBlockComponent } from './Register/Component'
import { AboutServicesBlockComponent } from './Services/Component'
import { getSectionAnchorId } from './shared/components'

type AboutSection = NonNullable<AboutType['sections']>[number]

type SectionNavItem = {
  id: string
  title: string
}

const buildNavSections = (sections: AboutSection[]): SectionNavItem[] => {
  return sections
    .filter((section) => Boolean(section?.heading))
    .map((section) => ({
      id: getSectionAnchorId(section.heading, section.blockType),
      title: section.heading as string,
    }))
}

const renderSection = (section: AboutSection) => {
  switch (section.blockType) {
    case 'aboutMission':
      return (
        <AboutMissionBlockComponent key={section.id ?? section.heading} {...section} />
      )
    case 'aboutServices':
      return (
        <AboutServicesBlockComponent key={section.id ?? section.heading} {...section} />
      )
    case 'aboutProcess':
      return (
        <AboutProcessBlockComponent key={section.id ?? section.heading} {...section} />
      )
    case 'aboutPricing':
      return (
        <AboutPricingBlockComponent key={section.id ?? section.heading} {...section} />
      )
    case 'aboutContact':
      return (
        <AboutContactAvailabilityBlockComponent
          key={section.id ?? section.heading}
          {...section}
        />
      )
    case 'aboutRegister':
      return (
        <AboutRegisterBlockComponent key={section.id ?? section.heading} {...section} />
      )
    default:
      return null
  }
}

export function AboutBlock({ enabled, sections }: AboutType) {
  if (enabled === false) return null

  const sectionList = sections ?? []
  if (!sectionList.length) return null

  const navSections = buildNavSections(sectionList)

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-12 xl:px-16">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          {!!navSections.length && <TimelineNav sections={navSections} />}
        </aside>

        <main className="space-y-16">{sectionList.map(renderSection)}</main>
      </div>
    </div>
  )
}
