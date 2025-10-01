import type { PayloadHandler } from 'payload'
import { seedProducts } from './seed-products'

export const seed: PayloadHandler = async (req) => {
  const { payload } = req

  payload.logger.info('Seeding database...')

  payload.logger.info(`— Seeding products...`)
  await seedProducts(payload)

  payload.logger.info('Seeded database successfully!')

  return Response.json({ success: true, message: 'Database seeded successfully!' })
}
