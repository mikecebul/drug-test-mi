'use client'

import React from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Beaker, ClipboardList, CheckCircle, UserPlus } from 'lucide-react'
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
    id: 'register-client',
    icon: UserPlus,
    title: 'Register New Client',
    description: 'Add a new client to the system before collecting specimen',
    color: 'text-purple-600',
    borderColor: 'border-purple-300 dark:border-purple-700',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
  },
  {
    id: 'collect-lab',
    icon: Beaker,
    title: 'Collect Sample for Lab',
    description: 'Collect specimen for 11-panel, 17-panel, or EtG laboratory testing',
    color: 'text-blue-600',
    borderColor: 'border-blue-300 dark:border-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    id: '15-panel-instant',
    icon: Zap,
    title: 'Screen 15-Panel Instant',
    description: 'Perform an on-site 15-panel instant drug screen',
    color: 'text-green-600',
    borderColor: 'border-green-300 dark:border-green-700',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    id: 'enter-lab-screen',
    icon: ClipboardList,
    title: 'Enter Lab Screen Data',
    description: 'Enter results for an 11-panel, 17-panel, or EtG screen',
    color: 'text-indigo-600',
    borderColor: 'border-indigo-300 dark:border-indigo-700',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
  {
    id: 'enter-lab-confirmation',
    icon: CheckCircle,
    title: 'Enter Lab Confirmation Data',
    description: 'Enter confirmation results for 11-panel, 17-panel, or EtG lab',
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
      <Card
        key={option.id}
        className={cn('cursor-pointer transition-all hover:translate-x-1 hover:shadow-md', 'border')}
        onClick={() => onSelect(option.id)}
      >
        <CardHeader className="p-4">
          <div className="flex items-center gap-6">
            <div className={cn('flexsize-12 shrink-0 items-center justify-center rounded-lg', option.bgColor)}>
              <Icon className={cn('size-6', option.color)} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{option.title}</CardTitle>
              <CardDescription className="mt-1.5 text-base">{option.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    )
  }
  return (
    <div className="max-w-2xl space-y-6">
      {/* Group 1: Registration */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Onboarding</h3>
        {renderOption('register-client')}
      </div>
      {/* Group 2: Physical Actions */}
      <Separator />
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Specimen Collection</h3>
        <div className="grid gap-4">
          {renderOption('15-panel-instant')}
          {renderOption('collect-lab')}
        </div>
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
