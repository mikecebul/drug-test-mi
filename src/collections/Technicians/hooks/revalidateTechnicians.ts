import type { CollectionAfterChangeHook } from 'payload'
import { revalidatePath } from 'next/cache'
import type { Technician } from '@/payload-types'

export const revalidateTechnicians: CollectionAfterChangeHook<Technician> = ({ doc, req }) => {
  const { payload } = req

  payload.logger.info(`Revalidating technicians collection`)

  if (req.headers['X-Payload-Migration'] !== 'true') {
    revalidatePath('/(frontend)', 'layout')
  }

  return doc
}