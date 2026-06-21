import type { ServerComponentProps } from 'payload'
import { SyncRedwoodHeadshotButtonClient } from './SyncRedwoodHeadshotButton.client'

export default async function SyncRedwoodHeadshotButton({ id }: ServerComponentProps) {
  if (!id) {
    return null
  }

  return <SyncRedwoodHeadshotButtonClient clientId={String(id)} />
}
