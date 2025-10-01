import type { Payload } from 'payload'

/**
 * Seeds initial products for MI Drug Test
 * - 15-Panel Instant Test ($35)
 * - 11-Panel Lab Test ($40)
 * - Instant Test Confirmation ($30)
 * - Lab Test Confirmation ($45)
 */
export const seedProducts = async (payload: Payload) => {
  console.log('Seeding products...')

  const products = [
    {
      title: '15-Panel Instant Drug Test',
      slug: '15-panel-instant-test',
      testType: 'instant' as const,
      panelType: '15-panel' as const,
      priceInUSD: 3500, // Price in cents
      shortDescription:
        'Comprehensive 15-panel instant drug screening with immediate results. Perfect for employment, probation, or personal testing needs.',
      features: [
        { feature: 'Tests for 15 different substances' },
        { feature: 'Results available immediately' },
        { feature: 'CLIA-waived test' },
        { feature: 'Professional observation included' },
        { feature: 'Legally admissible results' },
      ],
      inventory: {
        enabled: false, // Not tracking inventory for services
      },
      _status: 'published' as const,
    },
    {
      title: '11-Panel Lab Drug Test',
      slug: '11-panel-lab-test',
      testType: 'lab' as const,
      panelType: '11-panel' as const,
      priceInUSD: 4000, // Price in cents
      shortDescription:
        'Reliable 11-panel laboratory drug test with certified lab analysis. Ideal for legal proceedings and official documentation.',
      features: [
        { feature: 'Tests for 11 different substances' },
        { feature: 'Lab-certified results' },
        { feature: 'Results in 24-48 hours' },
        { feature: 'Professional observation included' },
        { feature: 'Legally admissible results' },
        { feature: 'Chain of custody maintained' },
      ],
      inventory: {
        enabled: false,
      },
      _status: 'published' as const,
    },
    {
      title: 'Instant Test Confirmation',
      slug: 'instant-confirmation',
      testType: 'instant-confirmation' as const,
      priceInUSD: 3000, // Price in cents
      shortDescription:
        'Laboratory confirmation service for non-negative instant test results. Provides definitive analysis of presumptive positive results.',
      features: [
        { feature: 'Confirms instant test results' },
        { feature: 'GC-MS laboratory analysis' },
        { feature: 'Results in 3-5 business days' },
        { feature: 'Required for legal confirmation' },
        { feature: 'Eliminates false positives' },
      ],
      inventory: {
        enabled: false,
      },
      _status: 'published' as const,
    },
    {
      title: 'Lab Test Confirmation',
      slug: 'lab-confirmation',
      testType: 'lab-confirmation' as const,
      priceInUSD: 4500, // Price in cents
      shortDescription:
        'Advanced laboratory confirmation for lab test results. Provides additional verification and quantitative analysis.',
      features: [
        { feature: 'Confirms lab test results' },
        { feature: 'Advanced GC-MS/MS analysis' },
        { feature: 'Quantitative results' },
        { feature: 'Results in 3-5 business days' },
        { feature: 'Highest level of accuracy' },
      ],
      inventory: {
        enabled: false,
      },
      _status: 'published' as const,
    },
  ]

  for (const product of products) {
    try {
      // Check if product already exists
      const existing = await payload.find({
        collection: 'products',
        where: {
          slug: {
            equals: product.slug,
          },
        },
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'products',
          data: product,
        })
        console.log(`✓ Created product: ${product.title}`)
      } else {
        console.log(`→ Product already exists: ${product.title}`)
      }
    } catch (error) {
      console.error(`✗ Error creating product ${product.title}:`, error)
    }
  }

  console.log('Products seeding complete!')
}
