export function getFirstGroupError(error: unknown): string | undefined {
  if (!error) return undefined

  if (typeof error === 'string') return error

  if (Array.isArray(error)) {
    for (const item of error) {
      const message = getFirstGroupError(item)
      if (message) return message
    }
    return undefined
  }

  if (typeof error === 'object') {
    const errorRecord = error as { group?: unknown; fields?: Record<string, unknown> }
    const groupMessage = getFirstGroupError(errorRecord.group)
    if (groupMessage) return groupMessage

    if (errorRecord.fields) {
      for (const fieldError of Object.values(errorRecord.fields)) {
        const message = getFirstGroupError(fieldError)
        if (message) return message
      }
    }

    for (const value of Object.values(error)) {
      const message = getFirstGroupError(value)
      if (message) return message
    }
  }

  return undefined
}
