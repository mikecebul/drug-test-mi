import type { TesterWithAvailability, GenderPreference, TimePreference, DayPreference } from "./types"

const mockTesters: TesterWithAvailability[] = [
  {
    id: "1",
    name: "John Smith",
    gender: "male",
    bio: "Certified drug testing specialist with 5+ years of experience. Professional and discreet service.",
    photo_url: "/placeholder.svg",
    cal_com_username: "johnsmith",
    location: "charlevoix",
    availability: {
      mornings: true,
      evenings: false,
      weekdays: true,
      weekends: false,
    },
  },
  {
    id: "2",
    name: "Sarah Johnson",
    gender: "female",
    bio: "Licensed healthcare professional specializing in drug testing procedures. Available for flexible scheduling.",
    photo_url: "/placeholder.svg",
    cal_com_username: "sarahjohnson",
    location: "charlevoix",
    availability: {
      mornings: true,
      evenings: true,
      weekdays: true,
      weekends: true,
    },
  },
  {
    id: "3",
    name: "Mike Rodriguez",
    gender: "male",
    bio: "Experienced drug testing technician with evening availability. Quick and efficient service.",
    photo_url: "/placeholder.svg",
    cal_com_username: "mikerodriguez",
    location: "charlevoix",
    availability: {
      mornings: false,
      evenings: true,
      weekdays: true,
      weekends: true,
    },
  },
]

export function getAvailableTesters(
  genderPreferences: GenderPreference[],
  timePreferences: TimePreference[],
  dayPreferences: DayPreference[],
  locationPreference: string,
): TesterWithAvailability[] {
  return mockTesters.filter((tester) => {
    // Filter by gender
    const genderMatch = genderPreferences.includes("any") || genderPreferences.includes(tester.gender)
    
    // Filter by time
    const timeMatch = timePreferences.includes("any") || 
      (timePreferences.includes("morning") && tester.availability.mornings) ||
      (timePreferences.includes("evening") && tester.availability.evenings)
    
    // Filter by day
    const dayMatch = dayPreferences.includes("any") ||
      (dayPreferences.includes("weekday") && tester.availability.weekdays) ||
      (dayPreferences.includes("weekend") && tester.availability.weekends)
    
    // Filter by location
    const locationMatch = locationPreference === "any" || tester.location === locationPreference
    
    return genderMatch && timeMatch && dayMatch && locationMatch
  })
}

export function getTesterAvailabilityText(tester: TesterWithAvailability): string {
  const times = []
  if (tester.availability.mornings) times.push("mornings")
  if (tester.availability.evenings) times.push("evenings")
  
  const days = []
  if (tester.availability.weekdays) days.push("weekdays")
  if (tester.availability.weekends) days.push("weekends")
  
  const timeText = times.length > 0 ? times.join(" & ") : "flexible hours"
  const dayText = days.length > 0 ? days.join(" & ") : "any day"
  
  return `Available ${timeText} on ${dayText}`
}