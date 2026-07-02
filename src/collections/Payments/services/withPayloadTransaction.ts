import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

export async function withPayloadTransaction<T>(
  payload: Payload,
  operation: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const req = await createLocalReq({}, payload)
  const startedTransaction = await initTransaction(req)

  try {
    const result = await operation(req)

    if (startedTransaction) {
      await commitTransaction(req)
    }

    return result
  } catch (error) {
    if (startedTransaction) {
      await killTransaction(req)
    }

    throw error
  }
}
