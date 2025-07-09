'use client'

import type { DefaultCellComponentProps } from 'payload'

function RoleCell({ cellData }: DefaultCellComponentProps) {
  switch (cellData) {
    case 'superAdmin':
      return 'Super Admin'
    case 'admin':
      return 'Admin'
    case 'admin':
      return 'Admin'
    case 'editor':
      return 'Editor'
    case 'user':
      return 'User'
  }
}

export default RoleCell
