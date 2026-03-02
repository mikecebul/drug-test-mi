export async function runDbOp<T>(command: string, payload?: unknown): Promise<T> {
  const { executeDbOp } = await import('./db-ops')
  return (await executeDbOp(command, payload)) as T
}
