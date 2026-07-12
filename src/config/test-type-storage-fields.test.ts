import type { CollectionConfig, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { Bookings } from '@/collections/Bookings'
import { redwoodDefaultTestTypeField } from '@/collections/Clients/redwoodFields'
import { Courts } from '@/collections/Courts'
import { Employers } from '@/collections/Employers'
import { testTypeSelectOptions } from '@/config/test-types'

function getField(config: CollectionConfig, name: string): Field {
  const field = config.fields.find((candidate) => 'name' in candidate && candidate.name === name)
  if (!field) throw new Error(`${config.slug}.${name} field not found`)
  return field
}

describe('configured test type storage fields', () => {
  it.each([
    ['courts.preferredTestType', getField(Courts, 'preferredTestType')],
    ['employers.preferredTestType', getField(Employers, 'preferredTestType')],
    ['bookings.scheduledTestType', getField(Bookings, 'scheduledTestType')],
    ['clients.defaultTestType', redwoodDefaultTestTypeField],
  ])('%s stores canonical config values', (_label, field) => {
    expect(field).toMatchObject({
      type: 'select',
      options: testTypeSelectOptions,
    })
    expect('relationTo' in field).toBe(false)
  })
})
