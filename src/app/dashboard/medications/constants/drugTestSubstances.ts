// Common substances that appear on drug tests
export const DRUG_TEST_SUBSTANCES = [
  { label: 'Amphetamines', value: 'amphetamines' },
  { label: 'Barbiturates', value: 'barbiturates' },
  { label: 'Benzodiazepines', value: 'benzodiazepines' },
  { label: 'Buprenorphine', value: 'buprenorphine' },
  { label: 'Cocaine', value: 'cocaine' },
  { label: 'Fentanyl', value: 'fentanyl' },
  { label: 'Kratom', value: 'kratom' },
  { label: 'MDMA (Ecstasy)', value: 'mdma' },
  { label: 'Methadone', value: 'methadone' },
  { label: 'Methamphetamines', value: 'methamphetamines' },
  { label: 'Opiates', value: 'opiates' },
  { label: 'Oxycodone', value: 'oxycodone' },
  { label: 'Phencyclidine (PCP)', value: 'pcp' },
  { label: 'Propoxyphene', value: 'propoxyphene' },
  { label: 'THC (Marijuana)', value: 'thc' },
  { label: 'Tramadol', value: 'tramadol' },
  { label: 'Tricyclic Antidepressants', value: 'tricyclic_antidepressants' },
]

export type DrugTestSubstance = typeof DRUG_TEST_SUBSTANCES[number]['value']