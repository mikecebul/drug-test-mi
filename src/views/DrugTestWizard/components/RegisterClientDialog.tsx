'use client'

import React, { useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAppForm } from '@/blocks/Form/hooks/form'
import type { ClientMatch } from '../types'
import { registerClientFromWizard } from '../actions'
import ShadcnWrapper from '@/components/ShadcnWrapper'
import {
  PersonalInfoStep,
  AccountInfoStep,
  ScreeningTypeStep,
  RecipientsStep,
  TermsStep,
} from '@/app/(frontend)/register/steps'
import {
  COURT_CONFIGS,
  EMPLOYER_CONFIGS,
  isValidEmployerType,
  isValidCourtType,
} from '@/app/(frontend)/register/configs/recipient-configs'
import { stepSchemas } from '@/views/DrugTestWizard/workflows/register-client-workflow/validators'
import { defaultValues, getRegisterClientFormOpts } from '@/app/(frontend)/register/shared-form'
import type { FormValues } from '@/app/(frontend)/register/validators'

interface RegisterClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillFirstName?: string
  prefillLastName?: string
  prefillMiddleInitial?: string
  prefillDob?: string | null
  prefillGender?: string | null
  onClientCreated: (client: ClientMatch, generatedPassword: string) => void
}

const STEPS = [
  { title: 'Personal Info', description: 'Basic information' },
  { title: 'Account Info', description: 'Email and password' },
  { title: 'Screening Type', description: 'Who is requesting this' },
  { title: 'Recipients', description: 'Where to send results' },
  { title: 'Terms', description: 'Terms and conditions' },
]

// Generate a secure password
function generatePassword(): string {
  const length = 12
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lowercase = 'abcdefghjkmnpqrstuvwxyz'
  const numbers = '23456789'

  let password = ''
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]

  const all = uppercase + lowercase + numbers
  for (let i = 3; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)]
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}

export function RegisterClientDialog({
  open,
  onOpenChange,
  prefillFirstName = '',
  prefillLastName = '',
  prefillMiddleInitial = '',
  prefillDob = null,
  prefillGender = null,
  onClientCreated,
}: RegisterClientDialogProps) {
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [generatedPassword] = useState(generatePassword())
  const [createdClient, setCreatedClient] = useState<ClientMatch | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Map PDF gender code to form gender value
  const mapGenderValue = (pdfGender: string | null): string => {
    if (!pdfGender) return ''
    const normalized = pdfGender.toUpperCase()
    if (normalized === 'M') return 'male'
    if (normalized === 'F') return 'female'
    return ''
  }

  // Initialize form with pre-filled data and generated password
  const dialogDefaultValues: FormValues = {
    ...defaultValues,
    personalInfo: {
      ...defaultValues.personalInfo,
      firstName: prefillFirstName,
      lastName: prefillLastName,
      middleInitial: prefillMiddleInitial,
      gender: mapGenderValue(prefillGender),
      dob: prefillDob || '',
      headshot: null,
    },
    accountInfo: {
      ...defaultValues.accountInfo,
      email: '',
      password: generatedPassword,
      confirmPassword: generatedPassword,
    },
    terms: {
      ...defaultValues.terms,
      agreeToTerms: true, // Auto-agree for admin registration
    },
  }

  const form = useAppForm({
    ...getRegisterClientFormOpts('personalInfo'),
    defaultValues: dialogDefaultValues,
  })

  const formValues = useStore(form.store, (state: any) => state.values)
  const _requestedBy = formValues.screeningType?.requestedBy || ''

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setCurrentStep(0)
      setIsSubmitting(false)
      setRegistrationComplete(false)
      setCreatedClient(null)
      setPasswordCopied(false)
      setShowPassword(false)
      form.reset()
    }
    onOpenChange(newOpen)
  }

  const validateStep = async (step: number): Promise<boolean> => {
    const schema = stepSchemas[step]
    if (!schema) return true

    try {
      // Get only the fields relevant to this step
      const stepData: any = {}
      if (step === 0) stepData.personalInfo = formValues.personalInfo
      if (step === 1) stepData.accountInfo = formValues.accountInfo
      if (step === 2) stepData.screeningType = formValues.screeningType
      if (step === 3) {
        // Results recipient validation needs screeningType.requestedBy to determine which rules to apply
        stepData.recipients = formValues.recipients
        stepData.screeningType = formValues.screeningType
      }
      if (step === 4) stepData.terms = formValues.terms

      const result = schema.safeParse(stepData)
      if (!result.success) {
        const firstError = result.error.issues[0]
        toast.error(firstError.message)
        return false
      }
      return true
    } catch (_error) {
      toast.error('Validation error')
      return false
    }
  }

  const handleNext = async () => {
    const isValid = await validateStep(currentStep)
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      const { personalInfo, accountInfo, screeningType, recipients } = formValues

      const data: Parameters<typeof registerClientFromWizard>[0] = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        middleInitial: personalInfo.middleInitial || undefined,
        gender: personalInfo.gender,
        dob: personalInfo.dob,
        phone: personalInfo.phone,
        email: accountInfo.email,
        clientType: screeningType.requestedBy as 'self' | 'employment' | 'probation',
      }

      // Add type-specific recipient info
      const clientType = screeningType.requestedBy
      if (clientType === 'probation') {
        const court = isValidCourtType(recipients.selectedCourt)
          ? recipients.selectedCourt
          : null
        if (court && court !== 'other') {
          const config = COURT_CONFIGS[court]
          data.courtInfo = {
            courtName: config.label,
            recipients: [...config.recipients],
          }
        } else if (recipients.selectedCourt === 'other') {
          data.courtInfo = {
            courtName: recipients.courtName,
            recipients: [
              {
                name: recipients.probationOfficerName,
                email: recipients.probationOfficerEmail,
              },
            ],
          }
        }
      } else if (clientType === 'employment') {
        const employer = isValidEmployerType(recipients.selectedEmployer)
          ? recipients.selectedEmployer
          : null
        if (employer && employer !== 'other') {
          const config = EMPLOYER_CONFIGS[employer]
          data.employmentInfo = {
            employerName: config.label,
            recipients: [...config.recipients],
          }
        } else if (recipients.selectedEmployer === 'other') {
          data.employmentInfo = {
            employerName: recipients.employerName,
            recipients: [
              { name: recipients.contactName, email: recipients.contactEmail },
            ],
          }
        }
      } else if (clientType === 'self' && !recipients.useSelfAsRecipient) {
        data.selfInfo = {
          recipients: [
            {
              name: recipients.alternativeRecipientName,
              email: recipients.alternativeRecipientEmail,
            },
          ],
        }
      }

      const result = await registerClientFromWizard(data)

      if (result.success && result.client && result.generatedPassword) {
        setCreatedClient(result.client)
        setRegistrationComplete(true)

        // Invalidate client queries so the new client appears in the lists immediately
        queryClient.invalidateQueries({ queryKey: ['matching-clients'] })
        queryClient.invalidateQueries({ queryKey: ['all-clients'] })
      } else {
        toast.error(result.error || 'Failed to register client')
      }
    } catch (error) {
      toast.error('An unexpected error occurred')
      console.error('Registration error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleComplete = () => {
    if (createdClient) {
      const passwordUsed = formValues.accountInfo?.password || generatedPassword
      onClientCreated(createdClient, passwordUsed)
      handleOpenChange(false)
    }
  }

  const handleCopyPassword = async () => {
    try {
      const passwordToCopy = formValues.accountInfo?.password || generatedPassword
      await navigator.clipboard.writeText(passwordToCopy)
      setPasswordCopied(true)
      toast.success('Password copied to clipboard')
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch {
      toast.error('Failed to copy password')
    }
  }

  const renderStepContent = () => {
    if (registrationComplete) {
      return (
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold">Client Registered Successfully!</h3>
            <p className="text-muted-foreground mt-1">
              {createdClient?.firstName} {createdClient?.lastName} has been added to the system.
            </p>
          </div>

          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="space-y-3">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Client Password (Save this now!)
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-amber-100 px-3 py-2 font-mono text-lg dark:bg-amber-900/50">
                  {showPassword
                    ? formValues.accountInfo?.password || generatedPassword
                    : '••••••••••••'}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="shrink-0"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPassword}
                  className="shrink-0"
                >
                  {passwordCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                The client can use this password to log in and reset it later if they choose to use
                the dashboard.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex justify-center">
            <Button onClick={handleComplete} className="min-w-50">
              Continue with this client
            </Button>
          </div>
        </div>
      )
    }

    switch (currentStep) {
      case 0:
        return <PersonalInfoStep form={form} />
      case 1:
        return (
          <div className="space-y-6">
            <AccountInfoStep form={form} />
            <Alert>
              <AlertDescription className="text-muted-foreground text-sm">
                Password is auto-generated but can be changed if the client requests a specific
                password.
              </AlertDescription>
            </Alert>
          </div>
        )
      case 2:
        return <ScreeningTypeStep form={form} />
      case 3:
        return <RecipientsStep form={form} />
      case 4:
        return <TermsStep form={form} />
      default:
        return null
    }
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <ShadcnWrapper className="">
          <DialogHeader>
            <DialogTitle>Register New Client</DialogTitle>
            <DialogDescription>
              {registrationComplete
                ? 'Registration complete'
                : `Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep].title}`}
            </DialogDescription>
          </DialogHeader>

          {!registrationComplete && (
            <div className="mb-6">
              <Progress value={progress} className="h-2" />
              <div className="mt-2 flex justify-between text-xs">
                {STEPS.map((step, index) => (
                  <div
                    key={step.title}
                    className={`${
                      index <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="hidden sm:inline">{step.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {renderStepContent()}

            {!registrationComplete && (
              <div className="mt-6 flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="min-w-35"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Register Client
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </form>
        </ShadcnWrapper>
      </DialogContent>
    </Dialog>
  )
}
