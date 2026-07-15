const PDF_DASH_PATTERN = String.raw`[\p{Pd}\u00AD\u2212]`

export const NAME_PART_PATTERN = String.raw`\p{L}+(?:['’]\p{L}+|\s*${PDF_DASH_PATTERN}\s*\p{L}+)*`
export const FULL_NAME_PATTERN = String.raw`${NAME_PART_PATTERN}(?:\s+\p{L}\.?)?\s+${NAME_PART_PATTERN}`

export const ALL_CAPS_NAME_PART_PATTERN = String.raw`[A-Z]{2,}(?:['’][A-Z]{2,}|\s*${PDF_DASH_PATTERN}\s*[A-Z]{2,})*`
export const ALL_CAPS_FULL_NAME_PATTERN = String.raw`${ALL_CAPS_NAME_PART_PATTERN}(?:\s+[A-Z]\.?)?\s+${ALL_CAPS_NAME_PART_PATTERN}`

const PDF_DASH_REGEX = new RegExp(String.raw`\s*${PDF_DASH_PATTERN}\s*`, 'gu')

export function normalizeExtractedDonorName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(PDF_DASH_REGEX, '-')
}
