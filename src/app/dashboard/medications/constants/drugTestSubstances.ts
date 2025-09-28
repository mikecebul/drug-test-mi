// Common substances that appear on drug tests
export const DRUG_TEST_SUBSTANCES = [
  { label: 'Amphetamines', value: 'amphetamines' },
  { label: 'Methamphetamines', value: 'methamphetamines' },
  { label: 'Benzodiazepines', value: 'benzodiazepines' },
  { label: 'THC (Marijuana)', value: 'thc' },
  { label: 'Opiates', value: 'opiates' },
  { label: 'Oxycodone', value: 'oxycodone' },
  { label: 'Cocaine', value: 'cocaine' },
  { label: 'Phencyclidine (PCP)', value: 'pcp' },
  { label: 'Barbiturates', value: 'barbiturates' },
  { label: 'Methadone', value: 'methadone' },
  { label: 'Propoxyphene', value: 'propoxyphene' },
  { label: 'Tricyclic Antidepressants', value: 'tricyclic_antidepressants' },
  { label: 'MDMA (Ecstasy)', value: 'mdma' },
  { label: 'Buprenorphine', value: 'buprenorphine' },
  { label: 'Tramadol', value: 'tramadol' },
  { label: 'Fentanyl', value: 'fentanyl' },
  { label: 'Kratom', value: 'kratom' },
]

export type DrugTestSubstance = typeof DRUG_TEST_SUBSTANCES[number]['value']