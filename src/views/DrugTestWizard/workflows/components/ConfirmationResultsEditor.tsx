'use client'

import { ReportLink } from '../../components/ReportLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import type { ConfirmationReviewRow } from './confirmation-review'

const options = allSubstanceOptions.filter((option) => option.value !== 'none')
const results = [
  { value: 'confirmed-negative', label: 'Confirmed Negative' },
  { value: 'confirmed-positive', label: 'Confirmed Positive' },
  { value: 'inconclusive', label: 'Inconclusive' },
]
export function ConfirmationResultsEditor({
  rows,
  file,
  required = [],
  onChange,
  errors = [],
}: {
  rows: ConfirmationReviewRow[]
  file?: File | null
  required?: string[]
  onChange: (rows: ConfirmationReviewRow[]) => void
  errors?: Parameters<typeof FieldError>[0]['errors']
}) {
  const change = (index: number, patch: Partial<ConfirmationReviewRow>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)))
  return (
    <Card data-testid="confirmation-results-editor">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Confirmation results</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { substance: '', result: '', notes: '' }])}
        >
          <Plus className="mr-2 size-4" />
          Add Result
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {file && <ReportLink file={file} />}
        {rows.map((row, index) => (
          <div key={index} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-2">
              {!row.result && <Badge variant="warning">Check PDF</Badge>}
              {!!row.sourceLabels?.length && <span className="text-sm">{row.sourceLabels.join(', ')}</span>}
              {!row.sourceLabels?.length && !required.includes(row.substance) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove confirmation result"
                  onClick={() => onChange(rows.filter((_, at) => at !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`substance-${index}`}>Substance</FieldLabel>
                <Select
                  items={options}
                  value={row.substance}
                  onValueChange={(value) => change(index, { substance: value ?? '' })}
                >
                  <SelectTrigger id={`substance-${index}`} aria-invalid={!!errors?.length && !row.substance}>
                    <SelectValue placeholder="Select substance…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`result-${index}`}>Confirmation Result</FieldLabel>
                <Select
                  items={results}
                  value={row.result}
                  onValueChange={(value) => change(index, { result: (value ?? '') as ConfirmationReviewRow['result'] })}
                >
                  <SelectTrigger id={`result-${index}`} aria-invalid={!!errors?.length && !row.result}>
                    <SelectValue placeholder="Select result…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {results.map((result) => (
                        <SelectItem key={result.value} value={result.value}>
                          {result.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <details>
              <summary className="text-muted-foreground cursor-pointer text-sm">Notes</summary>
              <Textarea
                className="mt-2"
                aria-label={`Confirmation notes ${index + 1}`}
                value={row.notes ?? ''}
                onChange={(event) => change(index, { notes: event.target.value })}
                rows={2}
              />
            </details>
          </div>
        ))}
        <FieldError errors={errors} />
      </CardContent>
    </Card>
  )
}
