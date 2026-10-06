'use server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { eligibleLabCollection, resultsSchema, matchSchema, type LabResultsValues } from './model'
import { updateLabScreenWithEmailReview } from '../lab-screen/actions/updateLabScreenWithEmailReview'
import { updateLabConfirmationWithEmailReview } from '../lab-confirmation/actions/updateLabConfirmationWithEmailReview'
import { materializeBrowserFile } from '../../utils/materializeBrowserFile'

export async function submitLabResults(values: LabResultsValues) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'admins') return { success: false, error: 'Admin access required' }
  if (!matchSchema.safeParse(values.matchCollection).success || !resultsSchema.safeParse(values.results).success)
    return { success: false, error: 'Review the collection and every result before saving' }
  const test = await payload.findByID({
    collection: 'drug-tests',
    id: values.matchCollection.testId,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const requiredType = values.results.mode
  // Re-read stage and requests at save time. Confirmation uploads retain the stored screen.
  if (!eligibleLabCollection(test, requiredType))
    return { success: false, error: 'This collection has changed. Choose an eligible collection again.' }
  const upload = { ...values.upload, file: await materializeBrowserFile(values.upload.file) }
  const acknowledgement = {
    confirmed: values.matchCollection.clientMismatchConfirmed,
    key: values.matchCollection.clientMismatchConfirmationKey,
  }
  const base = { upload, extract: { extracted: true }, matchCollection: values.matchCollection, emails: values.emails }
  return requiredType === 'screening'
    ? updateLabScreenWithEmailReview({ ...base, labScreenData: values.results.screening }, undefined, acknowledgement)
    : updateLabConfirmationWithEmailReview(
        { ...base, labConfirmationData: values.results.confirmation },
        undefined,
        acknowledgement,
      )
}
