import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'
import { DEFAULT_ABOUT_SECTIONS } from '@/blocks/About/defaultSections'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Starting migration: populate About sections')

  const pages = await payload.find({
    collection: 'pages',
    limit: 1000,
    depth: 0,
  })

  let updated = 0
  let skipped = 0

  for (const page of pages.docs) {
    const layout = page.layout as any[] | undefined
    if (!Array.isArray(layout)) {
      skipped++
      continue
    }

    let changed = false
    const nextLayout = layout.map((block) => {
      if (block?.blockType === 'about') {
        if (!block.sections || block.sections.length === 0) {
          changed = true
          return {
            ...block,
            sections: JSON.parse(JSON.stringify(DEFAULT_ABOUT_SECTIONS)),
          }
        }
      }
      return block
    })

    if (changed) {
      await payload.update({
        collection: 'pages',
        id: page.id,
        data: {
          layout: nextLayout,
        },
      })
      updated++
    } else {
      skipped++
    }
  }

  payload.logger.info(`About sections migration complete. Updated: ${updated}, Skipped: ${skipped}`)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for About sections: no-op')
}
