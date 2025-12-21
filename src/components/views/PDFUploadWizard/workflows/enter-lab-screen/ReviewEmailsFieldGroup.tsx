import { withFieldGroup } from '@/blocks/Form/hooks/form'
import {
  reviewEmailsDefaultValues,
  RenderReviewEmailsFieldGroup,
  reviewEmailsFieldSchema,
} from '../../field-groups/BaseReviewEmailsFieldGroup'

/**
 * Enter Lab Screen workflow-specific wrapper for ReviewEmailsFieldGroup
 * Uses 'screening' mode for lab screening results
 */
export const ReviewEmailsFieldGroup = withFieldGroup({
  defaultValues: reviewEmailsDefaultValues,
  props: {
    title: 'Review Emails',
    description: '',
    workflowMode: 'screening' as const,
  },
  render: RenderReviewEmailsFieldGroup,
})

export { reviewEmailsFieldSchema }
