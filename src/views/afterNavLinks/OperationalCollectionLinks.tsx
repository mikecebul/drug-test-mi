'use client'

import Link from 'next/link'
import { useAuth } from '@payloadcms/ui'
import { isSuperAdminUser } from '@/plugins/staffNavigation'

export default function OperationalCollectionLinks() {
  const { user } = useAuth()
  if (!isSuperAdminUser(user)) return null
  return (
    <div className="nav-group">
      <div className="nav-group__label">Operations</div>
      <div className="nav-group__content">
        {[
          ['bookings', 'Bookings'],
          ['drug-tests', 'Drug Tests'],
          ['payments', 'Payments'],
          ['private-media', 'Private Media'],
        ].map(([slug, label]) => (
          <Link key={slug} href={`/admin/collections/${slug}`} className="nav__link">
            <span className="nav__link-label">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
