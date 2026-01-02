/**
 * Utility functions for formatting data in email templates
 */

import { formatCollectionDate as formatDateUtil, formatDob as formatDobUtil } from '@/lib/date-utils'

/**
 * Format date for display in emails
 * Always displays in EST/EDT to match the PDF collection time
 * @param dateString - ISO date string in UTC
 * @returns Formatted date string in EST/EDT (e.g., "December 10, 2025, 3:45 PM EST")
 */
export function formatDate(dateString: string): string {
  return formatDateUtil(dateString)
}

/**
 * Format date of birth for display
 * @param dobString - ISO date string
 * @returns Formatted DOB (e.g., "12/10/1990")
 */
export function formatDob(dobString: string): string {
  return formatDobUtil(dobString)
}

/**
 * Format test type for display
 * @param testType - Test type key
 * @returns Human-readable test type name
 */
export function formatTestType(testType: string): string {
  const typeMap: Record<string, string> = {
    '11-panel-lab': '11-Panel Lab Test',
    '15-panel-instant': '15-Panel Instant Test',
    '17-panel-sos-lab': '17-Panel SOS Lab Test',
    'etg-lab': 'EtG Lab Test',
  }
  return typeMap[testType] || testType
}

/**
 * Format substance names for display
 * @param substance - Substance key
 * @returns Human-readable substance name
 */
export function formatSubstance(substance: string): string {
  const substanceMap: Record<string, string> = {
    '6-mam': 'Heroin (6-MAM)',
    alcohol: 'Alcohol (Current Intoxication)',
    amphetamines: 'Amphetamines',
    methamphetamines: 'Methamphetamines',
    benzodiazepines: 'Benzodiazepines',
    thc: 'THC (Marijuana)',
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
    etg: 'EtG (Past Alcohol Use)',
    synthetic_cannabinoids: 'Synthetic Cannabinoids',
    other: 'Other',
  }
  return substanceMap[substance] || substance
}
