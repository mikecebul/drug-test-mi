import { randomUUID } from 'node:crypto'
import { ensureDotEnvLoaded } from './env'

type SeededPerson = {
  id: string
  firstName: string
  middleInitial?: string
  lastName: string
  fullName: string
  email: string
  referralRecipients: string[]
}

type FixtureContext = {
  runId: string
  admin: {
    id: string
    email: string
    password: string
    name: string
  }
  referrals: {
    employer: {
      id: string
      name: string
      recipientEmail: string
    }
    court: {
      id: string
      name: string
      recipientEmail: string
    }
  }
  clients: {
    collectLab: SeededPerson
    instant: SeededPerson
    labScreen: SeededPerson
    labConfirm: SeededPerson
  }
  tests: {
    labScreenCollectedTestId: string
    labConfirmPendingTestId: string
  }
  created: {
    adminIds: string[]
    employerIds: string[]
    courtIds: string[]
    clientIds: string[]
    drugTestIds: string[]
    privateMediaIds: string[]
  }
}

type NotificationEntry = {
  stage?: string | null
  status?: string | null
  intendedRecipients?: string | null
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function getPayloadClient() {
  ensureDotEnvLoaded()
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../../../src/payload.config'),
  ])
  return getPayload({ config })
}

function toRunId() {
  return `${Date.now()}-${randomUUID().slice(0, 8)}`
}

function parseFullName(fullName: string): { firstName: string; middleInitial?: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    throw new Error(`Expected full name with at least 2 parts, got: "${fullName}"`)
  }

  const firstName = parts[0]
  const lastName = parts[parts.length - 1]
  const middleInitial = parts.length > 2 ? parts.slice(1, -1).join(' ').charAt(0).toUpperCase() : undefined

  return { firstName, middleInitial, lastName }
}

function fullName(person: { firstName: string; middleInitial?: string; lastName: string }) {
  return [person.firstName, person.middleInitial, person.lastName].filter(Boolean).join(' ')
}

async function createAdmin(payload: any, runId: string) {
  const isAutoLoginEnabled = process.env.PAYLOAD_ADMIN_AUTOLOGIN_ENABLED === 'true'
  const configuredEmail = process.env.PAYLOAD_ADMIN_AUTOLOGIN_EMAIL?.trim()
  const configuredPassword = process.env.PAYLOAD_ADMIN_AUTOLOGIN_PASSWORD?.trim()

  const email = isAutoLoginEnabled && configuredEmail ? configuredEmail : `e2e.admin.${runId}@example.com`
  const password = configuredPassword || 'StrongPass123!'
  const name = `E2E Admin ${runId}`

  const existing = await payload.find({
    collection: 'admins',
    where: {
      email: {
        equals: email,
      },
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    return {
      id: existing.docs[0].id,
      email,
      password,
      name: existing.docs[0].name || name,
      created: false,
    }
  }

  try {
    const admin = await payload.create({
      collection: 'admins',
      data: {
        name,
        email,
        password,
        role: 'admin',
      },
      req: {
        headers: {
          'X-Payload-Migration': 'true',
        },
      },
      overrideAccess: true,
    })

    return { id: admin.id, email, password, name, created: true }
  } catch (error) {
    // Parallel workers can race on autologin email creation. If another worker created it first,
    // resolve to the existing admin and continue.
    const racedExisting = await payload.find({
      collection: 'admins',
      where: {
        email: {
          equals: email,
        },
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })

    if (racedExisting.docs[0]) {
      return {
        id: racedExisting.docs[0].id,
        email,
        password,
        name: racedExisting.docs[0].name || name,
        created: false,
      }
    }

    throw error
  }
}

async function createReferralFixtures(payload: any, runId: string) {
  const employerRecipient = `employer.${runId}@example.com`
  const courtRecipient = `court.${runId}@example.com`

  const employer = await payload.create({
    collection: 'employers',
    data: {
      name: `E2E Employer ${runId}`,
      isActive: true,
      contacts: [{ name: 'Employer Contact', email: employerRecipient }],
    },
    overrideAccess: true,
  })

  const court = await payload.create({
    collection: 'courts',
    data: {
      name: `E2E Court ${runId}`,
      isActive: true,
      contacts: [{ name: 'Court Contact', email: courtRecipient }],
    },
    overrideAccess: true,
  })

  return {
    employer: { id: employer.id, name: employer.name, recipientEmail: employerRecipient },
    court: { id: court.id, name: court.name, recipientEmail: courtRecipient },
  }
}

async function createClient(payload: any, args: {
  runId: string
  fullName: string
  emailPrefix: string
  referralEmails: string[]
}): Promise<SeededPerson> {
  const parsed = parseFullName(args.fullName)
  const email = `${args.emailPrefix}.${args.runId}@example.com`

  const client = await payload.create({
    collection: 'clients',
    data: {
      firstName: parsed.firstName,
      middleInitial: parsed.middleInitial,
      lastName: parsed.lastName,
      email,
      password: 'StrongPass123!',
      gender: 'male',
      dob: '1990-01-15T00:00:00.000Z',
      phone: '2485550101',
      referralType: 'self',
      referralAdditionalRecipients: args.referralEmails.map((recipientEmail) => ({
        name: 'E2E Referral',
        email: recipientEmail,
      })),
      preferredContactMethod: 'email',
      disableClientEmails: false,
      _verified: true,
      medications: [
        {
          medicationName: 'Suboxone',
          startDate: '2020-01-01T00:00:00.000Z',
          status: 'active',
          detectedAs: ['buprenorphine'],
          requireConfirmation: false,
          createdAt: new Date().toISOString(),
        },
      ],
    },
    req: {
      user: {
        id: 'e2e-seed',
        collection: 'admins',
      },
    },
    overrideAccess: true,
  })

  return {
    id: client.id,
    firstName: parsed.firstName,
    middleInitial: parsed.middleInitial,
    lastName: parsed.lastName,
    fullName: fullName(parsed),
    email,
    referralRecipients: args.referralEmails,
  }
}

async function createSeedDrugTests(payload: any, clients: FixtureContext['clients']) {
  const labScreenCollected = await payload.create({
    collection: 'drug-tests',
    data: {
      relatedClient: clients.labScreen.id,
      testType: '11-panel-lab',
      collectionDate: new Date('2026-01-07T23:11:00-05:00').toISOString(),
      screeningStatus: 'collected',
      detectedSubstances: [],
      isDilute: false,
      processNotes: 'Seeded for e2e lab screen workflow',
    },
    overrideAccess: true,
  })

  const labConfirmPending = await payload.create({
    collection: 'drug-tests',
    data: {
      relatedClient: clients.labConfirm.id,
      testType: '11-panel-lab',
      collectionDate: new Date('2025-10-03T23:59:00-04:00').toISOString(),
      screeningStatus: 'confirmation-pending',
      detectedSubstances: ['fentanyl'],
      isDilute: false,
      confirmationDecision: 'request-confirmation',
      confirmationSubstances: ['fentanyl'],
      processNotes: 'Seeded for e2e lab confirmation workflow',
    },
    overrideAccess: true,
  })

  return {
    labScreenCollectedTestId: labScreenCollected.id,
    labConfirmPendingTestId: labConfirmPending.id,
  }
}

async function seedFixtures(): Promise<FixtureContext> {
  const payload = await getPayloadClient()
  const runId = toRunId()

  const created: FixtureContext['created'] = {
    adminIds: [],
    employerIds: [],
    courtIds: [],
    clientIds: [],
    drugTestIds: [],
    privateMediaIds: [],
  }

  const admin = await createAdmin(payload, runId)
  if ((admin as { created?: boolean }).created) {
    created.adminIds.push(admin.id)
  }

  const referrals = await createReferralFixtures(payload, runId)
  created.employerIds.push(referrals.employer.id)
  created.courtIds.push(referrals.court.id)

  const collectLab = await createClient(payload, {
    runId,
    fullName: 'E2E Collect Lab',
    emailPrefix: 'collect',
    referralEmails: [],
  })
  created.clientIds.push(collectLab.id)

  const instant = await createClient(payload, {
    runId,
    fullName: 'Shane G Sutherland',
    emailPrefix: 'instant',
    referralEmails: [`instant.ref.${runId}@example.com`],
  })
  created.clientIds.push(instant.id)

  const labScreen = await createClient(payload, {
    runId,
    fullName: 'Tom V Vachon',
    emailPrefix: 'labscreen',
    referralEmails: [`labscreen.ref.${runId}@example.com`],
  })
  created.clientIds.push(labScreen.id)

  const labConfirm = await createClient(payload, {
    runId,
    fullName: 'Tom V Vachon',
    emailPrefix: 'labconfirm',
    referralEmails: [`labconfirm.ref.${runId}@example.com`],
  })
  created.clientIds.push(labConfirm.id)

  const tests = await createSeedDrugTests(payload, {
    collectLab,
    instant,
    labScreen,
    labConfirm,
  })
  created.drugTestIds.push(tests.labScreenCollectedTestId)
  created.drugTestIds.push(tests.labConfirmPendingTestId)

  return {
    runId,
    admin,
    referrals,
    clients: {
      collectLab,
      instant,
      labScreen,
      labConfirm,
    },
    tests,
    created,
  }
}

function extractRelationId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

async function safeDelete(payload: any, collection: string, id: string) {
  try {
    await payload.delete({ collection, id, overrideAccess: true })
  } catch (_error) {
    // Best-effort cleanup.
  }
}

async function cleanupFixtures(ctx: FixtureContext | undefined): Promise<void> {
  if (!ctx?.created) {
    return
  }

  const payload = await getPayloadClient()
  const privateMediaIds = new Set<string>(ctx.created.privateMediaIds)

  for (const drugTestId of ctx.created.drugTestIds) {
    try {
      const test = await payload.findByID({
        collection: 'drug-tests',
        id: drugTestId,
        depth: 0,
        overrideAccess: true,
      })

      const testDocumentId = extractRelationId(test.testDocument)
      const confirmationDocumentId = extractRelationId(test.confirmationDocument)
      if (testDocumentId) privateMediaIds.add(testDocumentId)
      if (confirmationDocumentId) privateMediaIds.add(confirmationDocumentId)
    } catch (_error) {
      // Ignore missing tests.
    }
  }

  for (const clientId of ctx.created.clientIds) {
    try {
      const media = await payload.find({
        collection: 'private-media',
        where: {
          relatedClient: {
            equals: clientId,
          },
        },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })

      for (const doc of media.docs) {
        privateMediaIds.add(doc.id)
      }
    } catch (_error) {
      // Ignore media lookup failures.
    }
  }

  for (const testId of ctx.created.drugTestIds) {
    await safeDelete(payload, 'drug-tests', testId)
  }

  for (const mediaId of privateMediaIds) {
    await safeDelete(payload, 'private-media', mediaId)
  }

  for (const clientId of ctx.created.clientIds) {
    await safeDelete(payload, 'clients', clientId)
  }

  for (const employerId of ctx.created.employerIds) {
    await safeDelete(payload, 'employers', employerId)
  }

  for (const courtId of ctx.created.courtIds) {
    await safeDelete(payload, 'courts', courtId)
  }

  for (const adminId of ctx.created.adminIds) {
    await safeDelete(payload, 'admins', adminId)
  }
}

async function findClientByEmail(email: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'clients',
    where: {
      email: {
        equals: email,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] || null
}

async function deleteClientAndRelatedDataByEmail(email: string) {
  const payload = await getPayloadClient()
  const client = await findClientByEmail(email)
  if (!client) return { deleted: false }

  const testResult = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        equals: client.id,
      },
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const privateMediaIds = new Set<string>()
  for (const test of testResult.docs as Array<any>) {
    const testDocumentId = extractRelationId(test.testDocument)
    const confirmationDocumentId = extractRelationId(test.confirmationDocument)
    if (testDocumentId) privateMediaIds.add(testDocumentId)
    if (confirmationDocumentId) privateMediaIds.add(confirmationDocumentId)

    await safeDelete(payload, 'drug-tests', test.id)
  }

  const mediaResult = await payload.find({
    collection: 'private-media',
    where: {
      relatedClient: {
        equals: client.id,
      },
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  for (const media of mediaResult.docs) {
    privateMediaIds.add(media.id)
  }

  for (const mediaId of privateMediaIds) {
    await safeDelete(payload, 'private-media', mediaId)
  }

  await safeDelete(payload, 'clients', client.id)
  return { deleted: true }
}

async function getDrugTestById(testId: string) {
  const payload = await getPayloadClient()
  return payload.findByID({
    collection: 'drug-tests',
    id: testId,
    depth: 0,
    overrideAccess: true,
  })
}

async function findLatestDrugTestForClient(clientId: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'drug-tests',
    where: {
      relatedClient: {
        equals: clientId,
      },
    },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] || null
}

async function assertNotificationSent(args: {
  testId: string
  stage: 'collected' | 'screened' | 'complete'
  expectedIntendedEmails?: string[]
}) {
  const test = await getDrugTestById(args.testId)

  const notifications = (test.notificationsSent || []) as NotificationEntry[]
  const matching = notifications.filter((entry) => entry.stage === args.stage)

  assert(matching.length > 0, `Expected notificationsSent entry for stage "${args.stage}" on test ${args.testId}`)

  const latest = matching[matching.length - 1]
  assert(latest.status === 'sent', `Expected "sent" notification status for stage "${args.stage}" on test ${args.testId}`)

  if (args.expectedIntendedEmails && args.expectedIntendedEmails.length > 0) {
    const intended = latest.intendedRecipients || ''
    for (const email of args.expectedIntendedEmails) {
      assert(
        intended.toLowerCase().includes(email.toLowerCase()),
        `Expected intendedRecipients to contain ${email} for stage "${args.stage}" on test ${args.testId}`,
      )
    }
  }

  return test
}

async function validateAdminLogin(args: { email: string; password: string }) {
  const payload = await getPayloadClient()
  try {
    const result = await payload.login({
      collection: 'admins',
      data: {
        email: args.email,
        password: args.password,
      },
      overrideAccess: true,
    })

    return {
      ok: true,
      userId: result.user?.id || null,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const command = process.argv[2]
  const payloadArg = process.argv[3]
  const data = payloadArg ? JSON.parse(payloadArg) : undefined

  switch (command) {
    case 'seed-fixtures': {
      const result = await seedFixtures()
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'cleanup-fixtures': {
      await cleanupFixtures(data as FixtureContext)
      console.log(`__JSON__${JSON.stringify({ ok: true })}`)
      return
    }
    case 'find-client-by-email': {
      const result = await findClientByEmail(String(data?.email || ''))
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'delete-client-by-email': {
      const result = await deleteClientAndRelatedDataByEmail(String(data?.email || ''))
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'find-latest-drug-test-for-client': {
      const result = await findLatestDrugTestForClient(String(data?.clientId || ''))
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'get-drug-test-by-id': {
      const result = await getDrugTestById(String(data?.testId || ''))
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'assert-notification-sent': {
      const result = await assertNotificationSent(data as {
        testId: string
        stage: 'collected' | 'screened' | 'complete'
        expectedIntendedEmails?: string[]
      })
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    case 'validate-admin-login': {
      const result = await validateAdminLogin(data as { email: string; password: string })
      console.log(`__JSON__${JSON.stringify(result)}`)
      return
    }
    default:
      throw new Error(`Unknown db op command: ${command}`)
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
