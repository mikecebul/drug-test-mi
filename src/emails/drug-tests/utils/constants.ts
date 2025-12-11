/**
 * Constants for email templates
 * Colors, labels, and mappings for drug test results
 */

/**
 * Color mapping for test results
 * Used for badges, borders, and visual indicators
 */
export const RESULT_COLORS: Record<string, string> = {
  negative: '#22c55e', // green - pass
  'expected-positive': '#22c55e', // green - pass
  'confirmed-negative': '#22c55e', // green - pass
  'unexpected-negative-warning': '#eab308', // yellow - warning
  'unexpected-positive': '#ef4444', // red - fail
  'unexpected-negative-critical': '#ef4444', // red - fail
  'mixed-unexpected': '#ef4444', // red - fail
  inconclusive: '#6b7280', // gray - inconclusive
}

/**
 * Get result color with fallback
 * @param result - Result classification
 * @returns Hex color code
 */
export function getResultColor(result: string): string {
  return RESULT_COLORS[result] || '#6b7280'
}

/**
 * Display labels for test results
 */
export const RESULT_LABELS: Record<string, string> = {
  negative: 'NEGATIVE (PASS)',
  'expected-positive': 'EXPECTED POSITIVE (PASS)',
  'confirmed-negative': 'CONFIRMED NEGATIVE (PASS)',
  'unexpected-positive': 'UNEXPECTED POSITIVE (FAIL)',
  'unexpected-negative-critical': 'UNEXPECTED NEGATIVE - CRITICAL (FAIL)',
  'unexpected-negative-warning': 'UNEXPECTED NEGATIVE - WARNING',
  'mixed-unexpected': 'MIXED UNEXPECTED (FAIL)',
  inconclusive: 'INCONCLUSIVE',
}

/**
 * Get result label with fallback
 * @param result - Result classification
 * @returns Display label
 */
export function getResultLabel(result: string): string {
  return RESULT_LABELS[result] || result.toUpperCase()
}

/**
 * Test type display names
 */
export const TEST_TYPE_MAP: Record<string, string> = {
  '11-panel-lab': '11-Panel Lab Test',
  '15-panel-instant': '15-Panel Instant Test',
  '17-panel-sos-lab': '17-Panel SOS Lab Test',
  'etg-lab': 'EtG Lab Test',
}

/**
 * Substance display names
 */
export const SUBSTANCE_MAP: Record<string, string> = {
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
