'use client'

import React, { useEffect, useState } from 'react'
import { withFieldGroup } from '@/blocks/Form/hooks/form'
import { useStore } from '@tanstack/react-form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Calendar, User } from 'lucide-react'
import { z } from 'zod'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { format } from 'date-fns'
import { fetchPendingTests } from '../actions'

// Export the schema for reuse in step validation
export const selectTestFieldSchema = z.object({
  testId: z.string().min(1, 'Please select a drug test'),
  clientName: z.string(),
  testType: z.string(),
  collectionDate: z.string(),
  screeningStatus: z.string(),
})

export type SelectTestData = z.infer<typeof selectTestFieldSchema>

const defaultValues: SelectTestData = {
  testId: '',
  clientName: '',
  testType: '',
  collectionDate: '',
  screeningStatus: '',
}

interface DrugTest {
  id: string
  clientName: string
  testType: string
  collectionDate: string
  screeningStatus: string
}

export const SelectTestFieldGroup = withFieldGroup({
  defaultValues,

  props: {
    title: 'Select Drug Test',
    description: '',
    filterStatus: [] as string[],
  },

  render: function Render({ group, title, description = '', filterStatus }) {
    const [loading, setLoading] = useState(true)
    const [tests, setTests] = useState<DrugTest[]>([])
    const [error, setError] = useState<string | null>(null)

    const selectedTestId = useStore(group.store, (state) => state.values.testId)

    useEffect(() => {
      async function loadTests() {
        setLoading(true)
        setError(null)
        try {
          const pendingTests = await fetchPendingTests(filterStatus)
          setTests(pendingTests)
        } catch (err) {
          setError('Failed to load pending tests')
        } finally {
          setLoading(false)
        }
      }

      loadTests()
    }, [filterStatus])

    const handleTestSelect = (testId: string) => {
      const test = tests.find((t) => t.id === testId)
      if (test) {
        group.setFieldValue('testId', test.id)
        group.setFieldValue('clientName', test.clientName)
        group.setFieldValue('testType', test.testType)
        group.setFieldValue('collectionDate', test.collectionDate)
        group.setFieldValue('screeningStatus', test.screeningStatus)
      }
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-2">{description}</p>}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && tests.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No pending drug tests found. Please collect a specimen first.
            </AlertDescription>
          </Alert>
        )}

        {!loading && !error && tests.length > 0 && (
          <group.Field name="testId">
            {(field) => (
              <div className="space-y-4">
                <RadioGroup value={selectedTestId} onValueChange={handleTestSelect}>
                  <div className="space-y-3">
                    {tests.map((test) => {
                      const isSelected = selectedTestId === test.id
                      const collectionDate = new Date(test.collectionDate)

                      return (
                        <Card
                          key={test.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            isSelected ? 'border-primary border-2 bg-accent/50' : ''
                          }`}
                          onClick={() => handleTestSelect(test.id)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <RadioGroupItem
                                  value={test.id}
                                  id={test.id}
                                  className="mt-1"
                                />
                                <div className="space-y-1">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {test.clientName}
                                  </CardTitle>
                                  <CardDescription className="flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    {format(collectionDate, 'PPp')}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Badge variant="outline">{test.testType}</Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {test.screeningStatus}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      )
                    })}
                  </div>
                </RadioGroup>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-destructive text-sm">{field.state.meta.errors[0]}</p>
                )}
              </div>
            )}
          </group.Field>
        )}
      </div>
    )
  },
})
