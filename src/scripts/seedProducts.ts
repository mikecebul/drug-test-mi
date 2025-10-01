import { config as dotenvConfig } from 'dotenv'
import { getPayload } from 'payload'
import config from '@payload-config'
import { seedProducts } from '../collections/Products/seed'

const seed = async () => {

  try {
    const payload = await getPayload({ config })
    console.log('Payload initialized, starting product seeding...')

    await seedProducts(payload)

    console.log('Seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('Error seeding products:', error)
    process.exit(1)
  }
}

seed()
