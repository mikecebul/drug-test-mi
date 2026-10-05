export type ConfirmationResult = 'confirmed-positive' | 'confirmed-negative' | 'inconclusive'
export interface LabMeasurement {
  value: number
  comparator: '=' | '<' | '<=' | '>' | '>='
  unit: string
  text: string
}

export function parseLabMeasurement(text: string): LabMeasurement | null {
  const match = text.trim().match(/^([<>≤≥]=?)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*((?:[nuµμm]?g)\s*\/\s*(?:mL|dL|L))?$/i)
  if (!match) return null
  const value = Number(match[2].replaceAll(',', ''))
  if (!Number.isFinite(value)) return null
  const comparator = (match[1]?.replace('≤', '<=').replace('≥', '>=') ?? '=') as LabMeasurement['comparator']
  return {
    value,
    comparator,
    unit: (match[3] ?? '').replace(/\s/g, '').replace(/[µμ]/g, 'u').toLowerCase(),
    text: text.trim(),
  }
}

const massUnit: Record<string, number> = {
  'ng/ml': 1,
  'ug/ml': 1000,
  'mg/ml': 1000000,
  'ng/l': 0.001,
  'ug/l': 1,
  'mg/l': 1000,
  'mg/dl': 10000,
  'g/dl': 10000000,
}

/** Use the laboratory's stated classification, or compare a measurement with its own cutoff. */
export function interpretConfirmation(resultText: string, cutoffText: string): ConfirmationResult | null {
  if (/\b(?:not positive|pending|not performed|not tested)\b/i.test(resultText)) return null
  const positive = /\b(?:confirmed\s+)?positive\b/i.test(resultText)
  const negative = /\bnegative\b|\bnot detected\b/i.test(resultText)
  if (positive && negative) return null
  if (/\binconclusive\b|\binvalid\b|\binsufficient\b|\bunable\b|\bcancel(?:l)?ed\b/i.test(resultText))
    return 'inconclusive'
  if (positive) return 'confirmed-positive'
  if (negative) return 'confirmed-negative'
  const value = parseLabMeasurement(resultText),
    cutoff = parseLabMeasurement(cutoffText)
  if (!value || !cutoff || cutoff.comparator !== '=' || cutoff.value <= 0 || !value.unit || !cutoff.unit) return null
  let measured = value.value,
    threshold = cutoff.value
  if (value.unit !== cutoff.unit) {
    if (!massUnit[value.unit] || !massUnit[cutoff.unit]) return null
    measured *= massUnit[value.unit]
    threshold *= massUnit[cutoff.unit]
  }
  if (value.comparator === '=') return measured >= threshold ? 'confirmed-positive' : 'confirmed-negative'
  if ((value.comparator === '<' && measured <= threshold) || (value.comparator === '<=' && measured < threshold))
    return 'confirmed-negative'
  if ((value.comparator === '>' || value.comparator === '>=') && measured >= threshold) return 'confirmed-positive'
  return null
}
