import path from 'node:path'

import type { Payload } from 'payload'
import sharp from 'sharp'

import { fetchDocument, type FetchDocumentResult } from '@/collections/DrugTests/services/documentFetch'
import { buildRedwoodDonorEditUrl } from '@/lib/redwood/donor-urls'
import {
  assertRedwoodDonorSaveResponse,
  createRedwoodHttpSession,
  parseRedwoodFormEntries,
  setRedwoodFormEntry,
  type RedwoodMultipartFile,
} from '@/lib/redwood/http'
import {
  assertRedwoodDonorAccountAllowed,
  readRedwoodCallInCodeViaHttp,
  resolveRedwoodDonorIdViaHttp,
} from '@/lib/redwood/http-donor-search'
import { resolveRedwoodAuthEnv } from '@/lib/redwood/auth'
import { getAllowedRedwoodAccountNumbers } from '@/lib/redwood/config'

const DEFAULT_REDWOOD_DONOR_SEARCH_URL = 'https://toxaccess.redwoodtoxicology.com/Pages/User/DonorSearch.aspx'
const REDWOOD_PHOTO_FIELD_NAME = 'ctl00$PageContent$Donor$Photo'
const REDWOOD_SAVE_BUTTON_NAME = 'ctl00$PageContent$Donor$btnsave'

function buildHeadshotUploadName(clientId: string, sourceFilename: string, extension: string): string {
  const parsed = path.parse(sourceFilename)
  const baseName = (parsed.name || 'headshot')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${clientId}-${baseName || 'headshot'}${extension}`
}

async function buildRedwoodPhotoFile(args: {
  clientId: string
  headshot: FetchDocumentResult
}): Promise<RedwoodMultipartFile> {
  const { clientId, headshot } = args
  const mimeType = headshot.mimeType.trim().toLowerCase()

  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/gif') {
    return {
      blob: new Blob([new Uint8Array(headshot.buffer)], { type: mimeType }),
      filename: buildHeadshotUploadName(clientId, headshot.filename, path.extname(headshot.filename) || '.jpg'),
      name: REDWOOD_PHOTO_FIELD_NAME,
    }
  }

  const converted = await sharp(headshot.buffer).flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer()
  return {
    blob: new Blob([new Uint8Array(converted)], { type: 'image/jpeg' }),
    filename: buildHeadshotUploadName(clientId, headshot.filename, '.jpg'),
    name: REDWOOD_PHOTO_FIELD_NAME,
  }
}

function assertDonorEditPage(html: string, donorId: string): void {
  if (/PageContent_Donor_txtFirstName/.test(html) && /PageContent_Donor_Photo/.test(html)) {
    return
  }

  if (/Pages\/Public\/Login\.aspx/i.test(html)) {
    throw new Error('Redwood HTTP headshot upload was redirected to login while opening donor edit page.')
  }

  throw new Error(`Redwood donor edit page did not expose photo fields for donor ${donorId}.`)
}

function readDonorPhotoSaved(html: string): boolean {
  const hasPhotoFlag = /name="ctl00\$PageContent\$Donor\$IsDonorPhotExist"[^>]+value="true"/i.test(html)
  const hasRemovePhotoControl = /name="ctl00\$PageContent\$Donor\$RemovePhoto"/i.test(html)
  return hasPhotoFlag || hasRemovePhotoControl
}

export async function uploadClientHeadshotToRedwoodViaHttp(args: {
  accountNumber: string
  client: {
    firstName: string
    headshotId: string
    id: string
    lastName: string
    redwoodAccountNumber?: string
    redwoodDonorId?: string
  }
  payload: Payload
}): Promise<{
  accountNumber: string
  callInCode: string | null
  donorId: string | null
  status: 'synced'
}> {
  const { client, payload } = args

  const auth = resolveRedwoodAuthEnv()
  const donorSearchUrl = process.env.REDWOOD_DONOR_SEARCH_URL?.trim() || DEFAULT_REDWOOD_DONOR_SEARCH_URL
  const session = await createRedwoodHttpSession(auth)
  const donorId = await resolveRedwoodDonorIdViaHttp({
    accountNumbers: getAllowedRedwoodAccountNumbers(),
    client,
    donorSearchUrl,
    session,
  })
  const editUrl = buildRedwoodDonorEditUrl(donorSearchUrl, donorId)
  const headshot = await fetchDocument(client.headshotId, payload)
  const photoFile = await buildRedwoodPhotoFile({ clientId: client.id, headshot })

  const editPage = await session.getText(editUrl)
  assertDonorEditPage(editPage.text, donorId)
  const accountNumber = assertRedwoodDonorAccountAllowed(editPage.text, donorId)
  const editEntries = parseRedwoodFormEntries(editPage.text)
  setRedwoodFormEntry(editEntries, REDWOOD_SAVE_BUTTON_NAME, 'Save')

  const saveResponse = await session.postMultipart(editUrl, editEntries, {
    files: [photoFile],
    referer: editUrl,
  })
  await assertRedwoodDonorSaveResponse(saveResponse, 'headshot save')

  const verificationPage = await session.getText(editUrl)
  assertDonorEditPage(verificationPage.text, donorId)
  assertRedwoodDonorAccountAllowed(verificationPage.text, donorId)
  if (!readDonorPhotoSaved(verificationPage.text)) {
    throw new Error('Redwood donor direct HTTP headshot upload could not be verified on the donor edit page.')
  }

  return {
    accountNumber,
    callInCode: await readRedwoodCallInCodeViaHttp({ donorId, donorSearchUrl, session }),
    donorId,
    status: 'synced',
  }
}
