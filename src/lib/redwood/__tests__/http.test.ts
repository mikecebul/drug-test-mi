import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertRedwoodDonorSaveResponse,
  buildRedwoodLoginContinuationSubmission,
  buildRedwoodLoginSubmission,
  createRedwoodHttpSession,
  getRedwoodFormEntry,
  parseRedwoodFormEntries,
  redwoodHtmlContainsLoginForm,
  setRedwoodPostbackSupportingFields,
  setRedwoodFormEntry,
} from '@/lib/redwood/http'

const currentRedwoodLoginHtml = `
  <html>
    <head><title>Abbott | ToxAccess | Login</title></head>
    <body>
      <form method="post" action="./Login.aspx">
        <input type="hidden" name="__VIEWSTATE" value="state" />
        <input name="ctl00$PageContent$Login1$UserName" type="text" />
        <input name="ctl00$PageContent$Login1$Password" type="password" />
        <input
          type="submit"
          name="ctl00$PageContent$Login1$BtnLoginMembership"
          value="Login"
        />
        <input type="hidden" name="ctl00$PageContent$hfTimeZoneOffset" value="" />
        <input type="hidden" name="ctl00$PageContent$hfUserName" value="" />
        <div id="popup" class="modal">
          <input type="submit" name="ctl00$PageContent$btnYes_popUp" value="Yes" class="button-primary" />
          <input type="submit" name="ctl00$PageContent$btnNo_popUp" value="No" />
        </div>
      </form>
    </body>
  </html>
`

const renamedRedwoodLoginHtml = `
  <html>
    <head><title>Secure account access</title></head>
    <body>
      <form method="post" action="../sessions/start">
        <input type="hidden" name="state-a" value="state" />
        <input name="control-a" type="text" />
        <input name="control-b" type="password" />
        <button type="submit" name="control-c">Proceed</button>
        <div class="dialog">
          <button type="submit" name="control-d" class="button-primary">Keep going</button>
          <button type="submit" name="control-e">Stop</button>
        </div>
      </form>
    </body>
  </html>
`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('redwood HTTP helpers', () => {
  it('accepts both in-place and redirect donor save responses for read-back verification', async () => {
    await expect(
      assertRedwoodDonorSaveResponse(new Response('<html>Donor saved</html>', { status: 200 }), 'save'),
    ).resolves.toBeUndefined()
    await expect(
      assertRedwoodDonorSaveResponse(
        new Response(null, {
          headers: { location: '/Pages/User/Donor.aspx?donorId=2714034' },
          status: 302,
        }),
        'save',
      ),
    ).resolves.toBeUndefined()
  })

  it('rejects failed or unexpected donor save redirects', async () => {
    await expect(
      assertRedwoodDonorSaveResponse(new Response('<html>Server failure</html>', { status: 500 }), 'save'),
    ).rejects.toThrow('Redwood donor direct HTTP save failed with status 500: Server failure')
    await expect(
      assertRedwoodDonorSaveResponse(
        new Response(null, {
          headers: { location: '/Pages/Public/Login.aspx' },
          status: 302,
        }),
        'headshot save',
      ),
    ).rejects.toThrow('Redwood donor direct HTTP headshot save failed with status 302.')
  })

  it('parses successful WebForms controls without submit buttons or unchecked radios', () => {
    const entries = parseRedwoodFormEntries(`
      <form enctype="multipart/form-data">
        <input type="hidden" name="__VIEWSTATE" value="/wEPDw&amp;test" />
        <input type="text" name="ctl00$PageContent$Donor$txtFirstName" value="Bob" />
        <input type="radio" name="ctl00$PageContent$Donor$sex" value="rdbMale" checked="checked" />
        <input type="radio" name="ctl00$PageContent$Donor$sex" value="rdbFemale" />
        <input type="checkbox" name="checkedDefault" checked="checked" />
        <input type="checkbox" name="unchecked" value="on" />
        <input type="submit" name="ctl00$PageContent$Donor$btnsave" value="Save" />
        <select name="ctl00$PageContent$Donor$ddlAgencies">
          <option value="310872">MI Drug Test llc - MI</option>
          <option value="310974" selected="selected">MI Drug Test</option>
        </select>
        <textarea name="notes">A&amp;B</textarea>
      </form>
    `)

    expect(getRedwoodFormEntry(entries, '__VIEWSTATE')).toBe('/wEPDw&test')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$txtFirstName')).toBe('Bob')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$sex')).toBe('rdbMale')
    expect(getRedwoodFormEntry(entries, 'checkedDefault')).toBe('on')
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$btnsave')).toBeUndefined()
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$ddlAgencies')).toBe('310974')
    expect(getRedwoodFormEntry(entries, 'notes')).toBe('A&B')
  })

  it('updates existing entries and appends missing entries', () => {
    const entries: [string, string][] = [['first', 'Bob']]

    expect(setRedwoodFormEntry(entries, 'first', 'Robert')).toBe(true)
    expect(setRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$btnsave', 'Save')).toBe(false)

    expect(entries).toEqual([
      ['first', 'Robert'],
      ['ctl00$PageContent$Donor$btnsave', 'Save'],
    ])
  })

  it('fills the dynamic timezone fields that ToxAccess sets during browser form submission', () => {
    const entries: [string, string][] = [
      ['ctl00$hfLocalTime', ''],
      ['ctl00$hfTimeZoneOffset', ''],
      ['ctl00$PageContent$Donor$txtDateofBirth', '02/18/1978'],
    ]

    setRedwoodPostbackSupportingFields(entries)

    expect(getRedwoodFormEntry(entries, 'ctl00$hfLocalTime')).toBeTruthy()
    expect(getRedwoodFormEntry(entries, 'ctl00$hfTimeZoneOffset')).toBe(String(new Date().getTimezoneOffset()))
    expect(getRedwoodFormEntry(entries, 'ctl00$PageContent$Donor$txtDateofBirth')).toBe('02/18/1978')
  })

  it('discovers the current ToxAccess login controls instead of posting the retired button name', () => {
    const submission = buildRedwoodLoginSubmission(
      currentRedwoodLoginHtml,
      'https://toxaccess.example/Pages/Public/Login.aspx',
      {
        password: 'secret',
        username: 'worker-user',
      },
    )

    expect(submission.actionUrl).toBe('https://toxaccess.example/Pages/Public/Login.aspx')
    expect(submission.submitName).toBe('ctl00$PageContent$Login1$BtnLoginMembership')
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$Login1$UserName')).toBe('worker-user')
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$Login1$Password')).toBe('secret')
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$Login1$BtnLoginMembership')).toBe('Login')
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$Login1$LoginButtonMembership')).toBeUndefined()
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$hfUserName')).toBe('worker-user')
    expect(getRedwoodFormEntry(submission.entries, 'ctl00$PageContent$hfTimeZoneOffset')).toBe(
      String(new Date().getTimezoneOffset()),
    )
  })

  it('falls back to control types and form order when ToxAccess renames controls and UI wording', () => {
    const submission = buildRedwoodLoginSubmission(renamedRedwoodLoginHtml, 'https://toxaccess.example/public/login', {
      password: 'secret',
      username: 'worker-user',
    })

    expect(submission.actionUrl).toBe('https://toxaccess.example/sessions/start')
    expect(submission.submitName).toBe('control-c')
    expect(getRedwoodFormEntry(submission.entries, 'control-a')).toBe('worker-user')
    expect(getRedwoodFormEntry(submission.entries, 'control-b')).toBe('secret')
    expect(getRedwoodFormEntry(submission.entries, 'control-c')).toBe('Proceed')
  })

  it('discovers a structurally primary continuation without relying on the active-session message', () => {
    const continuation = buildRedwoodLoginContinuationSubmission(
      renamedRedwoodLoginHtml,
      'https://toxaccess.example/public/login',
      'control-c',
    )

    expect(continuation?.submitName).toBe('control-d')
    expect(getRedwoodFormEntry(continuation?.entries || [], 'control-d')).toBe('Keep going')
    expect(getRedwoodFormEntry(continuation?.entries || [], 'control-e')).toBeUndefined()
  })

  it('detects login pages structurally instead of by title or visible copy', () => {
    expect(redwoodHtmlContainsLoginForm(renamedRedwoodLoginHtml)).toBe(true)
    expect(redwoodHtmlContainsLoginForm('<html><form><input type="text" name="search" /></form></html>')).toBe(false)
  })

  it('posts the discovered login submit control and follows a successful redirect', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(currentRedwoodLoginHtml, {
          headers: { 'set-cookie': 'ASP.NET_SessionId=session-1; Path=/; HttpOnly' },
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: '/Pages/User/Home.aspx' },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(new Response('<html><body>Home</body></html>', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createRedwoodHttpSession({
      loginUrl: 'https://toxaccess.example/Pages/Public/Login.aspx',
      password: 'secret',
      username: 'worker-user',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const loginRequest = fetchMock.mock.calls[1]
    expect(loginRequest[0]).toBe('https://toxaccess.example/Pages/Public/Login.aspx')
    const loginBody = loginRequest[1]?.body as URLSearchParams
    expect(loginBody.get('ctl00$PageContent$Login1$BtnLoginMembership')).toBe('Login')
    expect(loginBody.has('ctl00$PageContent$Login1$LoginButtonMembership')).toBe(false)
  })

  it('uses the discovered continuation when a successful credential post remains on the login form', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(renamedRedwoodLoginHtml, { status: 200 }))
      .mockResolvedValueOnce(new Response(renamedRedwoodLoginHtml, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: '/account/home' },
          status: 303,
        }),
      )
      .mockResolvedValueOnce(new Response('<html><body>Home</body></html>', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createRedwoodHttpSession({
      loginUrl: 'https://toxaccess.example/public/login',
      password: 'secret',
      username: 'worker-user',
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const continuationBody = fetchMock.mock.calls[2][1]?.body as URLSearchParams
    expect(continuationBody.get('control-d')).toBe('Keep going')
    expect(continuationBody.has('control-e')).toBe(false)
  })
})
