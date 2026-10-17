import Link from 'next/link'
import type { DocumentViewServerProps, Where } from 'payload'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCollectionDate, formatDobInput } from '@/lib/date-utils'
import { getTestTypeLabel, TEST_TYPES } from '@/config/test-types'
import { Input } from '@/components/ui/input'
import { extractPreferredTestType } from '@/lib/quick-book'
import { getAdminQuickBookCalLink } from '@/utilities/calcom-config'
import { formatSubstances } from '@/lib/substances'
import { getRecipients } from '@/collections/DrugTests/email/recipients'
import { isTestBilledToReferral } from '@/lib/referral-invoices/payer'
import { CollectClientTestButton } from '@/views/staff/CollectClientTestButton'
import { QuickBookButtonClient } from '../components/QuickBookButton.client'
import { clientBalances, clientName, headshotUrl, historyResult, money } from '@/views/staff/summary-helpers'

export default async function ClientSummaryView({
  doc,
  payload,
  initPageResult,
  searchParams,
}: DocumentViewServerProps) {
  const req = initPageResult.req
  if (req.user?.collection !== 'admins' || !doc.id) return null
  const client = await payload.findByID({ collection: 'clients', id: doc.id, depth: 1, req, overrideAccess: false })
  const id = client.id
  const editHref = `/admin/collections/clients/${id}`
  const page = Math.max(1, Number(searchParams?.historyPage) || 1)
  const search = typeof searchParams?.historySearch === 'string' ? searchParams.historySearch.trim() : ''
  const filter = typeof searchParams?.historyType === 'string' ? searchParams.historyType : ''
  const matchingTypes = TEST_TYPES.filter((type) => type.label.toLowerCase().includes(search.toLowerCase())).map(
    (type) => type.value,
  )
  const historyWhere: Where = {
    and: [
      { relatedClient: { equals: id } },
      ...(search ? [{ testType: { in: matchingTypes.length ? matchingTypes : ['no-matching-test-type'] } }] : []),
      ...(TEST_TYPES.some((type) => type.value === filter) ? [{ testType: { equals: filter } }] : []),
    ],
  }
  const historyHref = (nextPage: number) =>
    `${editHref}/summary?${new URLSearchParams({ historyPage: String(nextPage), historySearch: search, historyType: filter })}`
  const [balances, history, recipients] = await Promise.all([
    clientBalances(payload, id, req),
    payload.find({
      collection: 'drug-tests',
      where: historyWhere,
      page,
      limit: 10,
      sort: '-collectionDate',
      depth: 1,
      req,
      overrideAccess: false,
    }),
    getRecipients(id, payload),
  ])
  const referral = client.referral?.value && typeof client.referral.value === 'object' ? client.referral.value : null
  const recommendation = extractPreferredTestType(referral?.preferredTestType)
  const rows = await Promise.all(
    history.docs.map(async (test) => ({
      test,
      result: historyResult(test),
      referralPays: await isTestBilledToReferral(payload, test, req),
    })),
  )
  const notifications = [
    ...(client.disableClientEmails ? [] : [recipients.clientEmail]),
    ...recipients.referralEmails,
  ].filter(Boolean)
  return (
    <ShadcnWrapper className="staff-interface staff-summary mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start gap-4 border-b pb-5">
        <Avatar className="size-20 shrink-0 rounded-lg sm:size-24">
          <AvatarImage src={headshotUrl(client)} alt={clientName(client)} />
          <AvatarFallback className="rounded-lg">
            {client.firstName[0]}
            {client.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{clientName(client)}</h1>
          <p className="text-sm">DOB {client.dob ? formatDobInput(client.dob) : 'Not recorded'}</p>
          <p className="text-sm">Referral {referral?.name || 'Self'}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={`mailto:${client.email}`}>{client.email}</a>
            {client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}
          </div>
        </div>
        <Button size="sm" variant="outline" render={<Link href={editHref} />} nativeButton={false}>
          Edit client
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <CollectClientTestButton clientId={id} />
            <QuickBookButtonClient
              clientName={clientName(client)}
              clientEmail={client.email}
              clientPhone={client.phone || undefined}
              clientGender={client.gender || undefined}
              recommendedTestTypeId={recommendation.recommendedTestTypeId}
              recommendedTestTypeValue={recommendation.recommendedTestTypeValue || client.defaultTestType || undefined}
              calLink={getAdminQuickBookCalLink({ referralType: client.referralType, referralName: referral?.name })}
            />
            <Button
              variant="outline"
              render={<Link href={`/admin/collect-payment?clientId=${id}`} />}
              nativeButton={false}
            >
              Collect Payment
            </Button>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Balances</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            {[
              ['Client balance', balances.clientBalance],
              ['Account credit', client.creditBalance || 0],
              ['Referral owes', balances.referralBalance],
            ].map(([label, amount]) => (
              <div key={label}>
                <p
                  className="text-muted-foreground text-sm"
                  title={
                    label === 'Referral owes'
                      ? 'Unpaid test charges assigned to the referral, including tests awaiting invoicing.'
                      : undefined
                  }
                >
                  {label}
                </p>
                <p className="text-xl font-semibold">{money.format(Number(amount))}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card size="sm">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Current medications</CardTitle>
            <Link href={editHref} className="text-primary text-sm">
              Edit medications
            </Link>
          </CardHeader>
          <CardContent>
            {client.medications
              ?.filter((med) => med.status === 'active')
              .map((med) => (
                <p key={med.id || med.medicationName} className="text-sm">
                  <strong>{med.medicationName}</strong> · configured expectation:{' '}
                  {formatSubstances(med.detectedAs || []) || 'None'}
                </p>
              ))}
            {!client.medications?.some((med) => med.status === 'active') && (
              <p className="text-muted-foreground text-sm">No active medications.</p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Result notification recipients</CardTitle>
            <Link href={editHref} className="text-primary text-sm">
              Edit recipients
            </Link>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{notifications.join(' · ') || 'No recipients configured.'}</p>
          </CardContent>
        </Card>
      </div>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Test history</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={`${editHref}/summary`} className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              name="historySearch"
              aria-label="Search test types"
              placeholder="Search test types…"
              defaultValue={search}
              className="w-full sm:max-w-xs"
            />
            <select
              name="historyType"
              aria-label="Filter test history"
              defaultValue={filter}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">All tests</option>
              {TEST_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filter
            </Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                {['Date', 'Test', 'Initial screen / final status', 'Payer', 'Balance', 'Report'].map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ test, result, referralPays }) => (
                <TableRow key={test.id}>
                  <TableCell>{formatCollectionDate(test.collectionDate || test.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/collections/drug-tests/${test.id}/summary`} className="text-primary">
                      {getTestTypeLabel(test.testType)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={result.variant}>{result.label}</Badge>
                    <p className="text-muted-foreground mt-1 text-xs">{result.status}</p>
                  </TableCell>
                  <TableCell>{referralPays ? 'Referral' : 'Client'}</TableCell>
                  <TableCell>{money.format(test.payment?.balanceDue || 0)}</TableCell>
                  <TableCell>
                    {result.report && typeof result.report === 'object' && result.report.url ? (
                      <a href={result.report.url} target="_blank" rel="noopener noreferrer" className="text-primary">
                        View report
                      </a>
                    ) : (
                      'Not available'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <p className="text-muted-foreground py-4 text-sm">No tests collected yet.</p>}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span>
              {history.totalDocs} tests · Page {history.page} of {history.totalPages || 1}
            </span>
            <div className="flex gap-3">
              {history.hasPrevPage && <Link href={historyHref(page - 1)}>Previous</Link>}
              {history.hasNextPage && <Link href={historyHref(page + 1)}>Next</Link>}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">Payments</p>
            <p className="text-muted-foreground text-sm">View all payments for this client.</p>
          </div>
          <Link href={`/admin/collections/payments?where[relatedClient][equals]=${id}`} className="text-primary">
            Payment history →
          </Link>
        </CardContent>
      </Card>
    </ShadcnWrapper>
  )
}
