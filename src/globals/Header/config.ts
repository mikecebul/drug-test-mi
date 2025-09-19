import { link } from '@/fields/link'
import { revalidateHeader } from './hooks/revalidateHeader'
import { admins } from '@/access/admins'
import type { GlobalConfig } from 'payload'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: admins,
    update: admins,
  },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      admin: {
        components: {
          RowLabel: '@/fields/link/LinkRowLabel',
        },
      },
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
}
