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
  DialogTrigger,
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
  PersonalInfoGroup,
  AccountInfoGroup,
  ScreeningRequestGroup,
  ResultsRecipientGroup,
  TermsAndConditionsGroup,
} from '@/app/(frontend)/register/field-groups'
import {
  COURT_CONFIGS,
  EMPLOYER_CONFIGS,
  isValidEmployerType,
  isValidCourtType,
} from '@/app/(frontend)/register/configs/recipient-configs'
import { stepSchemas } from '@/app/(frontend)/register/schemas/registrationSchemas'

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
  const form = useAppForm({
    defaultValues: {
      personalInfo: {
        firstName: prefillFirstName,
        lastName: prefillLastName,
        gender: mapGenderValue(prefillGender),
        dob: prefillDob || '',
        phone: '',
      },
      accountInfo: {
        email: '',
        password: generatedPassword,
        confirmPassword: generatedPassword,
      },
      screeningRequest: {
        requestedBy: '',
      },
      resultsRecipient: {
        useSelfAsRecipient: true,
        alternativeRecipientName: '',
        alternativeRecipientEmail: '',
        selectedEmployer: '',
        employerName: '',
        contactName: '',
        contactEmail: '',
        selectedCourt: '',
        courtName: '',
        probationOfficerName: '',
        probationOfficerEmail: '',
      },
      termsAndConditions: {
        agreeToTerms: true, // Auto-agree for admin registration
      },
    },
  })

  const formValues = useStore(form.store, (state: any) => state.values)
  const requestedBy = formValues.screeningRequest?.requestedBy || ''

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
      if (step === 2) stepData.screeningRequest = formValues.screeningRequest
      if (step === 3) {
        // Results recipient validation needs screeningRequest.requestedBy to determine which rules to apply
        stepData.resultsRecipient = formValues.resultsRecipient
        stepData.screeningRequest = formValues.screeningRequest
      }
      if (step === 4) stepData.termsAndConditions = formValues.termsAndConditions

      const result = schema.safeParse(stepData)
      if (!result.success) {
        const firstError = result.error.issues[0]
        toast.error(firstError.message)
        return false
      }
      return true
    } catch (error) {
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
      const { personalInfo, accountInfo, screeningRequest, resultsRecipient } = formValues

      const data: Parameters<typeof registerClientFromWizard>[0] = {
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        middleInitial: undefined,
        gender: personalInfo.gender,
        dob: personalInfo.dob,
        phone: personalInfo.phone,
        email: accountInfo.email,
        clientType: screeningRequest.requestedBy as 'self' | 'employment' | 'probation',
      }

      // Add type-specific recipient info
      const clientType = screeningRequest.requestedBy
      if (clientType === 'probation') {
        const court = isValidCourtType(resultsRecipient.selectedCourt)
          ? resultsRecipient.selectedCourt
          : null
        if (court && court !== 'other') {
          const config = COURT_CONFIGS[court]
          data.courtInfo = {
            courtName: config.label,
            recipients: [...config.recipients],
          }
        } else if (resultsRecipient.selectedCourt === 'other') {
          data.courtInfo = {
            courtName: resultsRecipient.courtName,
            recipients: [
              {
                name: resultsRecipient.probationOfficerName,
                email: resultsRecipient.probationOfficerEmail,
              },
            ],
          }
        }
      } else if (clientType === 'employment') {
        const employer = isValidEmployerType(resultsRecipient.selectedEmployer)
          ? resultsRecipient.selectedEmployer
          : null
        if (employer && employer !== 'other') {
          const config = EMPLOYER_CONFIGS[employer]
          data.employmentInfo = {
            employerName: config.label,
            recipients: [...config.recipients],
          }
        } else if (resultsRecipient.selectedEmployer === 'other') {
          data.employmentInfo = {
            employerName: resultsRecipient.employerName,
            recipients: [
              { name: resultsRecipient.contactName, email: resultsRecipient.contactEmail },
            ],
          }
        }
      } else if (clientType === 'self' && !resultsRecipient.useSelfAsRecipient) {
        data.selfInfo = {
          recipients: [
            {
              name: resultsRecipient.alternativeRecipientName,
              email: resultsRecipient.alternativeRecipientEmail,
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
        return <PersonalInfoGroup form={form} fields="personalInfo" title="Personal Information" />
      case 1:
        return (
          <div className="space-y-6">
            <AccountInfoGroup form={form} fields="accountInfo" title="Account Info" />
            <Alert>
              <AlertDescription className="text-muted-foreground text-sm">
                Password is auto-generated but can be changed if the client requests a specific
                password.
              </AlertDescription>
            </Alert>
          </div>
        )
      case 2:
        return (
          <ScreeningRequestGroup
            form={form}
            // @ts-expect-error - Known TypeScript limitation with nested field inference. Same pattern used in RegistrationForm.tsx:82
            fields="screeningRequest"
            title="Screening Request"
          />
        )
      case 3:
        return (
          <ResultsRecipientGroup
            form={form}
            fields="resultsRecipient"
            title="Results Recipient"
            requestedBy={requestedBy}
          />
        )
      case 4:
        return (
          <TermsAndConditionsGroup
            form={form}
            fields="termsAndConditions"
            title="Terms & Conditions"
          />
        )
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
