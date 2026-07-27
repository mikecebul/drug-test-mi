const REDWOOD_HTTP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type RedwoodFormEntry = [name: string, value: string]

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
  postFormData: (
    url: string,
    entries: RedwoodFormEntry[],
    options?: { referer?: string },
  ) => Promise<Response>
  postMultipart: (
    url: string,
    entries: RedwoodFormEntry[],
    options?: {
      files?: RedwoodMultipartFile[]
      referer?: string
    },
  ) => Promise<Response>
  postUrlEncoded: (
    url: string,
    entries: RedwoodFormEntry[],
    options?: { referer?: string },
  ) => Promise<Response>
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
    if (!name || name === 'input' || name === 'select' || name === 'option' || name === 'textarea') {
      continue
    }

    attributes[name] = decodeRedwoodHtmlEntity(match[2] ?? match[3] ?? match[4] ?? '')
  }

  return attributes
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
  const loginEntries = parseRedwoodFormEntries(loginPage.text)
  setRedwoodFormEntry(loginEntries, '__EVENTTARGET', '')
  setRedwoodFormEntry(loginEntries, '__EVENTARGUMENT', '')
  setRedwoodFormEntry(loginEntries, 'ctl00$PageContent$Login1$UserName', auth.username)
  setRedwoodFormEntry(loginEntries, 'ctl00$PageContent$Login1$Password', auth.password)
  setRedwoodFormEntry(loginEntries, 'ctl00$PageContent$Login1$LoginButtonMembership', 'Login')
  setRedwoodFormEntry(loginEntries, 'ctl00$PageContent$hfTimeZoneOffset', '0')
  setRedwoodFormEntry(loginEntries, 'ctl00$PageContent$hfUserName', auth.username)

  const loginResponse = await postUrlEncoded(auth.loginUrl, loginEntries)
  const loginLocation = loginResponse.headers.get('location')
  if (loginLocation) {
    await getText(new URL(loginLocation, auth.loginUrl).toString())
  }

  if (loginResponse.status !== 302) {
    const body = await loginResponse.text().catch(() => '')
    const message =
      body.match(/This User Name has active another session[\s\S]*?help\./i)?.[0]?.replace(/\s+/g, ' ').trim() ||
      body.match(/validation-summary-errors[\s\S]*?<\/[^>]+>/i)?.[0]?.replace(/<[^>]*>/g, ' ').trim() ||
      `Unexpected Redwood login response status ${loginResponse.status}`
    throw new Error(`Redwood HTTP login failed: ${message}`)
  }

  return {
    getText,
    postFormData,
    postMultipart,
    postUrlEncoded,
  }
}
