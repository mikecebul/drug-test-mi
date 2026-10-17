import { FieldApi, FormApi, FormGroupApi, revalidateLogic } from '@tanstack/react-form'
import { expect, it, vi } from 'vitest'
import { getInstantTestFormOpts } from './shared-form'
import { verifyDataSchema } from './validators'

it('revalidates the active group when an empty confirmation request changes to acceptance', async () => {
  const form = new FormApi(getInstantTestFormOpts())
  const submit = vi.fn()
  const group = new FormGroupApi({
    form,
    name: 'verifyData',
    validationLogic: revalidateLogic(),
    validators: { onDynamic: verifyDataSchema.shape.verifyData },
    onGroupSubmit: submit,
  })
  const cleanups = [
    form.mount(),
    group.mount(),
    new FieldApi({ form, name: 'verifyData.confirmationDecision' }).mount(),
    new FieldApi({ form, name: 'verifyData.confirmationSubstances' }).mount(),
  ]
  try {
    form.setFieldValue('verifyData.confirmationDecisionRequired', true)
    form.setFieldValue('verifyData.confirmationDecision', 'request-confirmation', { dontValidate: true })
    await group.validate('submit', { skipFormValidation: true })
    await group.handleSubmit()
    expect(submit).not.toHaveBeenCalled()
    expect(group.state.meta.isSubmitting).toBe(false)
    expect(group.state.meta.isValid).toBe(false)

    form.setFieldValue('verifyData.confirmationDecision', 'accept', { dontValidate: true })
    await group.validate('submit', { skipFormValidation: true })
    await group.handleSubmit()
    expect(group.state.meta.isValid).toBe(true)
    expect(group.state.meta.isSubmitting).toBe(false)
    expect(submit).toHaveBeenCalledOnce()
  } finally {
    cleanups.reverse().forEach((cleanup) => cleanup())
  }
})
