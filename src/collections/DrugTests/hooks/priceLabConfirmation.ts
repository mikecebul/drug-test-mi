import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { getTestTypeByValue } from '@/config/test-types'
import type { DrugTest } from '@/payload-types'
import {
  getConfirmationSubstances,
  getOutstandingConfirmations,
  LAB_CONFIRMATION_FEE,
  priceConfirmation,
} from '../helpers/confirmationPayment'

export const priceLabConfirmation: CollectionBeforeChangeHook<DrugTest> = ({ data, originalDoc, req }) => {
  if (!data || req.context?.skipTestResultComputation) return data

  const test = { ...originalDoc, ...data }
  if (
    getTestTypeByValue(test.testType)?.category !== 'lab' ||
    test.confirmationDecision !== 'request-confirmation' ||
    test.isInconclusive ||
    test.confirmationDocument ||
    test.redwoodConfirmationSentAt
  ) return data

  const selected = getConfirmationSubstances(test.confirmationSubstances)
  if (!getOutstandingConfirmations(selected, test.confirmationResults).length) return data

  const previous = getConfirmationSubstances(originalDoc?.confirmationSubstances)
  if (
    originalDoc?.confirmationDecision === 'request-confirmation' &&
    previous.length === selected.length &&
    previous.every((substance) => selected.includes(substance))
  ) return data

  const currentPayment = { ...originalDoc?.payment, ...data.payment }
  const confirmationFee = LAB_CONFIRMATION_FEE * selected.length
  const payment = priceConfirmation(currentPayment, confirmationFee)
  if (
    (currentPayment.confirmationFeeDue ?? 0) > confirmationFee &&
    (payment.amountPaid ?? 0) > (payment.amountDue ?? 0)
  ) {
    throw new APIError('Reconcile the existing confirmation payment before reducing the fee.', 400)
  }

  data.confirmationSubstances = selected
  data.payment = payment
  return data
}
