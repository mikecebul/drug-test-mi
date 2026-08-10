export type ClientSearchMatchType = 'exact' | 'partial' | 'fuzzy'

export type ClientSearchMatchReason = 'email' | 'phone' | 'date-of-birth' | 'name' | 'recent'

export interface ClientSearchInput {
  query?: string
  name?: string
  email?: string
  phone?: string
  dob?: string
  recent?: boolean
  limit?: number
}

export interface ClientSearchResult {
  id: string
  firstName: string
  middleInitial?: string
  lastName: string
  fullName: string
  initials: string
  email: string
  dob?: string
  phone?: string
  gender?: 'male' | 'female' | 'prefer-not-to-say'
  headshot?: string
  headshotId?: string
  updatedAt?: string
  matchType: ClientSearchMatchType
  matchReason: ClientSearchMatchReason
  score?: number
}

export interface ClientSearchResponse {
  exactMatches: ClientSearchResult[]
  possibleMatches: ClientSearchResult[]
}

export interface ClientSearchFields {
  searchFirstName: string
  searchMiddleInitial: string
  searchLastName: string
  searchFullName: string
  searchEmail: string
  searchPhone: string
  searchDob: string
}
