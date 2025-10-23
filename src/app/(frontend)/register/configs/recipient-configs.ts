import type { EmployerConfig, CourtConfig } from '../types/recipient-types'

/**
 * Employer configuration with pre-configured recipients
 *
 * FUTURE MIGRATION: These configurations should eventually be moved to a PayloadCMS collection
 * (e.g., 'EmployerPresets') to allow admin management without code changes.
 *
 * Current approach (hardcoded):
 * - Quick to implement and maintain for small lists
 * - Changes require code deployment
 * - Email addresses are visible in client bundle
 *
 * For now, this is acceptable for the limited number of employers.
 */
export const EMPLOYER_CONFIGS = {
  'lcems': {
    label: 'LCEMS (Lake Charlevoix EMS)',
    recipients: [
      { name: 'Melanie Kroll', email: 'melaniek@lcemsami.gov' },
    ],
  },
  'other': {
    label: 'Other',
    recipients: [],
  },
} as const satisfies Record<string, EmployerConfig>

export type EmployerType = keyof typeof EMPLOYER_CONFIGS

/**
 * Type guard to validate employer type at runtime
 */
export function isValidEmployerType(value: unknown): value is EmployerType {
  return typeof value === 'string' && value in EMPLOYER_CONFIGS
}

/**
 * Court configuration with pre-configured recipients
 *
 * FUTURE MIGRATION: Move to PayloadCMS collection for admin management.
 *
 * Note: Charlevoix Circuit Court has been split into two separate options
 * (one for each probation officer) to simplify the UI and keep structure consistent.
 *
 * For now, hardcoded configs work for the limited number of courts.
 */
export const COURT_CONFIGS = {
  'charlevoix-district': {
    label: 'Charlevoix District',
    recipients: [
      { name: 'Maria Shrift', email: 'shriftm@charlevoixcounty.org' },
      { name: 'Zach Shepard', email: 'shepardz@charlevoixcounty.org' },
    ],
  },
  'charlevoix-circuit-stoner': {
    label: 'Charlevoix Circuit Court (Patrick Stoner)',
    recipients: [
      { name: 'Patrick Stoner', email: 'stonerp@michigan.gov' },
    ],
  },
  'charlevoix-circuit-hofbauer': {
    label: 'Charlevoix Circuit Court (Derek Hofbauer)',
    recipients: [
      { name: 'Derek Hofbauer', email: 'hofbauerd1@michigan.gov' },
    ],
  },
  'charlevoix-circuit-bond': {
    label: 'Charlevoix Circuit Bond',
    recipients: [
      { name: 'Assignment Clerk', email: 'petersa@charlevoixcounty.org'}
    ],
  },
  'charlevoix-drug-court': {
    label: 'Charlevoix Drug Court',
    recipients: [
      { name: 'Kerry Zahner', email: 'zahnerk2@charlevoixcounty.org' },
      { name: 'Patrick Stoner', email: 'stonerp@michigan.gov' },
      { name: 'Scott Kelly', email: 'scott@basesmi.org' },
    ],
  },
  'emmet-district': {
    label: 'Emmet District',
    recipients: [
      { name: 'Olivia Tackett', email: 'otackett@emmetcounty.org' },
      { name: 'Heather McCreery', email: 'hmccreery@emmetcounty.org' },
    ],
  },
  'otsego-district': {
    label: 'Otsego District',
    recipients: [
      { name: 'Otsego Probation', email: 'otcprobation@otsegocountymi.gov' },
    ],
  },
  'other': {
    label: 'Other',
    recipients: [],
  },
} as const satisfies Record<string, CourtConfig>

export type CourtType = keyof typeof COURT_CONFIGS

/**
 * Type guard to validate court type at runtime
 */
export function isValidCourtType(value: unknown): value is CourtType {
  return typeof value === 'string' && value in COURT_CONFIGS
}
