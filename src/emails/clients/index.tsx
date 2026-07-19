import { render } from '@react-email/components'
import { NewClientRegistrationEmail, type NewClientRegistrationEmailProps } from './NewClientRegistrationEmail'

export { NewClientRegistrationEmail }
export type { NewClientRegistrationEmailProps }

export async function buildNewClientRegistrationEmail(
  data: NewClientRegistrationEmailProps,
): Promise<{ html: string; subject: string }> {
  return {
    html: await render(<NewClientRegistrationEmail {...data} />),
    subject: `New Client Registration - ${data.clientName}`,
  }
}
