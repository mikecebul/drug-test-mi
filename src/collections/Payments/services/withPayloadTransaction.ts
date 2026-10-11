import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
  type PayloadRequest,
} from 'payload'

export class PaymentTransactionsUnavailableError extends Error {
  constructor() {
    super('Account payments need a transactional database. No payment was recorded. Contact the super admin.')
    this.name = 'PaymentTransactionsUnavailableError'
  }
}

export async function withPayloadTransaction<T>(
  payload: Payload,
  operation: (req: PayloadRequest) => Promise<T>,
  options: { requireTransaction?: boolean; user?: PayloadRequest['user'] } = {},
): Promise<T> {
  const req = await createLocalReq({ user: options.user || undefined }, payload)
  const startedTransaction = await initTransaction(req)
  if (options.requireTransaction && !startedTransaction) throw new PaymentTransactionsUnavailableError()

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
