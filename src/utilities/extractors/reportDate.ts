import { TZDate } from '@date-fns/tz'

export function validReportDate(text: string): boolean {
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return false
  const [month, day, year] = match.slice(1).map(Number),
    value = new Date(Date.UTC(year, month - 1, day))
  return (
    year >= 1900 &&
    year <= 2100 &&
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  )
}
export function parseReportCollectionTime(text: string): Date | null {
  const match = text.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match || !validReportDate(match[1])) return null
  const [month, day, year] = match[1].split('/').map(Number),
    hour = Number(match[2]),
    minutes = Number(match[3])
  if (hour < 1 || hour > 12 || minutes > 59) return null
  const hours = (hour % 12) + (match[4].toUpperCase() === 'PM' ? 12 : 0),
    value = new TZDate(year, month - 1, day, hours, minutes, 0, 'America/New_York')
  if (value.getHours() !== hours || value.getDate() !== day) return null
  for (const delta of [-3600000, 3600000]) {
    const other = new TZDate(value.getTime() + delta, 'America/New_York')
    if (
      other.getFullYear() === year &&
      other.getMonth() === month - 1 &&
      other.getDate() === day &&
      other.getHours() === hours &&
      other.getMinutes() === minutes
    )
      return null
  }
  return value
}
