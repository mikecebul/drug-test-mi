import { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-mongodb'

type CanonicalTestType = '11-panel-lab' | '15-panel-instant' | '17-panel-sos-lab' | 'etg-lab'

type Recipient = {
  name: string
  email: string
}

type ReferralAggregate = {
  name: string
  mainContactName: string
  mainContactEmail: string
  recipientEmails: Set<string>
  clientIds: Set<string>
  testTypeCounts?: Record<CanonicalTestType, number>
}

type CanonicalReferralType = 'court' | 'employer' | 'self'

type ReferralRelationship = {
  relationTo: 'courts' | 'employers'
  value: string
}

const CANONICAL_TEST_TYPES: Array<{
  value: CanonicalTestType
  label: string
  bookingLabel: string
  category: 'instant' | 'lab'
}> = [
  {
    value: '11-panel-lab',
    label: '11-Panel Lab',
    bookingLabel: '11 Panel Lab',
    category: 'lab',
  },
  {
    value: '15-panel-instant',
    label: '15-Panel Instant',
    bookingLabel: '15 Panel Instant',
    category: 'instant',
  },
  {
    value: '17-panel-sos-lab',
    label: '17-Panel SOS Lab',
    bookingLabel: '17 SOS Lab',
    category: 'lab',
  },
  {
    value: 'etg-lab',
    label: 'EtG Lab',
    bookingLabel: 'EtG Lab',
    category: 'lab',
  },
]

const TEST_TYPE_NORMALIZATION_MAP: Record<string, CanonicalTestType> = {
  '11-panel-lab': '11-panel-lab',
  '11-panel': '11-panel-lab',
  '11-panel-laboratory': '11-panel-lab',
  '15-panel-instant': '15-panel-instant',
  '15-panel': '15-panel-instant',
  '15-panel-test': '15-panel-instant',
  '17-panel-sos-lab': '17-panel-sos-lab',
  '17-panel-sos': '17-panel-sos-lab',
  '17-panel': '17-panel-sos-lab',
  'etg-lab': 'etg-lab',
  etg: 'etg-lab',
}

const HARDCODED_COURTS: Array<{
  name: string
  mainContactName: string
  mainContactEmail: string
  recipientEmails: string[]
}> = [
  {
    name: 'Charlevoix District',
    mainContactName: 'Maria Shrift',
    mainContactEmail: 'shriftm@charlevoixcounty.org',
    recipientEmails: ['shepardz@charlevoixcounty.org'],
  },
  {
    name: 'Charlevoix Circuit Court (Patrick Stoner)',
    mainContactName: 'Patrick Stoner',
    mainContactEmail: 'stonerp@michigan.gov',
    recipientEmails: [],
  },
  {
    name: 'Charlevoix Circuit Court (Derek Hofbauer)',
    mainContactName: 'Derek Hofbauer',
    mainContactEmail: 'hofbauerd1@michigan.gov',
    recipientEmails: [],
  },
  {
    name: 'Charlevoix Circuit Bond',
    mainContactName: 'Marla Weston',
    mainContactEmail: 'westonm@charlevoixcounty.org',
    recipientEmails: [],
  },
  {
    name: 'Charlevoix Drug Court',
    mainContactName: 'Kerry Zahner',
    mainContactEmail: 'zahnerk2@charlevoixcounty.org',
    recipientEmails: ['stonerp@michigan.gov', 'scott@basesmi.org'],
  },
  {
    name: 'Emmet District',
    mainContactName: 'Olivia Tackett',
    mainContactEmail: 'otackett@emmetcounty.org',
    recipientEmails: ['hmccreery@emmetcounty.org'],
  },
  {
    name: 'Otsego District',
    mainContactName: 'Otsego Probation',
    mainContactEmail: 'otcprobation@otsegocountymi.gov',
    recipientEmails: [],
  },
]

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
}

function normalizeTestType(raw: unknown): CanonicalTestType | null {
  if (typeof raw !== 'string') return null
  if (!raw.trim()) return null

  const slug = normalizeSlug(raw)
  const fromMap = TEST_TYPE_NORMALIZATION_MAP[slug]
  if (fromMap) return fromMap

  if (slug.includes('etg')) return 'etg-lab'
  if (slug.includes('17') && slug.includes('panel')) return '17-panel-sos-lab'
  if (slug.includes('15') && slug.includes('panel')) return '15-panel-instant'
  if (slug.includes('11') && slug.includes('panel')) return '11-panel-lab'

  return null
}

function pickPreferredTestType(counts: Record<CanonicalTestType, number>): CanonicalTestType | null {
  const ordered = CANONICAL_TEST_TYPES.map((entry) => entry.value).sort((a, b) => counts[b] - counts[a])
  const top = ordered[0]
  return counts[top] > 0 ? top : null
}

function makeFallbackContactEmail(name: string, suffix: string): string {
  const slug = normalizeSlug(name) || suffix
  return `no-reply+${slug}@midrugtest.com`
}

function toId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    value &&
    'toHexString' in value &&
    typeof (value as { toHexString: unknown }).toHexString === 'function'
  ) {
    return (value as { toHexString: () => string }).toHexString()
  }
  if (typeof value === 'object' && value && 'id' in value && typeof (value as { id: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

function collectLegacyRecipients(raw: unknown): Recipient[] {
  if (!Array.isArray(raw)) return []

  const deduped = new Map<string, Recipient>()
  raw.forEach((recipient) => {
    const email = typeof recipient?.email === 'string' ? recipient.email.trim() : ''
    if (!email) return

    const name = typeof recipient?.name === 'string' ? recipient.name.trim() : ''
    const key = email.toLowerCase()
    const existing = deduped.get(key)

    if (!existing) {
      deduped.set(key, { name, email })
      return
    }

    if (!existing.name && name) {
      deduped.set(key, { name, email: existing.email })
    }
  })

  return Array.from(deduped.values())
}

function collectReferralContacts(referralDoc: any): Recipient[] {
  const deduped = new Map<string, Recipient>()
  const add = (recipient: { name?: string; email?: string }) => {
    const email = typeof recipient.email === 'string' ? recipient.email.trim() : ''
    if (!email) return
    const key = email.toLowerCase()
    const name = typeof recipient.name === 'string' ? recipient.name.trim() : ''
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, { name, email })
      return
    }
    if (!existing.name && name) {
      deduped.set(key, { name, email: existing.email })
    }
  }

  collectLegacyRecipients(referralDoc?.contacts).forEach(add)
  add({ name: referralDoc?.mainContactName, email: referralDoc?.mainContactEmail })

  if (Array.isArray(referralDoc?.recipientEmails)) {
    referralDoc.recipientEmails.forEach((row: { email?: string }) => {
      add({ email: row?.email })
    })
  }

  return Array.from(deduped.values())
}

function toContactRows(aggregate: ReferralAggregate): Array<{ name?: string; email: string }> {
  const rows: Array<{ name?: string; email: string }> = []
  if (aggregate.mainContactEmail) {
    rows.push({
      ...(aggregate.mainContactName ? { name: aggregate.mainContactName } : {}),
      email: aggregate.mainContactEmail,
    })
  }
  Array.from(aggregate.recipientEmails)
    .filter((email) => email.toLowerCase() !== aggregate.mainContactEmail.toLowerCase())
    .forEach((email) => {
      rows.push({ email })
    })
  return rows
}

function normalizeReferralType(raw: unknown): CanonicalReferralType | null {
  if (raw === 'court' || raw === 'probation') return 'court'
  if (raw === 'employer' || raw === 'employment') return 'employer'
  if (raw === 'self') return 'self'
  return null
}

function readReferralRelationship(raw: unknown): ReferralRelationship | null {
  if (!raw || typeof raw !== 'object') return null
  const relationTo = (raw as { relationTo?: unknown }).relationTo
  if (relationTo !== 'courts' && relationTo !== 'employers') return null
  const value = toId((raw as { value?: unknown }).value)
  if (!value) return null
  return { relationTo, value }
}

function referralTypeFromRelationship(
  relation: ReferralRelationship | null,
): Exclude<CanonicalReferralType, 'self'> | null {
  if (!relation) return null
  return relation.relationTo === 'courts' ? 'court' : 'employer'
}

function resolveClientReferralType(client: any): CanonicalReferralType {
  const current = normalizeReferralType(client.referralType)
  const legacy = normalizeReferralType(client.clientType)
  const relation = readReferralRelationship(client.referral)
  const relationType = referralTypeFromRelationship(relation)

  if (current === 'self') return 'self'
  if (current && relationType && current !== relationType) return relationType
  if (current) return current
  if (legacy) return legacy
  if (relationType) return relationType
  return 'self'
}

function ensureAggregate(
  map: Map<string, ReferralAggregate>,
  key: string,
  defaults: {
    name: string
    mainContactName: string
    mainContactEmail: string
    withTestTypeCounts?: boolean
  },
): ReferralAggregate {
  const existing = map.get(key)
  if (existing) return existing

  const aggregate: ReferralAggregate = {
    name: defaults.name,
    mainContactName: defaults.mainContactName,
    mainContactEmail: defaults.mainContactEmail,
    recipientEmails: new Set<string>(),
    clientIds: new Set<string>(),
    ...(defaults.withTestTypeCounts
      ? {
          testTypeCounts: {
            '11-panel-lab': 0,
            '15-panel-instant': 0,
            '17-panel-sos-lab': 0,
            'etg-lab': 0,
          },
        }
      : {}),
  }

  map.set(key, aggregate)
  return aggregate
}

function attachStringId<T extends Record<string, unknown>>(doc: T): T & { id: string } {
  const id = toId((doc as { id?: unknown }).id) || toId((doc as { _id?: unknown })._id) || ''
  return {
    ...doc,
    id,
  }
}

function mergeContact(aggregate: ReferralAggregate, contact: { name?: string; email?: string }) {
  const email = typeof contact.email === 'string' ? contact.email.trim() : ''
  if (!email) return

  const name = typeof contact.name === 'string' ? contact.name.trim() : ''

  if (!aggregate.mainContactEmail) {
    aggregate.mainContactEmail = email
  }

  if (!aggregate.mainContactName && name) {
    aggregate.mainContactName = name
  }

  if (aggregate.mainContactEmail.toLowerCase() !== email.toLowerCase()) {
    aggregate.recipientEmails.add(email)
  }
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  payload.logger.info('Starting migration: referral model refactor (courts + employers + clients + test types)')
  const database = (payload.db as any).connection.db

  const testTypeIdByValue = new Map<CanonicalTestType, string>()

  const existingTestTypes = await payload.find({
    collection: 'test-types',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  existingTestTypes.docs.forEach((testType: any) => {
    if (typeof testType.value === 'string') {
      const canonical = normalizeTestType(testType.value)
      if (canonical) {
        testTypeIdByValue.set(canonical, testType.id)
      }
    }
  })

  let createdTestTypes = 0
  for (const entry of CANONICAL_TEST_TYPES) {
    if (testTypeIdByValue.has(entry.value)) continue

    const created = await payload.create({
      collection: 'test-types',
      data: {
        value: entry.value,
        label: entry.label,
        bookingLabel: entry.bookingLabel,
        category: entry.category,
        isActive: true,
      },
      overrideAccess: true,
    })

    testTypeIdByValue.set(entry.value, created.id)
    createdTestTypes++
  }

  const clients = (await database.collection('clients').find({}).toArray()).map((doc: any) => attachStringId(doc))

  const existingEmployers = (await database.collection('employers').find({}).toArray()).map((doc: any) =>
    attachStringId(doc),
  ) as any[]
  const existingEmployerByKey = new Map<string, any>()
  const existingEmployerById = new Map<string, any>()
  existingEmployers.forEach((employer) => {
    if (employer.id) {
      existingEmployerById.set(employer.id, employer)
    }
    if (employer.name) {
      existingEmployerByKey.set(normalizeKey(employer.name), employer)
    }
  })

  const existingCourts = (await database.collection('courts').find({}).toArray()).map((doc: any) =>
    attachStringId(doc),
  ) as any[]
  const existingCourtByKey = new Map<string, any>()
  const existingCourtById = new Map<string, any>()
  existingCourts.forEach((court) => {
    if (court.id) {
      existingCourtById.set(court.id, court)
    }
    if (court.name) {
      existingCourtByKey.set(normalizeKey(court.name), court)
    }
  })

  const employerAggregates = new Map<string, ReferralAggregate>()
  const employerKeyByClientId = new Map<string, string>()

  existingEmployers.forEach((employer) => {
    const key = normalizeKey(employer.name || '')
    if (!key) return
    const contacts = collectReferralContacts(employer)
    const primaryContact = contacts[0]

    const aggregate = ensureAggregate(employerAggregates, key, {
      name: employer.name,
      mainContactName: primaryContact?.name || '',
      mainContactEmail: primaryContact?.email || '',
      withTestTypeCounts: true,
    })

    contacts.forEach((recipient) => mergeContact(aggregate, recipient))
  })

  for (const client of clients) {
    const resolvedType = resolveClientReferralType(client)
    if (resolvedType !== 'employer') continue

    const legacyEmployerId = toId(client.employmentInfo?.employer)
    const employerFromRelationship = legacyEmployerId ? existingEmployerById.get(legacyEmployerId) : null
    const currentReferral = readReferralRelationship(client.referral)
    const employerFromCurrentReferral =
      currentReferral?.relationTo === 'employers' ? existingEmployerById.get(currentReferral.value) : null
    const relationshipPrimaryContact = employerFromRelationship
      ? collectReferralContacts(employerFromRelationship)[0]
      : null
    const currentPrimaryContact = employerFromCurrentReferral
      ? collectReferralContacts(employerFromCurrentReferral)[0]
      : null

    const employerName =
      client.employmentInfo?.employerName?.trim() ||
      employerFromRelationship?.name ||
      employerFromCurrentReferral?.name ||
      'Unspecified Employer'
    const key = normalizeKey(employerName)

    const aggregate = ensureAggregate(employerAggregates, key, {
      name: employerName,
      mainContactName: relationshipPrimaryContact?.name || currentPrimaryContact?.name || '',
      mainContactEmail: relationshipPrimaryContact?.email || currentPrimaryContact?.email || '',
      withTestTypeCounts: true,
    })

    const clientId = toId(client.id)
    if (clientId) {
      aggregate.clientIds.add(clientId)
      employerKeyByClientId.set(clientId, key)
    }

    collectLegacyRecipients(client.employmentInfo?.recipients).forEach((recipient) =>
      mergeContact(aggregate, recipient),
    )
  }

  let normalizedDrugTests = 0
  let unknownDrugTests = 0
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const batch = await payload.find({
      collection: 'drug-tests',
      page,
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of batch.docs as any[]) {
      const canonical = normalizeTestType(doc.testType)
      if (!canonical) {
        unknownDrugTests++
      } else {
        if (doc.testType !== canonical) {
          await payload.update({
            collection: 'drug-tests',
            id: doc.id,
            data: {
              testType: canonical,
            },
            overrideAccess: true,
          })
          normalizedDrugTests++
        }

        const clientId = toId(doc.relatedClient)
        const employerKey = clientId ? employerKeyByClientId.get(clientId) : undefined
        const aggregate = employerKey ? employerAggregates.get(employerKey) : null
        if (aggregate?.testTypeCounts) {
          aggregate.testTypeCounts[canonical] += 1
        }
      }
    }

    hasNextPage = batch.hasNextPage
    page += 1
  }

  const employerIdByKey = new Map<string, string>()
  let createdEmployers = 0
  let updatedEmployers = 0

  for (const [key, aggregate] of employerAggregates.entries()) {
    if (!aggregate.mainContactEmail) {
      aggregate.mainContactEmail = makeFallbackContactEmail(aggregate.name, 'employer')
    }
    if (!aggregate.mainContactName) {
      aggregate.mainContactName = 'Employer Contact'
    }

    aggregate.recipientEmails.delete(aggregate.mainContactEmail)

    const preferredTestTypeValue = aggregate.testTypeCounts ? pickPreferredTestType(aggregate.testTypeCounts) : null
    const preferredTestTypeId = preferredTestTypeValue ? testTypeIdByValue.get(preferredTestTypeValue) : undefined

    const existingEmployer = existingEmployerByKey.get(key)
    if (!existingEmployer) {
      const created = await payload.create({
        collection: 'employers',
        data: {
          name: aggregate.name,
          contacts: toContactRows(aggregate),
          preferredTestType: preferredTestTypeId,
          isActive: true,
        },
        overrideAccess: true,
      })

      employerIdByKey.set(key, created.id)
      createdEmployers++
      continue
    }

    await payload.update({
      collection: 'employers',
      id: existingEmployer.id,
      data: {
        name: aggregate.name,
        contacts: toContactRows(aggregate),
        preferredTestType: preferredTestTypeId || existingEmployer.preferredTestType,
        isActive: typeof existingEmployer.isActive === 'boolean' ? existingEmployer.isActive : true,
      },
      overrideAccess: true,
    })

    employerIdByKey.set(key, existingEmployer.id)
    updatedEmployers++
  }

  const courtAggregates = new Map<string, ReferralAggregate>()

  HARDCODED_COURTS.forEach((court) => {
    const key = normalizeKey(court.name)
    const aggregate = ensureAggregate(courtAggregates, key, {
      name: court.name,
      mainContactName: court.mainContactName,
      mainContactEmail: court.mainContactEmail,
    })

    court.recipientEmails.forEach((email) => {
      if (email.trim()) {
        aggregate.recipientEmails.add(email.trim())
      }
    })
  })

  for (const client of clients) {
    const resolvedType = resolveClientReferralType(client)
    if (resolvedType !== 'court') continue

    const currentReferral = readReferralRelationship(client.referral)
    const courtFromCurrentReferral =
      currentReferral?.relationTo === 'courts' ? existingCourtById.get(currentReferral.value) : null
    const courtPrimaryContact = courtFromCurrentReferral ? collectReferralContacts(courtFromCurrentReferral)[0] : null

    const courtName = client.courtInfo?.courtName?.trim() || courtFromCurrentReferral?.name || 'Unspecified Court'

    const key = normalizeKey(courtName)
    const aggregate = ensureAggregate(courtAggregates, key, {
      name: courtName,
      mainContactName: courtPrimaryContact?.name || '',
      mainContactEmail: courtPrimaryContact?.email || '',
    })

    const clientId = toId(client.id)
    if (clientId) {
      aggregate.clientIds.add(clientId)
    }

    collectLegacyRecipients(client.courtInfo?.recipients).forEach((recipient) => mergeContact(aggregate, recipient))
  }

  const courtIdByKey = new Map<string, string>()
  let createdCourts = 0
  let updatedCourts = 0

  for (const [key, aggregate] of courtAggregates.entries()) {
    if (!aggregate.mainContactEmail) {
      aggregate.mainContactEmail = makeFallbackContactEmail(aggregate.name, 'court')
    }
    if (!aggregate.mainContactName) {
      aggregate.mainContactName = 'Court Contact'
    }

    aggregate.recipientEmails.delete(aggregate.mainContactEmail)

    const existingCourt = existingCourtByKey.get(key)

    if (!existingCourt) {
      const created = await payload.create({
        collection: 'courts',
        data: {
          name: aggregate.name,
          contacts: toContactRows(aggregate),
          isActive: true,
        },
        overrideAccess: true,
      })

      courtIdByKey.set(key, created.id)
      createdCourts++
      continue
    }

    await payload.update({
      collection: 'courts',
      id: existingCourt.id,
      data: {
        name: aggregate.name,
        contacts: toContactRows(aggregate),
        preferredTestType: existingCourt.preferredTestType || undefined,
        isActive: typeof existingCourt.isActive === 'boolean' ? existingCourt.isActive : true,
      },
      overrideAccess: true,
    })

    courtIdByKey.set(key, existingCourt.id)
    updatedCourts++
  }

  let updatedClients = 0
  let fallbackToSelf = 0
  for (const client of clients) {
    const referralType = resolveClientReferralType(client)
    const currentReferral = readReferralRelationship(client.referral)

    const updateData: Record<string, unknown> = {
      referralType,
      selfReferral: {
        sendToOther: false,
        recipients: [],
      },
      referral: null,
    }

    if (referralType === 'court') {
      const key = normalizeKey(client.courtInfo?.courtName || 'Unspecified Court')
      const courtId = currentReferral?.relationTo === 'courts' ? currentReferral.value : courtIdByKey.get(key)
      if (courtId) {
        updateData.referral = {
          relationTo: 'courts',
          value: courtId,
        }
      }
    }

    if (referralType === 'employer') {
      const employerName =
        (currentReferral?.relationTo === 'employers' ? existingEmployerById.get(currentReferral.value)?.name : '') ||
        client.employmentInfo?.employerName?.trim() ||
        existingEmployerById.get(toId(client.employmentInfo?.employer) || '')?.name ||
        'Unspecified Employer'
      const key = normalizeKey(employerName)
      const employerId = currentReferral?.relationTo === 'employers' ? currentReferral.value : employerIdByKey.get(key)
      if (employerId) {
        updateData.referral = {
          relationTo: 'employers',
          value: employerId,
        }
      }
    }

    if (referralType === 'self') {
      const existingRecipients = collectLegacyRecipients(client.selfReferral?.recipients)
      const legacyRecipients = collectLegacyRecipients(client.selfInfo?.recipients)
      const recipients = existingRecipients.length > 0 ? existingRecipients : legacyRecipients
      updateData.selfReferral = {
        sendToOther: recipients.length > 0 || client.selfReferral?.sendToOther === true,
        recipients,
      }
    } else if (!updateData.referral) {
      const existingRecipients = collectLegacyRecipients(client.selfReferral?.recipients)
      const legacyRecipients = collectLegacyRecipients(client.selfInfo?.recipients)
      const recipients = existingRecipients.length > 0 ? existingRecipients : legacyRecipients

      updateData.referralType = 'self'
      updateData.referral = null
      updateData.selfReferral = {
        sendToOther: recipients.length > 0 || client.selfReferral?.sendToOther === true,
        recipients,
      }
      fallbackToSelf++
    }

    await payload.update({
      collection: 'clients',
      id: client.id,
      data: updateData,
      overrideAccess: true,
    })

    updatedClients++
  }

  payload.logger.info(
    [
      'Migration complete:',
      `testTypes(created=${createdTestTypes})`,
      `drugTests(normalized=${normalizedDrugTests}, unknown=${unknownDrugTests})`,
      `employers(created=${createdEmployers}, updated=${updatedEmployers})`,
      `courts(created=${createdCourts}, updated=${updatedCourts})`,
      `clients(updated=${updatedClients})`,
      `clients(fallbackToSelf=${fallbackToSelf})`,
    ].join(' '),
  )
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.info('Down migration for referral model refactor is a no-op to avoid destructive rollback.')
}
