import { z } from 'zod'
import { allSubstanceOptions } from '@/fields/substanceOptions'

const allowedSubstances = new Set<string>(
  allSubstanceOptions.filter((option) => option.value !== 'none').map((option) => option.value),
)

/** Shared by the summary editor and its server action; changing a decision also changes its charge. */
export const confirmationDecisionFormSchema = z
  .object({
    confirmationDecision: z.enum(['pending-decision', 'accept', 'request-confirmation']),
    confirmationSubstances: z.array(
      z.string().refine((value) => allowedSubstances.has(value), 'Choose a valid substance.'),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.confirmationDecision === 'request-confirmation' && !value.confirmationSubstances.length)
      ctx.addIssue({
        code: 'custom',
        path: ['confirmationSubstances'],
        message: 'Select at least one substance for confirmation.',
      })
  })

export type ConfirmationDecisionFormValues = z.infer<typeof confirmationDecisionFormSchema>
