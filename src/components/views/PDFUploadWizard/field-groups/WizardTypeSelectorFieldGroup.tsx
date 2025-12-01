'use client'

import React from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, Beaker, ClipboardList, CheckCircle } from 'lucide-react'
import { cn } from '@/utilities/cn'
import { z } from 'zod'

export const wizardTypeSelectorFieldSchema = z.object({
  wizardType: z.enum(['15-panel-instant', 'collect-lab', 'enter-lab-screen', 'enter-lab-confirmation']),
})

export type WizardTypeSelectorData = z.infer<typeof wizardTypeSelectorFieldSchema>

export type WizardType = WizardTypeSelectorData['wizardType']

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
    id: '15-panel-instant',
    icon: Zap,
    title: 'Screen 15-Panel Instant',
    description: 'Perform an on-site 15-panel instant drug screen',
    color: 'text-orange-600',
    borderColor: 'border-orange-300 dark:border-orange-700',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
  {
    id: 'collect-lab',
    icon: Beaker,
    title: 'Collect 11-Panel, 17-Panel, or EtG Lab',
    description: 'Collect specimen for 11-panel, 17-panel, or EtG laboratory testing',
    color: 'text-blue-600',
    borderColor: 'border-blue-300 dark:border-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    id: 'enter-lab-screen',
    icon: ClipboardList,
    title: 'Enter 11-Panel, 17-Panel, or EtG Screen',
    description: 'Enter results for an 11-panel, 17-panel, or EtG screen',
    color: 'text-green-600',
    borderColor: 'border-green-300 dark:border-green-700',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    id: 'enter-lab-confirmation',
    icon: CheckCircle,
    title: 'Enter Lab Confirmation',
    description: 'Enter confirmation results for 11-panel, 17-panel, or EtG lab',
    color: 'text-indigo-600',
    borderColor: 'border-indigo-300 dark:border-indigo-700',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
  },
]

interface WizardTypeSelectorFieldGroupProps {
  form: any
  fields: string
  title: string
  description?: string
}

export function WizardTypeSelectorFieldGroup({
  form,
  fields,
  title,
  description,
}: WizardTypeSelectorFieldGroupProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-muted-foreground mt-2">{description}</p>}
      </div>

      <form.Field name={`${fields}.wizardType`}>
        {(field) => {
          const selectedType = field.state.value as WizardType | undefined

          return (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {wizardOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = selectedType === option.id

                  return (
                    <Card
                      key={option.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        isSelected ? `${option.borderColor} border-2 ${option.bgColor}` : 'border',
                      )}
                      onClick={() => field.handleChange(option.id)}
                    >
                      <CardHeader>
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                              option.bgColor,
                            )}
                          >
                            <Icon className={cn('h-6 w-6', option.color)} />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-base">{option.title}</CardTitle>
                            <CardDescription className="mt-1.5 text-sm">
                              {option.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>

              {field.state.meta.errors.length > 0 && (
                <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
              )}
            </div>
          )
        }}
      </form.Field>
    </div>
  )
}
