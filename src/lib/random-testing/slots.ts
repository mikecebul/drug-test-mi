export const RANDOM_TESTING_SLOT_MINUTES = 10
export const DEFAULT_RANDOM_TESTING_WEEKDAY_WINDOW = {
  start: '18:00',
  end: '19:00',
} as const
export const DEFAULT_RANDOM_TESTING_WEEKEND_WINDOW = {
  start: '10:50',
  end: '11:30',
} as const

function timeToMinutes(value: string): number {
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) throw new Error(`Invalid random-testing time: ${value}`)

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`Invalid random-testing time: ${value}`)

  return hours * 60 + minutes
}

function minutesToTime(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`
}

export function getRandomTestingSlotCapacity(): number {
  const weekdayCapacity = Math.floor(
    (timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKDAY_WINDOW.end) -
      timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKDAY_WINDOW.start)) /
      RANDOM_TESTING_SLOT_MINUTES,
  )
  const weekendCapacity = Math.floor(
    (timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKEND_WINDOW.end) -
      timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKEND_WINDOW.start)) /
      RANDOM_TESTING_SLOT_MINUTES,
  )

  return Math.min(weekdayCapacity, weekendCapacity)
}

export function findEarliestRandomTestingSlot(usedSlotIndexes: number[]): number {
  const used = new Set(usedSlotIndexes.filter((value) => Number.isInteger(value) && value >= 0))
  const capacity = getRandomTestingSlotCapacity()

  for (let index = 0; index < capacity; index += 1) {
    if (!used.has(index)) return index
  }

  throw new Error(
    `All ${capacity} random-testing slots are assigned. Expand the weekend availability before adding another tester.`,
  )
}

export function getRandomTestingAssignedTimes(slotIndex: number): {
  weekday: string
  weekend: string
} {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= getRandomTestingSlotCapacity()) {
    throw new Error(`Invalid random-testing slot index: ${slotIndex}`)
  }

  const offset = slotIndex * RANDOM_TESTING_SLOT_MINUTES
  return {
    weekday: minutesToTime(timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKDAY_WINDOW.start) + offset),
    weekend: minutesToTime(timeToMinutes(DEFAULT_RANDOM_TESTING_WEEKEND_WINDOW.start) + offset),
  }
}

export function formatRandomTestingTime(value: string | null | undefined): string {
  if (!value) return ''
  const minutes = timeToMinutes(value)
  const hours = Math.floor(minutes / 60)
  const minute = minutes % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}
