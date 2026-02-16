const URL_SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/

type NormalizeEditorUrlOptions = {
  allowRelative?: boolean
}

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
  } catch {
    return false
  }
}

const normalizeTelUrl = (value: string) => {
  const phone = value.slice(4).trim().replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(phone)) return null
  return `tel:${phone}`
}

const normalizeMailtoUrl = (value: string) => {
  const recipient = value.slice(7).trim()
  if (recipient.length === 0 || /\s/.test(recipient)) return null
  return `mailto:${recipient}`
}

export const normalizeEditorUrl = (
  rawValue: string,
  { allowRelative = true }: NormalizeEditorUrlOptions = {},
): string | null => {
  const value = rawValue.trim()

  if (value.length === 0) return value

  if (allowRelative && (value.startsWith('/') || value.startsWith('#') || value.startsWith('?'))) {
    return value
  }

  if (value.startsWith('//')) {
    const candidate = `https:${value}`
    return isValidHttpUrl(candidate) ? candidate : null
  }

  if (URL_SCHEME.test(value)) {
    const scheme = value.slice(0, value.indexOf(':')).toLowerCase()

    if (scheme === 'http' || scheme === 'https') {
      return isValidHttpUrl(value) ? value : null
    }

    if (scheme === 'tel') return normalizeTelUrl(value)
    if (scheme === 'mailto') return normalizeMailtoUrl(value)

    return null
  }

  const candidate = `https://${value}`
  return isValidHttpUrl(candidate) ? candidate : null
}
