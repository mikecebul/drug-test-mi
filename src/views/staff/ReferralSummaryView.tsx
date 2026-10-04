import Link from 'next/link'
import type { DocumentViewServerProps, Where } from 'payload'
import { ShadcnWrapper } from '@/components/ShadcnWrapper'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getTestTypeLabel } from '@/config/test-types'
import { formatCollectionDate, formatDobInput } from '@/lib/date-utils'
import { clientBalances, clientName, headshotUrl, historyResult, money } from './summary-helpers'

export default async function ReferralSummaryView({
  doc,
  payload,
  initPageResult,
  searchParams,
}: DocumentViewServerProps) {
  const req = initPageResult.req
  const slug = initPageResult.collectionConfig?.slug
  if (req.user?.collection !== 'admins' || !doc.id || (slug !== 'courts' && slug !== 'employers')) return null
  const referral = await payload.findByID({ collection: slug, id: doc.id, depth: 0, req, overrideAccess: false })
  const editHref = `/admin/collections/${slug}/${referral.id}`
  const page = Math.max(1, Number(searchParams?.clientsPage) || 1)
  const where: Where = {
    and: [{ 'referral.relationTo': { equals: slug } }, { 'referral.value': { equals: referral.id } }],
  }
  const clients = await payload.find({
    collection: 'clients',
    where,
    page,
    limit: 10,
    sort: 'lastName',
    depth: 1,
    req,
    overrideAccess: false,
  })
  const allClientIds: string[] = []
  for (let p = 1; ; p++) {
    const result = await payload.find({
      collection: 'clients',
      where,
      page: p,
      limit: 100,
      depth: 0,
      select: { firstName: true },
      req,
      overrideAccess: false,
    })
    allClientIds.push(...result.docs.map((client) => client.id))
    if (!result.hasNextPage) break
  }
  const awaiting = allClientIds.length
    ? await payload.count({
        collection: 'drug-tests',
        where: { and: [{ relatedClient: { in: allClientIds } }, { screeningStatus: { equals: 'collected' } }] },
        req,
        overrideAccess: false,
      })
    : { totalDocs: 0 }
  const rows = await Promise.all(
    clients.docs.map(async (client) => {
      const [tests, bookings, balance] = await Promise.all([
        payload.find({
          collection: 'drug-tests',
          where: { relatedClient: { equals: client.id } },
          sort: '-collectionDate',
          limit: 1,
          depth: 0,
          req,
          overrideAccess: false,
        }),
        payload.find({
          collection: 'bookings',
          where: {
            and: [
              { relatedClient: { equals: client.id } },
              { status: { equals: 'confirmed' } },
              { startTime: { greater_than_equal: new Date().toISOString() } },
            ],
          },
          sort: 'startTime',
          limit: 1,
          depth: 0,
          req,
          overrideAccess: false,
        }),
        clientBalances(payload, client.id, req),
      ])
      return { client, test: tests.docs[0], booking: bookings.docs[0], balance }
    }),
  )
  return (
    <ShadcnWrapper className="staff-interface staff-summary mx-auto flex max-w-6xl flex-col gap-6 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{referral.name}</h1>
        <Badge variant="outline">{slug === 'courts' ? 'Court' : 'Employer'}</Badge>
        <Badge variant={referral.isActive ? 'success' : 'warning'}>{referral.isActive ? 'Active' : 'Inactive'}</Badge>
        <Button className="ml-auto" render={<Link href={editHref} />} nativeButton={false}>
          Edit referral
        </Button>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Preferred test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-semibold">
              {referral.preferredTestType ? getTestTypeLabel(referral.preferredTestType) : 'Not configured'}
            </p>
            <p className="border-t pt-3 text-sm">Monthly invoicing {referral.isBillable ? 'enabled' : 'disabled'}</p>
            <p className="text-muted-foreground text-sm">
              {referral.isBillable
                ? 'Default payer: referral. Staff can choose client payment for individual tests.'
                : 'Clients pay for their tests.'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Result notification contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {referral.contacts?.map((contact) => (
              <div key={contact.id || contact.email}>
                <p className="text-sm font-medium">{contact.name || 'Recipient'}</p>
                <a href={`mailto:${contact.email}`} className="text-primary text-sm">
                  {contact.email}
                </a>
              </div>
            ))}
            <Link href={editHref} className="text-primary text-sm">
              Edit contacts
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Billing email</p>
            <p className="mt-1 text-sm">{referral.billingEmail || 'Not configured'}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <strong className="text-3xl">{clients.totalDocs}</strong>
            <span>linked clients</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <strong className="text-3xl">{awaiting.totalDocs}</strong>
            <span>tests awaiting results</span>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mb-4 text-xl font-semibold">Clients</h2>
        <Table>
          <TableHeader>
            <TableRow>
              {['Client', 'Next appointment', 'Client balance', 'Current test', 'Status', ''].map((label, i) => (
                <TableHead key={i}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ client, test, booking, balance }) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-14 rounded-md">
                      <AvatarImage src={headshotUrl(client)} alt={clientName(client)} />
                      <AvatarFallback>
                        {client.firstName[0]}
                        {client.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        className="text-primary font-medium"
                        href={`/admin/collections/clients/${client.id}/summary`}
                      >
                        {clientName(client)}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        DOB {client.dob ? formatDobInput(client.dob) : 'Not recorded'}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{booking ? formatCollectionDate(booking.startTime) : 'None scheduled'}</TableCell>
                <TableCell>
                  <Badge variant={balance.clientBalance > 0 ? 'warning' : 'success'}>
                    {money.format(balance.clientBalance)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {test ? (
                    <>
                      <p>{getTestTypeLabel(test.testType)}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatCollectionDate(test.collectionDate || test.createdAt)}
                      </p>
                    </>
                  ) : (
                    'No tests yet'
                  )}
                </TableCell>
                <TableCell>
                  {test ? <Badge variant={historyResult(test).variant}>{historyResult(test).label}</Badge> : '—'}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/admin/collections/clients/${client.id}/summary`} />}
                    nativeButton={false}
                  >
                    View client
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="text-muted-foreground py-4 text-sm">No clients linked to this referral.</p>}
        <div className="mt-4 flex justify-between text-sm">
          <span>
            Page {clients.page} of {clients.totalPages || 1}
          </span>
          <div className="flex gap-3">
            {clients.hasPrevPage && <Link href={`${editHref}/summary?clientsPage=${page - 1}`}>Previous</Link>}
            {clients.hasNextPage && <Link href={`${editHref}/summary?clientsPage=${page + 1}`}>Next</Link>}
          </div>
        </div>
      </div>
    </ShadcnWrapper>
  )
}
