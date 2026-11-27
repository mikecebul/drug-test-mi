import type { SelectField } from 'payload'

import { testTypeSelectOptions, type TestTypeValue } from '@/config/test-types'

const defaultTestType: TestTypeValue = '11-panel-lab'

export const referralPreferredTestTypeField: SelectField = {
  name: 'preferredTestType',
  type: 'select',
  options: testTypeSelectOptions,
  defaultValue: defaultTestType,
  hooks: {
    beforeValidate: [
      ({ operation, value }) => {
        if (operation === 'create' && (value == null || value === '')) return defaultTestType
        return value
      },
    ],
  },
}
