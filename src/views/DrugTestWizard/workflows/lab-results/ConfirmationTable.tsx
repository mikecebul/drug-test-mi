'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldError } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { allSubstanceOptions } from '@/fields/substanceOptions'
import { formatSubstance } from '@/lib/substances'
import type { ParsedPDFData } from '../../types'
import type { ConfirmationReviewRow } from '../components/confirmation-review'
import { OptionalDetails } from '../../components/OptionalDetails'

const subjects = allSubstanceOptions.filter((option) => option.value !== 'none')
const choices = [
  { label: 'Confirmed Negative', value: 'confirmed-negative' },
  { label: 'Confirmed Positive', value: 'confirmed-positive' },
  { label: 'Inconclusive', value: 'inconclusive' },
]
export function ConfirmationTable({
  rows,
  report,
  expected,
  required,
  onChange,
  errors = [],
}: {
  rows: ConfirmationReviewRow[]
  report?: ParsedPDFData
  expected: string[]
  required: string[]
  onChange: (rows: ConfirmationReviewRow[]) => void
  errors?: Parameters<typeof FieldError>[0]['errors']
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<ConfirmationReviewRow>({ substance: '', result: '' })
  const edit = (index: number) => {
    setDraft({ ...rows[index] })
    setEditing(index)
  }
  const save = () => {
    if (editing === null || !draft.substance || !draft.result) return
    onChange(rows.map((row, index) => (index === editing ? { ...draft, sourceLabels: row.sourceLabels } : row)))
    setEditing(null)
  }
  return (
    <div className="flex flex-col gap-4" data-testid="confirmation-results-editor">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Substance</TableHead>
            <TableHead>Confirmation</TableHead>
            <TableHead>Measured</TableHead>
            <TableHead>
              <span className="sr-only">Review</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const analytes =
              report?.confirmationAnalytes?.filter((analyte) => analyte.substance === row.substance) ?? []
            const label = row.substance
              ? formatSubstance(row.substance)
              : row.sourceLabels?.join(', ') || 'Select substance'
            const positive = row.result === 'confirmed-positive'
            const knownExpected = positive && expected.includes(row.substance)
            const variant =
              !row.result || row.result === 'inconclusive'
                ? 'warning'
                : positive && !knownExpected
                  ? 'destructive'
                  : 'success'
            const outcome = !row.result
              ? 'Check result'
              : knownExpected
                ? 'Expected'
                : positive
                  ? 'Positive'
                  : row.result === 'inconclusive'
                    ? 'Inconclusive'
                    : 'Negative'
            return (
              <TableRow key={index} data-testid={`confirmation-row-${index}`}>
                <TableCell>
                  <span className="font-medium">{label}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={variant}>{outcome}</Badge>
                </TableCell>
                <TableCell>
                  {analytes.length > 1
                    ? `${analytes.length} analytes`
                    : analytes[0]?.measured?.text || (row.result ? '—' : 'Not read')}
                  {!!analytes.length && (
                    <details className="mt-2">
                      <summary className="text-muted-foreground cursor-pointer text-sm">Analytes</summary>
                      <ul className="flex flex-col gap-2 py-2">
                        {analytes.map((analyte, at) => (
                          <li key={at} className="text-sm">
                            {analyte.analyte}: {analyte.measured?.text || analyte.resultText || 'Not read'}
                            {analyte.cutoff ? ` · Cutoff ${analyte.cutoff.text}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant={row.result ? 'ghost' : 'outline'}
                    size="sm"
                    data-testid={`confirmation-review-${index}`}
                    onClick={() => edit(index)}
                  >
                    {row.result ? 'Edit' : 'Review'}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <FieldError errors={errors} />
      <OptionalDetails title="Edit confirmation details">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft({ substance: '', result: '', notes: '' })
            setEditing(rows.length)
          }}
        >
          Add result
        </Button>
        {rows
          .filter((row) => !row.sourceLabels?.length && !required.includes(row.substance))
          .map((row) => (
            <Button
              key={row.substance}
              type="button"
              variant="ghost"
              onClick={() => onChange(rows.filter((candidate) => candidate !== row))}
            >
              Remove {formatSubstance(row.substance)}
            </Button>
          ))}
      </OptionalDetails>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review confirmation result</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`substance-${editing}`}>Substance</FieldLabel>
              <Select
                items={subjects}
                value={draft.substance}
                onValueChange={(value) => setDraft({ ...draft, substance: value ?? '' })}
              >
                <SelectTrigger id={`substance-${editing}`}>
                  <SelectValue placeholder="Select substance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {subjects.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`result-${editing}`}>Confirmation result</FieldLabel>
              <Select
                items={choices}
                value={draft.result}
                onValueChange={(value) =>
                  setDraft({ ...draft, result: (value ?? '') as ConfirmationReviewRow['result'] })
                }
              >
                <SelectTrigger id={`result-${editing}`}>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {choices.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirmation-notes">Notes</FieldLabel>
              <Textarea
                id="confirmation-notes"
                value={draft.notes ?? ''}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!draft.substance || !draft.result}
              onClick={() => {
                if (editing === rows.length) {
                  onChange([...rows, draft])
                  setEditing(null)
                } else save()
              }}
            >
              Use result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
