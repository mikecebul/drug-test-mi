import { withFieldGroup } from '@/blocks/Form/hooks/form'
import {
  reviewEmailsDefaultValues,
  RenderReviewEmailsFieldGroup,
  reviewEmailsFieldSchema,
} from '../../field-groups/BaseReviewEmailsFieldGroup'

/**
 * Instant Test workflow-specific wrapper for ReviewEmailsFieldGroup
 * Uses 'screening' mode for initial drug test results
 */
export const ReviewEmailsFieldGroup = withFieldGroup({
  defaultValues: reviewEmailsDefaultValues,
  props: {
    title: 'Review Emails',
    description: 'Review and customize the emails that will be sent for this drug test',
    workflowMode: 'screening' as const,
  },
  render: RenderReviewEmailsFieldGroup,
})

export { reviewEmailsFieldSchema }
