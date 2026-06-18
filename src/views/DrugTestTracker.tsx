import React from 'react'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter, SetStepNav } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { DrugTestTrackerClient, type DrugTest } from './DrugTestTrackerClient'
import { redirect } from 'next/dist/client/components/navigation'

type TrackerLoadResult = {
  error: string | null
  tests: DrugTest[]
}

function getRelatedClient(test: unknown): DrugTest['relatedClient'] | null {
  if (!test || typeof test !== 'object' || !('relatedClient' in test)) return null

  const relatedClient = (test as { relatedClient?: unknown }).relatedClient
  if (!relatedClient || typeof relatedClient !== 'object') return null

  return {
    id: 'id' in relatedClient && typeof relatedClient.id === 'string' ? relatedClient.id : '',
    firstName:
      'firstName' in relatedClient && typeof relatedClient.firstName === 'string' ? relatedClient.firstName : '',
    lastName: 'lastName' in relatedClient && typeof relatedClient.lastName === 'string' ? relatedClient.lastName : '',
    email: 'email' in relatedClient && typeof relatedClient.email === 'string' ? relatedClient.email : '',
  }
}

function toTrackerTest(doc: unknown): DrugTest | null {
  if (!doc || typeof doc !== 'object') return null
  const test = doc as {
    collectionDate?: unknown
    confirmationDecision?: unknown
    confirmationResults?: unknown
    confirmationSubstances?: unknown
    id?: unknown
    initialScreenResult?: unknown
    isComplete?: unknown
    processNotes?: unknown
    testType?: unknown
    unexpectedPositives?: unknown
  }
  const relatedClient = getRelatedClient(doc)

  if (!relatedClient || !test.id || typeof test.id !== 'string') return null

  return {
    id: test.id,
    relatedClient,
    collectionDate: typeof test.collectionDate === 'string' ? test.collectionDate : '',
    testType: typeof test.testType === 'string' ? test.testType : '',
    initialScreenResult: typeof test.initialScreenResult === 'string' ? test.initialScreenResult : undefined,
    confirmationDecision: typeof test.confirmationDecision === 'string' ? test.confirmationDecision : undefined,
    confirmationResults: Array.isArray(test.confirmationResults)
      ? test.confirmationResults
          .filter((result): result is { result?: string; substance: string } => {
            return Boolean(
              result && typeof result === 'object' && 'substance' in result && typeof result.substance === 'string',
            )
          })
          .map((result) => ({
            substance: result.substance,
            result: typeof result.result === 'string' ? result.result : undefined,
          }))
      : undefined,
    confirmationSubstances: Array.isArray(test.confirmationSubstances)
      ? test.confirmationSubstances.filter((substance): substance is string => typeof substance === 'string')
      : undefined,
    unexpectedPositives: Array.isArray(test.unexpectedPositives)
      ? test.unexpectedPositives.filter((substance): substance is string => typeof substance === 'string')
      : undefined,
    isComplete: test.isComplete === true,
    processNotes: typeof test.processNotes === 'string' ? test.processNotes : undefined,
  }
}

async function loadIncompleteDrugTests(
  initPageResult: AdminViewServerProps['initPageResult'],
): Promise<TrackerLoadResult> {
  try {
    const result = await initPageResult.req.payload.find({
      collection: 'drug-tests',
      where: {
        isComplete: {
          equals: false,
        },
      },
      depth: 1,
      limit: 100,
      sort: '-collectionDate',
      req: initPageResult.req,
      overrideAccess: false,
    })

    return {
      error: null,
      tests: result.docs.map(toTrackerTest).filter((test): test is DrugTest => Boolean(test)),
    }
  } catch (error) {
    initPageResult.req.payload.logger.error({ err: error, msg: 'Failed to load incomplete drug tests' })

    return {
      error: 'Unable to load incomplete drug tests. Please refresh and try again.',
      tests: [],
    }
  }
}

export default async function DrugTestTracker({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const navItem = [
    {
      label: 'Drug Test Tracker',
      url: '/drug-test-tracker',
    },
  ]

  const user = initPageResult.req?.user
  if (!user || user?.collection !== 'admins') {
    redirect('/admin/login')
  }

  const { error, tests } = await loadIncompleteDrugTests(initPageResult)

  return (
    <DefaultTemplate
      i18n={initPageResult.req?.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req?.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req?.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <SetStepNav nav={navItem} />
      <Gutter>
        <DrugTestTrackerClient initialError={error} initialTests={tests} />
      </Gutter>
    </DefaultTemplate>
  )
}
