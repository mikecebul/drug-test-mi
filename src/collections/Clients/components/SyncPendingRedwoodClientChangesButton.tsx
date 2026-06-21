import type { ServerComponentProps } from 'payload'

import { SyncPendingRedwoodClientChangesButtonClient } from './SyncPendingRedwoodClientChangesButton.client'

export default async function SyncPendingRedwoodClientChangesButton({ id }: ServerComponentProps) {
  if (!id) {
    return null
  }

  return <SyncPendingRedwoodClientChangesButtonClient clientId={String(id)} />
}
