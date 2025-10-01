/**
 * Ecommerce plugin access control functions
 * These functions match the existing access control patterns used throughout the application
 */

export { adminOnly } from './adminOnly'
export { adminOnlyFieldAccess } from './adminOnlyFieldAccess'
export { adminOrCustomerOwner } from './adminOrCustomerOwner'
export { adminOrPublishedStatus } from './adminOrPublishedStatus'
export { customerOnlyFieldAccess } from './customerOnlyFieldAccess'
