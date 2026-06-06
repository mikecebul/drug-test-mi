import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { LinksBlock } from './Links/Component'
import { RichTextBlock } from './RichText/Component'
import { FormBlockRouter } from './Form/Component'
import { MediaBlock } from './MediaBlock/Component'
import { LayoutBlock } from './Layout/Component'
import { TwoColumnLayoutBlock } from './TwoColumnLayout/Component'
import { CalendarEmbedBlock } from './Cal/Component'
import { HeroBlock } from './Hero/Component'
import { HomepageHeroBlock } from './Hero/HomepageHero/Component'
import { SchedulePageBlock } from './SchedulePage/Component'
import { TrustBlock } from './Trust/Component'
import TechniciansBlockComponent from './TechniciansBlock/Component'
import { AboutBlock } from './About/Component'
import { CTABlock } from './CTA/Component'
import { AboutContactAvailabilityBlockComponent } from './About/ContactAvailability/Component'
import { AboutMissionBlockComponent } from './About/Mission/Component'
import { AboutPricingBlockComponent } from './About/Pricing/Component'
import { AboutProcessBlockComponent } from './About/Process/Component'
import { AboutServicesBlockComponent } from './About/Services/Component'
import { AboutBlocksGroup } from './About/AboutBlocksGroup'
import { DocumentationLayoutBlock } from './DocumentationLayout/Component'

const blockComponents = {
  richText: RichTextBlock,
  linksBlock: LinksBlock,
  formBlock: FormBlockRouter,
  mediaBlock: MediaBlock,
  TwoColumnLayout: TwoColumnLayoutBlock,
  layout: LayoutBlock,
  calendarEmbed: CalendarEmbedBlock,
  homepageHero: HomepageHeroBlock,
  hero: HeroBlock,
  schedulePage: SchedulePageBlock,
  trust: TrustBlock,
  techniciansBlock: TechniciansBlockComponent,
  about: AboutBlock,
  cta: CTABlock,
  aboutMission: AboutMissionBlockComponent,
  aboutServices: AboutServicesBlockComponent,
  aboutProcess: AboutProcessBlockComponent,
  aboutPricing: AboutPricingBlockComponent,
  aboutContact: AboutContactAvailabilityBlockComponent,
  documentationLayout: DocumentationLayoutBlock,
}

const aboutBlockTypes = new Set(['aboutMission', 'aboutServices', 'aboutProcess', 'aboutPricing', 'aboutContact'])

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][number][]
  nested?: boolean
}> = (props) => {
  const { blocks, nested = false } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (aboutBlockTypes.has(blockType)) {
            const previousBlock = blocks[index - 1]
            if (previousBlock && aboutBlockTypes.has(previousBlock.blockType)) {
              return null
            }

            const aboutBlocks = blocks.slice(index).filter((candidate, candidateIndex) => {
              if (!aboutBlockTypes.has(candidate.blockType)) return false

              const absoluteIndex = index + candidateIndex
              const betweenBlocks = blocks.slice(index, absoluteIndex)
              return betweenBlocks.every((betweenBlock) => aboutBlockTypes.has(betweenBlock.blockType))
            })

            return (
              <div key={index} className="space-y-12 py-10 last:pb-28">
                <AboutBlocksGroup blocks={aboutBlocks as any} />
              </div>
            )
          }

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return nested ? (
                <Block key={index} {...(block as any)} nested={nested} />
              ) : (
                <div
                  key={index}
                  className={
                    blockType === 'homepageHero' ||
                    (blockType === 'hero' && (block as any).type === 'locationSplit')
                      ? 'space-y-12 last:pb-28'
                      : blockType === 'hero' && (block as any).type === 'highImpact'
                      ? 'space-y-12 pt-20 last:pb-28'
                        : blockType === 'about'
                          ? 'space-y-12 pt-8 last:pb-28'
                          : blockType === 'documentationLayout'
                            ? 'space-y-12 last:pb-28'
                        : blockType.startsWith('about')
                          ? 'mx-auto max-w-7xl space-y-12 px-4 py-10 last:pb-28 sm:px-6 lg:px-12 xl:px-16'
                        : 'space-y-12 py-16 last:pb-28'
                  }
                >
                  <Block {...(block as any)} nested={nested} />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
