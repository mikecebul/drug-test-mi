import type { FieldHook } from 'payload'
import { normalizeEditorUrl } from '@/utilities/normalizeEditorUrl'

type CreateNormalizeEditorUrlHookOptions = {
  allowRelative?: boolean
  errorMessage?: string
}

export const createNormalizeEditorUrlHook = ({
  allowRelative = true,
  errorMessage = 'Enter a valid URL.',
}: CreateNormalizeEditorUrlHookOptions = {}): FieldHook => {
  return ({ operation, value }) => {
    if (operation !== 'create' && operation !== 'update') return value
    if (typeof value !== 'string') return value

    const normalizedValue = normalizeEditorUrl(value, { allowRelative })

    if (normalizedValue === null) {
      throw new Error(errorMessage)
    }

    return normalizedValue
  }
}

export const normalizeEditorUrlHook = createNormalizeEditorUrlHook()
