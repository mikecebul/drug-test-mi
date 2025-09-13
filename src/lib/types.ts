export type GenderPreference = "any" | "male" | "female"
export type TimePreference = "any" | "morning" | "evening"
export type DayPreference = "any" | "weekday" | "weekend"

export interface TesterWithAvailability {
  id: string
  name: string
  gender: "male" | "female"
  bio: string
  photo_url?: string
  cal_com_username: string
  location: string
  availability: {
    mornings: boolean
    evenings: boolean
    weekdays: boolean
    weekends: boolean
  }
}