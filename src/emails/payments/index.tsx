import { render } from '@react-email/components'

import {
  PaymentReceiptEmail,
  type PaymentReceiptEmailProps,
  type PaymentReceiptType,
} from './PaymentReceiptEmail'

export { PaymentReceiptEmail }
export type { PaymentReceiptEmailProps, PaymentReceiptType }

export async function buildPaymentReceiptEmail(
  data: PaymentReceiptEmailProps,
): Promise<{ html: string; subject: string }> {
  const subjectPrefix = data.receiptType === 'partial' ? 'Partial payment receipt' : 'Payment receipt'

  return {
    html: await render(<PaymentReceiptEmail {...data} />),
    subject: `${subjectPrefix} - MI Drug Test`,
  }
}
