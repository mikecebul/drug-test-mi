'use client'

import React from 'react'
import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'

export default function BookingTrackerLink() {
  const { user } = useAuth()

  // Only show to admins
  if (!user || user.collection !== 'admins') {
    return null
  }

  return <Link href="/admin/booking-tracker">Booking Tracker</Link>
}
