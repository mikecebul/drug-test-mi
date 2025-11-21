'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Stepper, type Step } from '@/components/ui/stepper'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { UploadStep } from './steps/UploadStep'
import { ExtractStep } from './steps/ExtractStep'
import { VerifyClientStep } from './steps/VerifyClientStep'
import { VerifyDataStep } from './steps/VerifyDataStep'
import { ConfirmStep } from './steps/ConfirmStep'
import type { WizardStep, ParsedPDFData, ClientMatch, VerifiedTestData } from './types'

export function PDFUploadWizardClient() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedPDFData | null>(null)
  const [selectedClient, setSelectedClient] = useState<ClientMatch | null>(null)
  const [verifiedData, setVerifiedData] = useState<VerifiedTestData | null>(null)

  const steps: Step[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'extract', label: 'Extract' },
    { id: 'verify-client', label: 'Client' },
    { id: 'verify-data', label: 'Verify' },
    { id: 'confirm', label: 'Confirm' },
  ]

  const handleComplete = (testId: string) => {
    // Redirect to the created drug test in admin panel
    router.push(`/admin/collections/drug-tests/${testId}`)
  }

  return (
    <ShadcnWrapper className="max-w-5xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Drug Test Upload Wizard</h1>
        <p className="text-muted-foreground">
          Upload and process drug test PDFs quickly and accurately
        </p>
      </div>

      <div className="mb-8">
        <Stepper steps={steps} currentStepId={currentStep} />
      </div>

      <div className="wizard-content">
        {currentStep === 'upload' && (
          <UploadStep
            onNext={(file) => {
              setUploadedFile(file)
              setCurrentStep('extract')
            }}
          />
        )}

        {currentStep === 'extract' && uploadedFile && (
          <ExtractStep
            file={uploadedFile}
            onNext={(data) => {
              setParsedData(data)
              setCurrentStep('verify-client')
            }}
            onBack={() => setCurrentStep('upload')}
          />
        )}

        {currentStep === 'verify-client' && parsedData && (
          <VerifyClientStep
            parsedData={parsedData}
            onNext={(client) => {
              setSelectedClient(client)
              setCurrentStep('verify-data')
            }}
            onBack={() => setCurrentStep('extract')}
          />
        )}

        {currentStep === 'verify-data' && parsedData && selectedClient && (
          <VerifyDataStep
            parsedData={parsedData}
            client={selectedClient}
            onNext={(data) => {
              setVerifiedData(data)
              setCurrentStep('confirm')
            }}
            onBack={() => setCurrentStep('verify-client')}
          />
        )}

        {currentStep === 'confirm' && verifiedData && selectedClient && uploadedFile && (
          <ConfirmStep
            data={verifiedData}
            client={selectedClient}
            file={uploadedFile}
            onComplete={handleComplete}
            onBack={() => setCurrentStep('verify-data')}
          />
        )}
      </div>
    </ShadcnWrapper>
  )
}
