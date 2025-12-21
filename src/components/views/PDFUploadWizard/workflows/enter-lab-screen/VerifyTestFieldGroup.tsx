import { withFieldGroup } from '@/blocks/Form/hooks/form'
import {
  verifyTestDefaultValues,
  RenderVerifyTestFieldGroup,
  verifyTestFieldSchema,
} from '../../field-groups/BaseVerifyTestFieldGroup'

/**
 * Enter Lab Screen workflow-specific wrapper for VerifyTestFieldGroup
 * Filters for tests with 'collected' status (ready for screening)
 */
export const VerifyTestFieldGroup = withFieldGroup({
  defaultValues: verifyTestDefaultValues,
  props: {
    title: 'Match Test for Screening',
    description: 'Select the test that needs screening results',
    filterStatus: ['collected'],
    workflowType: 'lab' as const,
  },
  render: RenderVerifyTestFieldGroup,
})

export { verifyTestFieldSchema }
