const REDWOOD_HTTP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type RedwoodFormEntry = [name: string, value: string]

type RedwoodHtmlControl = {
  attributes: Record<string, string>
  index: number
  name: string
  tag: 'button' | 'input'
  type: string
  value: string
}

type RedwoodLoginForm = {
  actionUrl: string
  controls: RedwoodHtmlControl[]
  entries: RedwoodFormEntry[]
  passwordControl: RedwoodHtmlControl
  submitControl: RedwoodHtmlControl
  usernameControl: RedwoodHtmlControl
}

export type RedwoodLoginSubmission = {
  actionUrl: string
  entries: RedwoodFormEntry[]
  submitName: string
}

export type RedwoodMultipartFile = {
  blob: Blob
  filename: string
  name: string
}

export type RedwoodHttpAuth = {
  loginUrl: string
  password: string
  username: string
}

export type RedwoodHttpSession = {
  getText: (url: string) => Promise<{ response: Response; text: string }>
  postFormData: (url: string, entries: RedwoodFormEntry[], options?: { referer?: string }) => Promise<Response>
  postMultipart: (
    url: string,
    entries: RedwoodFormEntry[],
    options?: {
      files?: RedwoodMultipartFile[]
      referer?: string
    },
  ) => Promise<Response>
  postUrlEncoded: (url: string, entries: RedwoodFormEntry[], options?: { referer?: string }) => Promise<Response>
}

export function decodeRedwoodHtmlEntity(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

export function stripRedwoodHtml(value: string): string {
  return decodeRedwoodHtmlEntity(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function readRedwoodHtmlAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributeRegex = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null

  while ((match = attributeRegex.exec(tag))) {
    const name = match[1]?.toLowerCase()
    if (
      !name ||
      name === 'button' ||
      name === 'form' ||
      name === 'input' ||
      name === 'select' ||
      name === 'option' ||
      name === 'textarea'
    ) {
      continue
    }

    attributes[name] = decodeRedwoodHtmlEntity(match[2] ?? match[3] ?? match[4] ?? '')
  }

  return attributes
}

function readRedwoodHtmlControls(html: string): RedwoodHtmlControl[] {
  const controls: RedwoodHtmlControl[] = []

  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    const name = attributes.name || ''
    if (!name || 'disabled' in attributes) continue

    controls.push({
      attributes,
      index: match.index,
      name,
      tag: 'input',
      type: (attributes.type || 'text').toLowerCase(),
      value: attributes.value || '',
    })
  }

  for (const match of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
    const openingTag = match[0].slice(0, match[0].indexOf('>') + 1)
    const attributes = readRedwoodHtmlAttributes(openingTag)
    const name = attributes.name || ''
    if (!name || 'disabled' in attributes) continue

    controls.push({
      attributes,
      index: match.index,
      name,
      tag: 'button',
      type: (attributes.type || 'submit').toLowerCase(),
      value: attributes.value || stripRedwoodHtml(match[1] || ''),
    })
  }

  return controls.sort((left, right) => left.index - right.index)
}

function readRedwoodPasswordForm(
  html: string,
  pageUrl: string,
): {
  actionUrl: string
  controls: RedwoodHtmlControl[]
  html: string
} {
  const forms = Array.from(html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi))

  for (const formMatch of forms) {
    const formHtml = formMatch[0]
    const controls = readRedwoodHtmlControls(formHtml)
    if (!controls.some((control) => control.tag === 'input' && control.type === 'password')) continue

    const openingTag = formHtml.slice(0, formHtml.indexOf('>') + 1)
    const action = readRedwoodHtmlAttributes(openingTag).action || pageUrl

    return {
      actionUrl: new URL(action, pageUrl).toString(),
      controls,
      html: formHtml,
    }
  }

  throw new Error('Redwood login form did not contain a password input.')
}

function controlIdentity(control: RedwoodHtmlControl): string {
  return `${control.name} ${control.attributes.id || ''} ${control.value}`.toLowerCase()
}

function chooseRedwoodUsernameControl(
  controls: RedwoodHtmlControl[],
  passwordControl: RedwoodHtmlControl,
): RedwoodHtmlControl | null {
  const candidates = controls.filter(
    (control) =>
      control.tag === 'input' && ['email', 'text'].includes(control.type) && control.index < passwordControl.index,
  )

  return (
    candidates
      .map((control, order) => {
        const identity = controlIdentity(control)
        const semanticScore = /user|email|login|account/.test(identity) ? 10_000 : 0
        return {
          control,
          score: semanticScore + order,
        }
      })
      .sort((left, right) => right.score - left.score)[0]?.control || null
  )
}

function chooseRedwoodLoginSubmitControl(
  controls: RedwoodHtmlControl[],
  passwordControl: RedwoodHtmlControl,
): RedwoodHtmlControl | null {
  const candidates = controls.filter(
    (control) =>
      (control.tag === 'button' || ['image', 'submit'].includes(control.type)) && control.index > passwordControl.index,
  )

  return (
    candidates
      .map((control, order) => {
        const identity = controlIdentity(control)
        const semanticScore = /login|log in|sign.?in|authenticate|membership/.test(identity) ? 10_000 : 0
        const negativeScore = /cancel|forgot|reset|\bno\b|logout|log out|sso/.test(identity) ? 20_000 : 0

        return {
          control,
          score: semanticScore - negativeScore - order,
        }
      })
      .sort((left, right) => right.score - left.score)[0]?.control || null
  )
}

function buildRedwoodLoginForm(html: string, pageUrl: string): RedwoodLoginForm {
  const form = readRedwoodPasswordForm(html, pageUrl)
  const passwordControl = form.controls.find((control) => control.tag === 'input' && control.type === 'password')
  if (!passwordControl) {
    throw new Error('Redwood login form did not contain a password input.')
  }

  const usernameControl = chooseRedwoodUsernameControl(form.controls, passwordControl)
  if (!usernameControl) {
    throw new Error('Redwood login form did not contain a username input before the password input.')
  }

  const submitControl = chooseRedwoodLoginSubmitControl(form.controls, passwordControl)
  if (!submitControl) {
    throw new Error('Redwood login form did not contain a submit control after the password input.')
  }

  return {
    actionUrl: form.actionUrl,
    controls: form.controls,
    entries: parseRedwoodFormEntries(form.html),
    passwordControl,
    submitControl,
    usernameControl,
  }
}

function setRedwoodLoginSupportingFields(
  entries: RedwoodFormEntry[],
  controls: RedwoodHtmlControl[],
  username: string,
): void {
  for (const control of controls) {
    if (control.tag !== 'input' || control.type !== 'hidden') continue

    const identity = `${control.name} ${control.attributes.id || ''}`
    if (/timezoneoffset/i.test(identity)) {
      setRedwoodFormEntry(entries, control.name, '0')
    } else if (/localtime/i.test(identity)) {
      setRedwoodFormEntry(entries, control.name, new Date().toUTCString())
    } else if (/username/i.test(identity)) {
      setRedwoodFormEntry(entries, control.name, username)
    }
  }
}

export function buildRedwoodLoginSubmission(
  html: string,
  pageUrl: string,
  credentials: Pick<RedwoodHttpAuth, 'password' | 'username'>,
): RedwoodLoginSubmission {
  const form = buildRedwoodLoginForm(html, pageUrl)
  const entries = form.entries

  setRedwoodFormEntry(entries, form.usernameControl.name, credentials.username)
  setRedwoodFormEntry(entries, form.passwordControl.name, credentials.password)
  setRedwoodFormEntry(entries, form.submitControl.name, form.submitControl.value)
  setRedwoodLoginSupportingFields(entries, form.controls, credentials.username)

  return {
    actionUrl: form.actionUrl,
    entries,
    submitName: form.submitControl.name,
  }
}

export function buildRedwoodLoginContinuationSubmission(
  html: string,
  pageUrl: string,
  priorSubmitName: string,
  username?: string,
): RedwoodLoginSubmission | null {
  const form = buildRedwoodLoginForm(html, pageUrl)
  const candidates = form.controls.filter((control) => {
    if (control.name === priorSubmitName || control.name === form.submitControl.name) return false
    return control.tag === 'button' || ['image', 'submit'].includes(control.type)
  })

  const continuation = candidates
    .map((control, order) => {
      const identity = controlIdentity(control)
      const semanticScore = /yes|continue|confirm|replace|proceed|session|popup/.test(identity) ? 10_000 : 0
      const primaryScore = /primary/.test(control.attributes.class || '') ? 1_000 : 0
      const negativeScore = /cancel|\bno\b|back|logout|log out/.test(identity) ? 20_000 : 0

      return {
        control,
        score: semanticScore + primaryScore - negativeScore - order,
      }
    })
    .sort((left, right) => right.score - left.score)[0]

  if (!continuation || continuation.score < 0) {
    return null
  }

  const entries = form.entries
  setRedwoodFormEntry(entries, continuation.control.name, continuation.control.value)
  if (username) {
    setRedwoodLoginSupportingFields(entries, form.controls, username)
  }

  return {
    actionUrl: form.actionUrl,
    entries,
    submitName: continuation.control.name,
  }
}

export function redwoodHtmlContainsLoginForm(html: string): boolean {
  try {
    readRedwoodPasswordForm(html, 'https://redwood.invalid/')
    return true
  } catch {
    return false
  }
}

function readRedwoodPageTitle(html: string): string | null {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return title ? stripRedwoodHtml(title).slice(0, 120) : null
}

export function parseRedwoodFormEntries(html: string): RedwoodFormEntry[] {
  const entries: RedwoodFormEntry[] = []
  let match: RegExpExecArray | null

  const inputRegex = /<input\b[^>]*>/gi
  while ((match = inputRegex.exec(html))) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    const name = attributes.name
    if (!name || 'disabled' in attributes) continue

    const type = (attributes.type || 'text').toLowerCase()
    if (['submit', 'button', 'reset', 'image', 'file'].includes(type)) continue
    if ((type === 'checkbox' || type === 'radio') && !('checked' in attributes)) continue

    entries.push([name, attributes.value ?? (type === 'checkbox' ? 'on' : '')])
  }

  const textareaRegex = /<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi
  while ((match = textareaRegex.exec(html))) {
    const attributes = readRedwoodHtmlAttributes(match[0])
    const name = attributes.name
    if (!name || 'disabled' in attributes) continue

    entries.push([name, decodeRedwoodHtmlEntity(match[1] || '')])
  }

  const selectRegex = /<select\b[^>]*>([\s\S]*?)<\/select>/gi
  while ((match = selectRegex.exec(html))) {
    const openingTag = match[0].slice(0, match[0].indexOf('>') + 1)
    const attributes = readRedwoodHtmlAttributes(openingTag)
    const name = attributes.name
    if (!name || 'disabled' in attributes) continue

    const options = Array.from((match[1] || '').matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)).map(
      (optionMatch) => ({
        attributes: readRedwoodHtmlAttributes(optionMatch[0]),
        text: stripRedwoodHtml(optionMatch[1] || ''),
      }),
    )
    const selectedOption = options.find((option) => 'selected' in option.attributes) || options[0]
    entries.push([name, selectedOption ? (selectedOption.attributes.value ?? selectedOption.text) : ''])
  }

  return entries
}

export function getRedwoodFormEntry(entries: RedwoodFormEntry[], name: string): string | undefined {
  return entries.find((entry) => entry[0] === name)?.[1]
}

export function setRedwoodFormEntry(entries: RedwoodFormEntry[], name: string, value: string): boolean {
  let found = false

  for (const entry of entries) {
    if (entry[0] !== name) continue
    entry[1] = value
    found = true
  }

  if (!found) {
    entries.push([name, value])
  }

  return found
}

export function removeRedwoodFormEntry(entries: RedwoodFormEntry[], name: string): boolean {
  let removed = false

  for (let index = entries.length - 1; index >= 0; index--) {
    if (entries[index][0] !== name) continue
    entries.splice(index, 1)
    removed = true
  }

  return removed
}

export function redwoodFormEntriesToFormData(entries: RedwoodFormEntry[], files?: RedwoodMultipartFile[]): FormData {
  const formData = new FormData()
  for (const [name, value] of entries) {
    formData.append(name, value)
  }

  for (const file of files || []) {
    formData.append(file.name, file.blob, file.filename)
  }

  return formData
}

class RedwoodCookieJar {
  private cookies = new Map<string, string>()

  add(headers: Headers): void {
    const setCookieHeaders =
      typeof (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
        ? (headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
        : headers.get('set-cookie')
          ? [headers.get('set-cookie') as string]
          : []

    for (const rawHeader of setCookieHeaders) {
      for (const cookiePart of rawHeader.split(/,(?=[^;,]+=)/)) {
        const firstPart = cookiePart.split(';')[0]
        const separatorIndex = firstPart.indexOf('=')
        if (separatorIndex <= 0) continue

        this.cookies.set(firstPart.slice(0, separatorIndex).trim(), firstPart.slice(separatorIndex + 1).trim())
      }
    }
  }

  toHeader(): string {
    return Array.from(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
}

function redwoodOrigin(url: string): string {
  return new URL(url).origin
}

async function redwoodRequest(
  jar: RedwoodCookieJar,
  url: string,
  init?: RequestInit & { referer?: string },
): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('user-agent', REDWOOD_HTTP_USER_AGENT)

  const cookieHeader = jar.toHeader()
  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  const response = await fetch(url, {
    ...init,
    headers,
    redirect: 'manual',
  })
  jar.add(response.headers)
  return response
}

export async function createRedwoodHttpSession(auth: RedwoodHttpAuth): Promise<RedwoodHttpSession> {
  const jar = new RedwoodCookieJar()

  const getText = async (url: string): Promise<{ response: Response; text: string }> => {
    const response = await redwoodRequest(jar, url)
    return {
      response,
      text: await response.text(),
    }
  }

  const postUrlEncoded = async (
    url: string,
    entries: RedwoodFormEntry[],
    options?: { referer?: string },
  ): Promise<Response> => {
    return await redwoodRequest(jar, url, {
      body: new URLSearchParams(entries),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: redwoodOrigin(url),
        referer: options?.referer || url,
      },
      method: 'POST',
    })
  }

  const postMultipart = async (
    url: string,
    entries: RedwoodFormEntry[],
    options?: {
      files?: RedwoodMultipartFile[]
      referer?: string
    },
  ): Promise<Response> => {
    return await redwoodRequest(jar, url, {
      body: redwoodFormEntriesToFormData(entries, options?.files),
      headers: {
        origin: redwoodOrigin(url),
        referer: options?.referer || url,
      },
      method: 'POST',
    })
  }

  const postFormData = async (
    url: string,
    entries: RedwoodFormEntry[],
    options?: { referer?: string },
  ): Promise<Response> => postMultipart(url, entries, options)

  const loginPage = await getText(auth.loginUrl)
  const loginSubmission = buildRedwoodLoginSubmission(loginPage.text, auth.loginUrl, auth)

  let loginResponse = await postUrlEncoded(loginSubmission.actionUrl, loginSubmission.entries, {
    referer: auth.loginUrl,
  })
  let responseBody = ''

  const finishRedirect = async (response: Response, requestUrl: string): Promise<boolean> => {
    const location = response.headers.get('location')
    if (response.status < 300 || response.status >= 400 || !location) return false

    await getText(new URL(location, requestUrl).toString())
    return true
  }

  let authenticated = await finishRedirect(loginResponse, loginSubmission.actionUrl)
  if (!authenticated) {
    responseBody = await loginResponse.text().catch(() => '')
    authenticated = loginResponse.ok && !redwoodHtmlContainsLoginForm(responseBody)
  }

  if (!authenticated && loginResponse.ok && redwoodHtmlContainsLoginForm(responseBody)) {
    const continuation = buildRedwoodLoginContinuationSubmission(
      responseBody,
      loginResponse.url || loginSubmission.actionUrl,
      loginSubmission.submitName,
      auth.username,
    )

    if (continuation) {
      loginResponse = await postUrlEncoded(continuation.actionUrl, continuation.entries, {
        referer: loginResponse.url || loginSubmission.actionUrl,
      })
      authenticated = await finishRedirect(loginResponse, continuation.actionUrl)
      if (!authenticated) {
        responseBody = await loginResponse.text().catch(() => '')
        authenticated = loginResponse.ok && !redwoodHtmlContainsLoginForm(responseBody)
      }
    }
  }

  if (!authenticated) {
    const title = readRedwoodPageTitle(responseBody)
    const pageDescription = title ? ` on page "${title}"` : ''
    const loginFormDescription = redwoodHtmlContainsLoginForm(responseBody)
      ? '; the login form was still present after submission'
      : ''
    throw new Error(
      `Redwood HTTP login failed: unexpected response status ${loginResponse.status}${pageDescription}${loginFormDescription}.`,
    )
  }

  return {
    getText,
    postFormData,
    postMultipart,
    postUrlEncoded,
  }
}
