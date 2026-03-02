import { Page } from '@/payload-types'
import { revalidatePath, revalidateTag } from 'next/cache.js'
import { CollectionAfterDeleteHook } from 'payload'

export const revalidateDelete: CollectionAfterDeleteHook<Page> = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    const path = doc?.slug === 'home' ? '/' : `/${doc?.slug}`
    revalidatePath(path)
    revalidateTag('sitemap', 'max')
  }

  return doc
}
