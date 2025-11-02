/**
 * Substance mapping utilities for drug testing
 *
 * This module provides standardized substance name mappings and formatting
 * used across the application for consistency in displaying test results.
 */

/**
 * Map of substance codes to their display names
 *
 * Used for formatting test results in emails, dashboard, and reports.
 * Provides a single source of truth for substance naming conventions.
 */
export const SUBSTANCE_MAP: Record<string, string> = {
  '6-mam': '6-MAM (Heroin)',
  amphetamines: 'Amphetamines',
  methamphetamines: 'Methamphetamines',
  benzodiazepines: 'Benzodiazepines',
  thc: 'THC',
  opiates: 'Opiates',
  oxycodone: 'Oxycodone',
  cocaine: 'Cocaine',
  pcp: 'PCP',
  barbiturates: 'Barbiturates',
  methadone: 'Methadone',
  propoxyphene: 'Propoxyphene',
  tricyclic_antidepressants: 'Tricyclic Antidepressants',
  mdma: 'MDMA (Ecstasy)',
  buprenorphine: 'Buprenorphine',
  tramadol: 'Tramadol',
  fentanyl: 'Fentanyl',
  kratom: 'Kratom',
  etg: 'EtG (Alcohol)',
  synthetic_cannabinoids: 'Synthetic Cannabinoids',
  other: 'Other',
} as const

/**
 * Simplified substance map (without technical details)
 * Used in contexts where shorter names are preferred
 */
export const SUBSTANCE_MAP_SIMPLE: Record<string, string> = {
  '6-mam': 'Heroin',
  amphetamines: 'Amphetamines',
  methamphetamines: 'Methamphetamines',
  benzodiazepines: 'Benzodiazepines',
  thc: 'THC',
  opiates: 'Opiates',
  oxycodone: 'Oxycodone',
  cocaine: 'Cocaine',
  pcp: 'PCP',
  barbiturates: 'Barbiturates',
  methadone: 'Methadone',
  propoxyphene: 'Propoxyphene',
  tricyclic_antidepressants: 'Tricyclic Antidepressants',
  mdma: 'MDMA (Ecstasy)',
  buprenorphine: 'Buprenorphine',
  tramadol: 'Tramadol',
  fentanyl: 'Fentanyl',
  kratom: 'Kratom',
  etg: 'EtG (Alcohol)',
  synthetic_cannabinoids: 'Synthetic Cannabinoids',
  other: 'Other',
} as const

/**
 * Format a substance code to its display name
 *
 * @param substanceCode - The substance code (e.g., 'thc', 'benzodiazepines')
 * @param simple - Whether to use simplified names (default: false)
 * @returns The formatted display name, or the original code if not found
 *
 * @example
 * formatSubstance('thc') // 'THC'
 * formatSubstance('6-mam') // '6-MAM (Heroin)'
 * formatSubstance('6-mam', true) // 'Heroin'
 */
export function formatSubstance(substanceCode: string, simple = false): string {
  const map = simple ? SUBSTANCE_MAP_SIMPLE : SUBSTANCE_MAP
  return map[substanceCode] || substanceCode
}

/**
 * Format an array of substance codes to their display names
 *
 * @param substanceCodes - Array of substance codes
 * @param simple - Whether to use simplified names (default: false)
 * @returns Array of formatted display names
 *
 * @example
 * formatSubstances(['thc', 'cocaine']) // ['THC', 'Cocaine']
 */
export function formatSubstances(substanceCodes: string[], simple = false): string[] {
  return substanceCodes.map((code) => formatSubstance(code, simple))
}
