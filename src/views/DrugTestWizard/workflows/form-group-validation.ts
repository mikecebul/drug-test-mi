import { z } from 'zod'

type GroupValidationError = {
  group?: string
  fields?: Record<string, string>
}

export function zodErrorToGroupError(error: z.ZodError, stripPathPrefix?: string): GroupValidationError {
  const fields: Record<string, string> = {}
  let group: string | undefined

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    const relativePath =
      stripPathPrefix && path === stripPathPrefix
        ? ''
        : stripPathPrefix && path.startsWith(`${stripPathPrefix}.`)
          ? path.slice(stripPathPrefix.length + 1)
          : path

    if (!relativePath) {
      group ||= issue.message
      continue
    }

    fields[relativePath] ||= issue.message
  }

  return {
    ...(group ? { group } : {}),
    ...(Object.keys(fields).length ? { fields } : {}),
  }
}

export function createZodGroupValidator<TValue>(schema: z.ZodType<TValue>) {
  return ({ value }: { value: TValue }) => {
    const result = schema.safeParse(value)
    return result.success ? undefined : zodErrorToGroupError(result.error)
  }
}

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
