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
import { SchedulePageBlock } from './SchedulePage/Component'
import { TrustBlock } from './Trust/Component'
import TechniciansBlockComponent from './TechniciansBlock/Component'

const blockComponents = {
  richText: RichTextBlock,
  linksBlock: LinksBlock,
  formBlock: FormBlockRouter,
  mediaBlock: MediaBlock,
  TwoColumnLayout: TwoColumnLayoutBlock,
  layout: LayoutBlock,
  calendarEmbed: CalendarEmbedBlock,
  hero: HeroBlock,
  schedulePage: SchedulePageBlock,
  trust: TrustBlock,
  techniciansBlock: TechniciansBlockComponent,
}

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

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return nested ? (
                <Block key={index} {...(block as any)} nested={nested} />
              ) : (
                <div
                  key={index}
                  className={
                    blockType === 'hero' && (block as any).type === 'highImpact'
                      ? 'space-y-16 pt-24 last:pb-36'
                      : 'space-y-16 py-24 last:pb-36'
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
