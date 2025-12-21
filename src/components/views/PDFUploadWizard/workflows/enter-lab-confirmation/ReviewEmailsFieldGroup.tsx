import { withFieldGroup } from '@/blocks/Form/hooks/form'
import {
  reviewEmailsDefaultValues,
  RenderReviewEmailsFieldGroup,
  reviewEmailsFieldSchema,
} from '../../field-groups/BaseReviewEmailsFieldGroup'

/**
 * Enter Lab Confirmation workflow-specific wrapper for ReviewEmailsFieldGroup
 * Uses 'confirmation' mode for LC-MS/MS confirmation results
 */
export const ReviewEmailsFieldGroup = withFieldGroup({
  defaultValues: reviewEmailsDefaultValues,
  props: {
    title: 'Review Emails',
    description: '',
    workflowMode: 'confirmation' as const,
  },
  render: RenderReviewEmailsFieldGroup,
})

export { reviewEmailsFieldSchema }
