type TimeoutOptions = {
  onTimeout?: () => void
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  options: TimeoutOptions = {},
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(message))

          try {
            options.onTimeout?.()
          } catch {
            // The timeout remains the primary failure even if cleanup fails.
          }
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
