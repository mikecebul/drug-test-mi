import type { ServerComponentProps } from 'payload'

import { QueueRedwoodUniqueIdBackfillButtonClient } from './QueueRedwoodUniqueIdBackfillButton.client'

export default async function QueueRedwoodUniqueIdBackfillButton({ id }: ServerComponentProps) {
  if (!id) {
    return null
  }

  return <QueueRedwoodUniqueIdBackfillButtonClient clientId={String(id)} />
}
