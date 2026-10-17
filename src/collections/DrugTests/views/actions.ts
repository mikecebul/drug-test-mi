'use server'

import { getPayload } from 'payload'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import config from '@payload-config'
import { confirmationDecisionFormSchema } from '../confirmation/decisionForm'
import { prepareConfirmation } from '../confirmation/prepare'

/** Keep the summary on the same fee, funding, expiry, and checkout rules as the wizard. */
export async function updateConfirmationDecision(testId: string, input: unknown) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user?.collection !== 'admins') return { success: false, error: 'Admin access required.' }
  const parsed = confirmationDecisionFormSchema.safeParse(input)
  if (!testId || !parsed.success) return { success: false, error: 'Review the confirmation decision and substances.' }
  try {
    await prepareConfirmation({
      payload,
      user,
      testId,
      decision: parsed.data.confirmationDecision,
      substances: parsed.data.confirmationDecision === 'request-confirmation' ? parsed.data.confirmationSubstances : [],
      // Editing a decision never silently spends account credit.
      creditPayment: 'none',
    })
    revalidatePath(`/admin/collections/drug-tests/${testId}/summary`)
    revalidatePath('/admin/drug-test-tracker')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unable to update the decision.' }
  }
}
