import type { DocumentationLayoutBlock as DocumentationLayoutBlockType } from '@/payload-types'

import { TimelineNav } from '@/components/timeline-nav'
import { AboutContactAvailabilityBlockComponent } from '@/blocks/About/ContactAvailability/Component'
import { AboutMissionBlockComponent } from '@/blocks/About/Mission/Component'
import { AboutPricingBlockComponent } from '@/blocks/About/Pricing/Component'
import { AboutProcessBlockComponent } from '@/blocks/About/Process/Component'
import { AboutRegisterBlockComponent } from '@/blocks/About/Register/Component'
import { AboutServicesBlockComponent } from '@/blocks/About/Services/Component'
import { getSectionAnchorId } from '@/blocks/About/shared/components'

type DocumentationSection = NonNullable<DocumentationLayoutBlockType['sections']>[number]

type NavSection = {
  id: string
  title: string
}

type HeadingSection = DocumentationSection & {
  heading: string
}

const hasHeading = (section: DocumentationSection): section is HeadingSection =>
  'heading' in section && Boolean(section.heading)

const buildNavSections = (sections: DocumentationSection[] = []): NavSection[] =>
  sections
    .filter(hasHeading)
    .map((section) => ({
      id: getSectionAnchorId(section.heading, section.blockType),
      title: section.heading,
    }))

const renderSection = (section: DocumentationSection) => {
  switch (section.blockType) {
    case 'aboutMission':
      return <AboutMissionBlockComponent key={section.id ?? section.heading} {...section} />
    case 'aboutServices':
      return <AboutServicesBlockComponent key={section.id ?? section.heading} {...section} />
    case 'aboutProcess':
      return <AboutProcessBlockComponent key={section.id ?? section.heading} {...section} />
    case 'aboutPricing':
      return <AboutPricingBlockComponent key={section.id ?? section.heading} {...section} />
    case 'aboutContact':
      return <AboutContactAvailabilityBlockComponent key={section.id ?? section.heading} {...section} />
    case 'aboutRegister':
      return <AboutRegisterBlockComponent key={section.id ?? section.heading} {...section} />
    default:
      return null
  }
}

export function DocumentationLayoutBlock({
  tocTitle,
  sections,
}: DocumentationLayoutBlockType) {
  const navSections = buildNavSections(sections ?? [])

  return (
    <section className="animate-fadeIn relative px-4 py-10 sm:px-6 lg:px-12 lg:py-12 xl:px-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:gap-12">
        <aside className="hidden lg:block">
          {!!navSections.length && (
            <TimelineNav className="top-32" sections={navSections} title={tocTitle ?? undefined} />
          )}
        </aside>

        <main className="min-w-0">
          <div className="space-y-14 lg:space-y-16">{sections?.map(renderSection)}</div>
        </main>
      </div>
    </section>
  )
}
