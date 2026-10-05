'use client'

import React from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, CheckCircle, UserPlus, CalendarCheck } from 'lucide-react'
import { cn } from '@/utilities/cn'
import type { WizardType } from '../../types'
import { Separator } from '@/components/ui/separator'

interface WizardOption {
  id: WizardType
  icon: React.ElementType
  title: string
  description: string
  color: string
  borderColor: string
  bgColor: string
}

const wizardOptions: WizardOption[] = [
  {
    id: 'guided',
    icon: CalendarCheck,
    title: 'Complete Scheduled Collection',
    description:
      "Start from today's Cal.com appointments, confirm test details, record payment, and continue collection",
    color: 'text-teal-600',
    borderColor: 'border-teal-300 dark:border-teal-700',
    bgColor: 'bg-teal-50 dark:bg-teal-950/30',
  },
  {
    id: 'register-client',
    icon: UserPlus,
    title: 'Register New Client',
    description: 'Add a new client to the system before collecting specimen',
    color: 'text-purple-600',
    borderColor: 'border-purple-300 dark:border-purple-700',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    id: 'enter-lab-screen',
    icon: ClipboardList,
    title: 'Enter Lab Screen Data',
    description: 'Enter results for an 11-panel, 11-panel no EtG, 17-panel, or EtG screen',
    color: 'text-indigo-600',
    borderColor: 'border-indigo-300 dark:border-indigo-700',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
  {
    id: 'enter-lab-confirmation',
    icon: CheckCircle,
    title: 'Enter Lab Confirmation Data',
    description: 'Enter confirmation results for 11-panel, 11-panel no EtG, 17-panel, or EtG lab',
    color: 'text-orange-600',
    borderColor: 'border-orange-300 dark:border-orange-700',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
]

interface WizardTypeSelectorProps {
  onSelect: (wizardType: WizardType) => void
}

export function WizardTypeSelector({ onSelect }: WizardTypeSelectorProps) {
  const renderOption = (id: WizardType) => {
    const option = wizardOptions.find((o) => o.id === id)
    if (!option) return null
    const Icon = option.icon

    return (
      <button
        key={option.id}
        type="button"
        aria-label={option.title}
        className="focus-visible:ring-ring w-full rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onSelect(option.id)}
      >
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="p-4">
            <div className="flex items-center gap-6">
              <div className={cn('flex size-12 shrink-0 items-center justify-center rounded-lg', option.bgColor)}>
                <Icon className={cn('size-6', option.color)} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{option.title}</CardTitle>
                <CardDescription className="mt-1.5 text-base">{option.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </button>
    )
  }
  return (
    <div className="max-w-2xl space-y-6">
      {/* Group 1: Registration */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Guided Workflow</h3>
        {renderOption('guided')}
      </div>
      <Separator />
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Onboarding</h3>
        {renderOption('register-client')}
      </div>
      <Separator />
      {/* Group 3: Administrative / Data Entry */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Data Entry & Results</h3>
        <div className="grid gap-4">
          {renderOption('enter-lab-screen')}
          {renderOption('enter-lab-confirmation')}
        </div>
      </div>
    </div>
  )
}
