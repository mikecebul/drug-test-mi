import type { PositionedTextLine } from './pdfText'
import { extractReportTableRows, reportBodyLines } from './reportLayout'
import { parseLabMeasurement } from './labConfirmation'
export type SpecimenValidityStatus = 'dilute' | 'not-dilute' | 'unreported' | 'unverified'

export function parseCreatinineResult(lines: PositionedTextLine[], rows = extractReportTableRows(lines)) {
  for (const row of rows) {
    if (!/^Colorimetric$/i.test(row.method) || !/^Creatinine$/i.test(row.label)) continue
    const value = parseLabMeasurement(row.resultText)
    if (!value || value.unit !== 'mg/dl') return null
    const isDilute =
      value.comparator === '='
        ? value.value < 20
        : (value.comparator === '<' && value.value <= 20) || (value.comparator === '<=' && value.value < 20)
          ? true
          : (value.comparator === '>' || value.comparator === '>=') && value.value >= 20
            ? false
            : null
    return { valueMgDl: value.value, isDilute }
  }
  return null
}

export function readReportValidity(lines: PositionedTextLine[], rows = extractReportTableRows(lines)) {
  const data = reportBodyLines(lines)
    .map((line) => line.text)
    .filter((text) => /\bdilute\b/i.test(text))
  const normal = data.some((text) => /\bnot dilute\b|\b(?:dilute|specimen is dilute)\s*:\s*(?:no|false)\b/i.test(text))
  const dilute = data.some(
    (text) =>
      !/\bnot dilute\b|\b(?:dilute|specimen is dilute)\s*:\s*(?:no|false)\b/i.test(text) &&
      /\b(?:specimen is dilute|dilute specimen|dilute\s*:\s*(?:yes|true))\b/i.test(text),
  )
  const creatinine = parseCreatinineResult(lines, rows),
    hasCreatinine = rows.some((row) => /^Creatinine$/i.test(row.label))
  const warnings: string[] = []
  if (hasCreatinine && (creatinine === null || creatinine.isDilute === null))
    warnings.push('The creatinine result could not determine specimen validity; verify dilution manually.')
  if ((normal && dilute) || (normal && creatinine?.isDilute === true) || (dilute && creatinine?.isDilute === false))
    warnings.push('Conflicting specimen-validity results; verify dilution manually.')
  const status: SpecimenValidityStatus = warnings.length
    ? 'unverified'
    : dilute || creatinine?.isDilute === true
      ? 'dilute'
      : normal || creatinine?.isDilute === false
        ? 'not-dilute'
        : 'unreported'
  return { isDilute: dilute || creatinine?.isDilute === true, status, creatinine, warnings }
}
