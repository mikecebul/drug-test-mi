'use client'

import { Button } from '@/components/ui/button'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { clearWizardQueryCache } from '../../queries'
import { steps as collectLabSteps } from '../../workflows/collect-lab/validators'
import { steps as instantTestSteps } from '../../workflows/instant-test/validators'
import { clearFileStorage } from '../../workflows/instant-test/utils/fileStorage'
import { steps as labConfirmationSteps } from '../../workflows/lab-confirmation/validators'
import { steps as labScreenSteps } from '../../workflows/lab-screen/validators'
import { steps as registerClientSteps } from '../../workflows/register-client-workflow/validators'

const workflowTypes = [
  'guided',
  'complete-workflow',
  'register-client',
  'collect-lab',
  'enter-lab-screen',
  'enter-lab-confirmation',
  'instant-test',
  '15-panel-instant',
  '17-panel-instant',
] as const

const firstStepMap: Record<(typeof workflowTypes)[number], string> = {
  guided: 'schedule',
  'complete-workflow': 'schedule',
  'register-client': registerClientSteps[0],
  'collect-lab': collectLabSteps[0],
  'instant-test': instantTestSteps[0],
  '15-panel-instant': instantTestSteps[0],
  '17-panel-instant': instantTestSteps[0],
  'enter-lab-screen': labScreenSteps[0],
  'enter-lab-confirmation': labConfirmationSteps[0],
}

export const ResetFormButton = () => {
  const queryClient = useQueryClient()
  const [states, setStates] = useQueryStates(
    {
      workflow: parseAsStringLiteral(workflowTypes),
      step: parseAsString,
      clientId: parseAsString,
      bookingId: parseAsString,
      returnTo: parseAsString,
      testType: parseAsString,
    },
    { history: 'push' },
  )

  const workflow = states.workflow

  if (!workflow) {
    return null
  }

  const handleReset = () => {
    clearWizardQueryCache(queryClient)
    clearFileStorage()

    if (
      states.bookingId &&
      (workflow === 'collect-lab' ||
        workflow === 'instant-test' ||
        workflow === '15-panel-instant' ||
        workflow === '17-panel-instant')
    ) {
      setStates({
        workflow: 'guided',
        step: 'schedule',
        clientId: null,
        bookingId: null,
        returnTo: null,
        testType: null,
      })
      return
    }

    setStates({
      workflow,
      step: firstStepMap[workflow],
      clientId: null,
      bookingId: null,
      returnTo: null,
      testType: null,
    })
  }

  return (
    <Button
      className="absolute top-0 right-0"
      onClick={handleReset}
      size="icon"
      title="Reset Wizard"
      type="button"
      variant="ghost"
    >
      <RotateCcw className="size-6" />
    </Button>
  )
}
