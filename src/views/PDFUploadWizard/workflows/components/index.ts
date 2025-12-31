/**
 * Shared Workflow Components
 *
 * These components are reusable across different workflows with consistent theming:
 * - ClientInfoCard: Neutral theme (info) - displays client details
 * - MedicationDisplayField: Warning theme - alerts about expected positive substances
 * - FieldGroupHeader: Standard header for form sections
 */

export { ClientInfoCard } from './client/ClientInfoCard'
export { FieldGroupHeader } from './FieldGroupHeader'
export { default as MedicationDisplayField } from '@/views/PDFUploadWizard/workflows/components/medications/medication-display-field'
