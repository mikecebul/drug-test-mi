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
  const prepared = await prepareLabResultDecision(values, false)
  if (!prepared.success) return { success: false, testId: undefined, error: prepared.error }
  const upload = { ...values.upload, file: await materializeBrowserFile(values.upload.file) }
  const acknowledgement = {
    confirmed: values.matchCollection.clientMismatchConfirmed,
    key: values.matchCollection.clientMismatchConfirmationKey,
  }
  const base = { upload, extract: { extracted: true }, matchCollection: values.matchCollection, emails: values.emails }
  return requiredType === 'screening'
    ? updateLabScreenWithEmailReview({ ...base, labScreenData: values.results.screening }, undefined, acknowledgement, {
        applyCredit: false,
      })
    : updateLabConfirmationWithEmailReview(
        { ...base, labConfirmationData: values.results.confirmation },
        undefined,
        acknowledgement,
      )
}

/** Results → Review sends the optional link and advances without waiting for payment. */
export async function prepareLabResultDecision(values: LabResultsValues, sendPaymentEmail = true) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await headers() })
    if (!user || user.collection !== 'admins') throw new Error('Admin access required.')
    if (!matchSchema.safeParse(values.matchCollection).success || !resultsSchema.safeParse(values.results).success)
      throw new Error('Review the collection and every result before continuing.')
    if (values.results.mode !== 'screening') return { success: true }
    const test = await payload.findByID({
      collection: 'drug-tests',
      id: values.matchCollection.testId,
      depth: 0,
      user,
      overrideAccess: false,
    })
    if (!eligibleLabCollection(test, 'screening')) throw new Error('This collection has changed. Choose it again.')
    const { readLabReportFile, verifyLabReportIdentity } = await import('../components/readLabReport')
    const { report } = await readLabReportFile(await materializeBrowserFile(values.upload.file))
    const clientId = typeof test.relatedClient === 'string' ? test.relatedClient : test.relatedClient.id
    const client = await payload.findByID({
      collection: 'clients',
      id: clientId,
      depth: 0,
      user,
      overrideAccess: false,
    })
    await verifyLabReportIdentity(report, client, {
      confirmed: values.matchCollection.clientMismatchConfirmed,
      key: values.matchCollection.clientMismatchConfirmationKey,
    })
    if (report.reportKind === 'confirmation')
      throw new Error('This report contains confirmation results, not a new screen.')
    // Existing confirmation results are historical facts, not a new paid order.
    if (report.hasConfirmation) return { success: true }
    const { computeTestResults } = await import('@/collections/DrugTests/services/testResults')
    const classification = await computeTestResults({
      payload,
      clientId,
      detectedSubstances: values.results.screening
        .detectedSubstances as import('@/fields/substanceOptions').SubstanceValue[],
      medicationsAtTestTime: test.medicationsArrayAtTestTime || [],
      testType: test.testType,
      breathalyzerTaken: test.breathalyzerTaken || false,
      breathalyzerResult: test.breathalyzerResult,
    })
    const decision = values.results.screening.confirmationDecision || (classification.autoAccept ? 'accept' : undefined)
    if (!decision) throw new Error('Choose a result decision before continuing.')
    // Acceptance/deferment with no existing confirmation charge only changes the report draft.
    // Persist it with the final report; navigating to Review must not start a payment transaction.
    if (
      decision !== 'request-confirmation' &&
      !test.confirmationRequestKey &&
      !(test.payment?.confirmationFeeDue || 0)
    ) {
      const { knownScreeningDate, confirmationHoldUntil, referralPaysConfirmation } =
        await import('@/collections/DrugTests/confirmation/policy')
      const screenedAt =
        knownScreeningDate(test) || values.results.screening.screeningResultDate || new Date().toISOString()
      return {
        success: true,
        prepared: {
          testId: test.id,
          screenedAt,
          confirmationHoldUntil: confirmationHoldUntil(screenedAt),
          paymentRequired: false,
          billedToReferral: referralPaysConfirmation(test),
        },
      }
    }
    const { prepareConfirmation } = await import('@/collections/DrugTests/confirmation/prepare')
    await prepareConfirmation({
      payload,
      user,
      testId: test.id,
      decision,
      substances: decision === 'request-confirmation' ? values.results.screening.confirmationSubstances || [] : [],
      screenedAt: values.results.screening.screeningResultDate || new Date().toISOString(),
      creditPayment: decision === 'request-confirmation' && values.results.useConfirmationCredit ? 'full' : 'none',
    })
    const prepared = await payload.findByID({
      collection: 'drug-tests',
      id: test.id,
      depth: 0,
      user,
      overrideAccess: false,
    })
    const { confirmationPaymentRequired, confirmationPaid, referralPaysConfirmation } =
      await import('@/collections/DrugTests/confirmation/policy')
    let paymentEmailSent = false
    if (
      sendPaymentEmail &&
      values.results.emailConfirmationPaymentLink &&
      !values.results.useConfirmationCredit &&
      decision === 'request-confirmation' &&
      !referralPaysConfirmation(prepared)
    ) {
      const { sendConfirmationPaymentLink } = await import('@/collections/DrugTests/confirmation/paymentLink')
      // An explicit request in a new report draft can resend a previously emailed
      // checkout. The workflow suppresses repeated Back/Next sends for this draft.
      const email = await sendConfirmationPaymentLink(payload, test.id, undefined, true)
      paymentEmailSent = email.sent
    }
    return {
      success: true,
      paymentEmailSent,
      prepared: {
        testId: test.id,
        screenedAt: prepared.screenedAt,
        confirmationHoldUntil: prepared.confirmationHoldUntil,
        paymentRequired: confirmationPaymentRequired(prepared),
        billedToReferral: referralPaysConfirmation(prepared),
        creditRemaining:
          (await payload.findByID({ collection: 'clients', id: clientId, depth: 0, user, overrideAccess: false }))
            .creditBalance ?? 0,
        creditPaid:
          values.results.useConfirmationCredit && prepared.payment?.method === 'credit'
            ? confirmationPaid(prepared)
            : 0,
      },
    }
  } catch (error) {
    if (
      values.results.useConfirmationCredit &&
      error instanceof Error &&
      error.name === 'PaymentTransactionsUnavailableError'
    )
      return {
        success: false,
        error:
          'Account credit needs database transactions. No credit was used. Uncheck account credit to continue unpaid.',
      }
    return { success: false, error: error instanceof Error ? error.message : 'Unable to prepare the result decision.' }
  }
}
