/**
 * Shared types for registration recipient configurations
 */

/**
 * Recipient information for test results
 */
export interface RecipientInfo {
  readonly name: string
  readonly email: string
}

/**
 * Employer configuration with pre-configured recipients
 */
export interface EmployerConfig {
  readonly label: string
  readonly recipients: readonly RecipientInfo[]
}

/**
 * Court configuration with pre-configured recipients
 */
export interface CourtConfig {
  readonly label: string
  readonly recipients: readonly RecipientInfo[]
}
