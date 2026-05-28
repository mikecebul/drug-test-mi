export type RegisterStepBodyProps = {
  mode: 'body'
}

export type RegisterStepWizardProps = {
  mode: 'wizard'
  isFirstStep: boolean
  isLastStep: boolean
  isSubmitting: boolean
  onBack: () => void
  onInvalid: () => void
  onNext: () => void | Promise<void>
}

export type RegisterStepProps = RegisterStepBodyProps | RegisterStepWizardProps
