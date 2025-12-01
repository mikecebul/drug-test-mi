/**
 * Substance Options for Drug Tests
 *
 * Defines the substances that can be detected in different drug test panels.
 * These are used across multiple collections for consistency.
 */

export type SubstanceValue =
  | 'amphetamines'
  | 'methamphetamines'
  | 'benzodiazepines'
  | 'thc'
  | 'opiates'
  | 'oxycodone'
  | 'cocaine'
  | 'pcp'
  | 'barbiturates'
  | 'methadone'
  | 'propoxyphene'
  | 'tricyclic_antidepressants'
  | 'mdma'
  | 'buprenorphine'
  | 'tramadol'
  | 'fentanyl'
  | 'kratom'
  | '6-mam'
  | 'etg'
  | 'alcohol'
  | 'synthetic_cannabinoids'

/**
 * 15-Panel Instant Test Substances
 * Tests performed on-site with instant results
 */
export const panel15InstantSubstances = [
  { label: '6-MAM (Heroin)', value: '6-mam' },
  { label: 'Amphetamines', value: 'amphetamines' },
  { label: 'Benzodiazepines', value: 'benzodiazepines' },
  { label: 'Buprenorphine', value: 'buprenorphine' },
  { label: 'Cocaine', value: 'cocaine' },
  { label: 'EtG (Alcohol)', value: 'etg' },
  { label: 'Fentanyl', value: 'fentanyl' },
  { label: 'MDMA (Ecstasy)', value: 'mdma' },
  { label: 'Methadone', value: 'methadone' },
  { label: 'Methamphetamine', value: 'methamphetamines' },
  { label: 'Opiates', value: 'opiates' },
  { label: 'Oxycodone', value: 'oxycodone' },
  { label: 'Synthetic Cannabinoids', value: 'synthetic_cannabinoids' },
  { label: 'THC (Marijuana)', value: 'thc' },
  { label: 'Tramadol', value: 'tramadol' },
] as const

/**
 * 11-Panel Lab Test Substances
 * Tests sent to lab for confirmation
 * AMP, BUP, BZO, COC, CR, ETG, FEN, MIT, MTD, OPI, THC
 */
export const panel11LabSubstances = [
  { label: 'Amphetamines (AMP)', value: 'amphetamines' },
  { label: 'Benzodiazepines (BZO)', value: 'benzodiazepines' },
  { label: 'Buprenorphine (BUP)', value: 'buprenorphine' },
  { label: 'Cocaine (COC)', value: 'cocaine' },
  { label: 'EtG (ETG)', value: 'etg' },
  { label: 'Fentanyl (FEN)', value: 'fentanyl' },
  { label: 'Kratom (MIT)', value: 'kratom' },
  { label: 'Methadone (MTD)', value: 'methadone' },
  { label: 'Opiates (OPI)', value: 'opiates' },
  { label: 'THC (THC)', value: 'thc' },
] as const

/**
 * 17-Panel SOS Lab Test Substances
 * Comprehensive lab test including alcohol, common drugs, and prescription medications
 * B306 - Urine 17 Panel
 * NOTE: This test includes Alcohol (Ethanol) which detects current intoxication,
 * not EtG which detects past alcohol use (24-48 hours)
 */
export const panel17SosLabSubstances = [
  { label: 'Alcohol (Ethanol)', value: 'alcohol' },
  { label: 'Amphetamines', value: 'amphetamines' },
  { label: 'Barbiturates', value: 'barbiturates' },
  { label: 'Benzodiazepines', value: 'benzodiazepines' },
  { label: 'Buprenorphine', value: 'buprenorphine' },
  { label: 'Cocaine', value: 'cocaine' },
  { label: 'MDMA (Ecstasy)', value: 'mdma' },
  { label: 'Methadone', value: 'methadone' },
  { label: 'Opiates', value: 'opiates' },
  { label: 'Oxycodone', value: 'oxycodone' },
  { label: 'PCP', value: 'pcp' },
  { label: 'Propoxyphene', value: 'propoxyphene' },
  { label: 'THC (Marijuana)', value: 'thc' },
  { label: 'Tricyclic Antidepressants', value: 'tricyclic_antidepressants' },
] as const

/**
 * EtG Lab Test Substances
 * Single-panel test for alcohol metabolite
 * Sent to lab for confirmation
 */
export const etgLabSubstances = [
  { label: 'EtG (Alcohol)', value: 'etg' },
] as const

/**
 * All possible substances (union of all test types)
 * Used for medication "detectedAs" field
 */
export const allSubstanceOptions = [
  { label: '6-MAM (Heroin)', value: '6-mam' },
  { label: 'Alcohol (Ethanol - Current)', value: 'alcohol' },
  { label: 'Amphetamines', value: 'amphetamines' },
  { label: 'Barbiturates', value: 'barbiturates' },
  { label: 'Benzodiazepines', value: 'benzodiazepines' },
  { label: 'Buprenorphine', value: 'buprenorphine' },
  { label: 'Cocaine', value: 'cocaine' },
  { label: 'EtG (Alcohol - Past 24-48hrs)', value: 'etg' },
  { label: 'Fentanyl', value: 'fentanyl' },
  { label: 'Kratom', value: 'kratom' },
  { label: 'MDMA (Ecstasy)', value: 'mdma' },
  { label: 'Methadone', value: 'methadone' },
  { label: 'Methamphetamine', value: 'methamphetamines' },
  { label: 'Opiates', value: 'opiates' },
  { label: 'Oxycodone', value: 'oxycodone' },
  { label: 'PCP', value: 'pcp' },
  { label: 'Propoxyphene', value: 'propoxyphene' },
  { label: 'Synthetic Cannabinoids', value: 'synthetic_cannabinoids' },
  { label: 'THC (Marijuana)', value: 'thc' },
  { label: 'Tramadol', value: 'tramadol' },
  { label: 'Tricyclic Antidepressants', value: 'tricyclic_antidepressants' },
  { label: 'Does Not Show', value: 'none' },
] as const

/**
 * Get substance options based on test type
 */
export function getSubstanceOptions(testType?: string) {
  switch (testType) {
    case '15-panel-instant':
      return panel15InstantSubstances
    case '11-panel-lab':
      return panel11LabSubstances
    case '17-panel-sos-lab':
      return panel17SosLabSubstances
    case 'etg-lab':
      return etgLabSubstances
    default:
      return allSubstanceOptions.filter(s => s.value !== 'none')
  }
}
