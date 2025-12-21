import { withFieldGroup } from '@/blocks/Form/hooks/form'
import {
  verifyTestDefaultValues,
  RenderVerifyTestFieldGroup,
  verifyTestFieldSchema,
} from '../../field-groups/BaseVerifyTestFieldGroup'

/**
 * Enter Lab Confirmation workflow-specific wrapper for VerifyTestFieldGroup
 * Filters for tests with 'screened' or 'confirmation-pending' status (ready for confirmation)
 */
export const VerifyTestFieldGroup = withFieldGroup({
  defaultValues: verifyTestDefaultValues,
  props: {
    title: 'Match Test for Confirmation',
    description: 'Select the test that needs confirmation results',
    filterStatus: ['screened', 'confirmation-pending'],
    workflowType: 'lab' as const,
  },
  render: RenderVerifyTestFieldGroup,
})

export { verifyTestFieldSchema }
