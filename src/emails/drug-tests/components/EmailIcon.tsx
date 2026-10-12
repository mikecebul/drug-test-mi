import { Img } from '@react-email/components'
import * as React from 'react'
import { getServerSideURL } from '@/utilities/getURL'

export type EmailIconName =
  | 'circle-alert-red'
  | 'circle-check-green'
  | 'circle-alert-amber'
  | 'circle-minus-gray'
  | 'clock-amber'
  | 'circle-check-gray'
  | 'file-text-gray'

/** Rasterized Lucide assets preserve the same 24px icon geometry in email and previews. */
export function EmailIcon({ name, inline = false }: { name: EmailIconName; inline?: boolean }) {
  return (
    <Img
      src={`${getServerSideURL().replace(/\/$/, '')}/email-icons/${name}.png`}
      alt=""
      role="presentation"
      aria-hidden="true"
      width={24}
      height={24}
      style={{ display: inline ? 'inline-block' : 'block', verticalAlign: 'middle', marginRight: inline ? '8px' : '0' }}
    />
  )
}
