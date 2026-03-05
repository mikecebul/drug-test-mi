import type { SelectFieldOption, SelectOption } from '@/blocks/Form/field-components/select-field'
import type { CourtOption } from '../types/recipient-types'

const STATIC_COURT_GROUP_PREFIXES = [
  { groupLabel: 'Charlevoix', prefix: 'charlevoix' },
  { groupLabel: 'Emmet', prefix: 'emmet' },
] as const

function toSelectOption(court: CourtOption): SelectOption {
  return {
    id: court.id,
    label: court.name,
    value: court.id,
  }
}

function sortByLabel(a: SelectOption, b: SelectOption): number {
  return a.label.localeCompare(b.label)
}

export function groupCourtSelectOptions(courts: CourtOption[]): SelectFieldOption[] {
  const grouped = new Map<string, SelectOption[]>()
  const otherCourts: SelectOption[] = []

  for (const court of courts) {
    const option = toSelectOption(court)
    const normalizedName = court.name.trim().toLowerCase()
    const staticGroup = STATIC_COURT_GROUP_PREFIXES.find((group) => normalizedName.startsWith(group.prefix))

    if (staticGroup) {
      const existing = grouped.get(staticGroup.groupLabel) || []
      existing.push(option)
      grouped.set(staticGroup.groupLabel, existing)
      continue
    }

    otherCourts.push(option)
  }

  const result: SelectFieldOption[] = []

  for (const group of STATIC_COURT_GROUP_PREFIXES) {
    const options = grouped.get(group.groupLabel)
    if (!options || options.length === 0) continue
    result.push({
      groupLabel: group.groupLabel,
      options: options.sort(sortByLabel),
    })
  }

  if (otherCourts.length > 0) {
    result.push({
      groupLabel: 'Other Courts',
      options: otherCourts.sort(sortByLabel),
    })
  }

  result.push({
    label: 'Other (Add new court)',
    value: 'other',
  })

  return result
}
