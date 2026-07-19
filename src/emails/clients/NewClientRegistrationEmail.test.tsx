import { describe, expect, it } from 'vitest'
import { buildNewClientRegistrationEmail } from '.'

describe('NewClientRegistrationEmail', () => {
  it('prominently identifies the actual referral and recipients', async () => {
    const email = await buildNewClientRegistrationEmail({
      adminUrl: 'https://example.com/admin/collections/clients/client-id',
      clientName: 'Brett Farve',
      dateOfBirth: 'October 10, 1969',
      email: 'brett@example.com',
      gender: 'Male',
      phone: '(248) 555-3434',
      recipients: [{ name: 'Jane Smith', email: 'jane@charlevoixcounty.org' }],
      referralName: 'Charlevoix County 33rd Circuit Court',
      referralType: 'Court',
      registeredAt: 'July 19, 2026 at 10:42 AM ET',
    })

    expect(email.subject).toBe('New Client Registration - Brett Farve')
    expect(email.html).toContain('COURT REFERRAL')
    expect(email.html).toContain('Charlevoix County 33rd Circuit Court')
    expect(email.html).toContain('Jane Smith ·')
    expect(email.html).toContain('jane@charlevoixcounty.org')
    expect(email.html).toContain('View client in admin')
    expect(email.html).not.toContain('background-color:#f7f8fa')
    expect(email.html).not.toContain('[object Object]')
  })
})
