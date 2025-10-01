import type { Access, FieldAccess } from 'payload'

// Limited to only admin users
export const adminOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  return user.collection === 'admins'
}

// Limited to only admin users, specifically for Field level access control
export const adminOnlyFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false
  return user.collection === 'admins'
}

// Is the owner of the document via the customer field or is an admin
export const adminOrCustomerOwner: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admins can access everything
  if (user.collection === 'admins') {
    return true
  }

  // Clients (customers) can only access their own records
  if (user.collection === 'clients') {
    return {
      customer: {
        equals: user.id,
      },
    }
  }

  return false
}

// The document is published or user is admin
export const adminOrPublishedStatus: Access = ({ req: { user } }) => {
  if (user && user.collection === 'admins') {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}

// Limited to customers only, specifically for Field level access control
export const customerOnlyFieldAccess: FieldAccess = ({ req: { user } }) => {
  if (!user) return false
  return user.collection === 'clients'
}
