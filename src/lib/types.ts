export type GenderPreference = 'any' | 'male' | 'female'
export type TimePreference = 'any' | 'morning' | 'evening'
export type DayPreference = 'any' | 'weekday' | 'weekend'

export interface Tester {
  id: string
  name: string
  gender: 'male' | 'female'
  photo_url?: string
  availableTime: ('morning' | 'evening')[]
  availableDays: ('weekday' | 'weekend')[]
}