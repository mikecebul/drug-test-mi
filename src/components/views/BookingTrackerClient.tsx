'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@payloadcms/ui'
import { sendRegistrationInvitation } from './actions/sendRegistrationInvitation'

interface Booking {
  id: string
  attendeeName: string
  attendeeEmail: string
  startTime: string
  endTime: string
  isPrepaid: boolean
  relatedClient?: {
    id: string
    firstName: string
    lastName: string
  } | null
}

interface Client {
  id: string
  firstName: string
  lastName: string
  email: string
}

export function BookingTrackerClient() {
  const [unlinkedBookings, setUnlinkedBookings] = useState<Booking[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const bookingsResponse = await fetch(
          '/api/bookings?where[relatedClient][exists]=false&depth=1&limit=100&sort=-startTime',
        )
        const bookingsData = await bookingsResponse.json()

        const clientsResponse = await fetch('/api/clients?limit=1000&sort=-createdAt')
        const clientsData = await clientsResponse.json()

        setUnlinkedBookings(bookingsData.docs || [])
        setClients(clientsData.docs || [])
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load bookings')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleLinkClient = async (bookingId: string, clientId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedClient: clientId }),
      })

      if (!response.ok) throw new Error('Failed to link client')

      toast.success('Client linked to booking successfully')
      setUnlinkedBookings((prev) => prev.filter((b) => b.id !== bookingId))
    } catch (error) {
      console.error('Error linking client:', error)
      toast.error('Failed to link client to booking')
    }
  }

  const handleSendInvitation = async (email: string, name: string) => {
    try {
      const result = await sendRegistrationInvitation(email, name)

      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation')
    }
  }

  const filteredBookings = unlinkedBookings.filter(
    (booking) =>
      booking.attendeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.attendeeEmail.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const findMatchingClients = (email: string) => {
    return clients.filter((c) => c.email.toLowerCase() === email.toLowerCase())
  }

  if (loading) {
    return <div>Loading unlinked bookings...</div>
  }

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      {filteredBookings.length === 0 ? (
        <p>{searchTerm ? 'No bookings match your search.' : 'No unlinked bookings found.'}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredBookings.map((booking) => {
            const matchingClients = findMatchingClients(booking.attendeeEmail)
            const hasMatchingClient = matchingClients.length > 0

            return (
              <div
                key={booking.id}
                style={{
                  border: '1px solid var(--theme-elevation-200)',
                  padding: '1rem',
                  borderRadius: '4px',
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem 0' }}>
                  {booking.attendeeName}
                  {booking.isPrepaid && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        background: 'var(--theme-success-500)',
                        color: 'white',
                        borderRadius: '12px',
                      }}
                    >
                      Prepaid
                    </span>
                  )}
                </h3>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--theme-elevation-600)' }}>
                  {booking.attendeeEmail}
                </p>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem' }}>
                  <strong>Appointment:</strong>{' '}
                  {new Date(booking.startTime).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>

                {hasMatchingClient ? (
                  <div
                    style={{
                      background: 'var(--theme-success-100)',
                      border: '1px solid var(--theme-success-300)',
                      padding: '1rem',
                      borderRadius: '4px',
                      marginBottom: '1rem',
                    }}
                  >
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', fontWeight: '500' }}>
                      Matching client account found:
                    </p>
                    {matchingClients.map((client) => (
                      <div
                        key={client.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--theme-elevation-0)',
                          padding: '0.75rem',
                          borderRadius: '4px',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '500' }}>
                            {client.firstName} {client.lastName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--theme-elevation-600)' }}>
                            {client.email}
                          </div>
                        </div>
                        <Button
                          buttonStyle="primary"
                          size="small"
                          onClick={() => handleLinkClient(booking.id, client.id)}
                        >
                          Link Client
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      background: 'var(--theme-warning-100)',
                      border: '1px solid var(--theme-warning-300)',
                      padding: '1rem',
                      borderRadius: '4px',
                      marginBottom: '1rem',
                    }}
                  >
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem' }}>
                      No registered client account found for this email.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button
                        buttonStyle="secondary"
                        size="small"
                        onClick={() => handleSendInvitation(booking.attendeeEmail, booking.attendeeName)}
                      >
                        Send Registration Invite
                      </Button>
                      <Button
                        buttonStyle="secondary"
                        size="small"
                        onClick={() =>
                          window.open(
                            `/admin/collections/clients?where[email][equals]=${booking.attendeeEmail}`,
                            '_blank',
                          )
                        }
                      >
                        Create Client Manually
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  buttonStyle="secondary"
                  size="small"
                  onClick={() => window.open(`/admin/collections/bookings/${booking.id}`, '_blank')}
                >
                  Edit Booking
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
