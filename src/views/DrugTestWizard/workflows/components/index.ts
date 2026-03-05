/**
 * Shared Workflow Components
 *
 * These components are reusable across different workflows with consistent theming:
 * - ClientInfoCard: Neutral theme (info) - displays client details
 * - HeadshotCaptureCard: Editable client info with custom camera/upload + crop headshot flow
 * - MedicationDisplayField: Warning theme - alerts about expected positive substances
 * - FieldGroupHeader: Standard header for form sections
 */

export { ClientInfoCard } from './client/ClientInfoCard'
export { HeadshotCaptureCard } from './client/HeadshotCaptureCard'
export { FieldGroupHeader } from './FieldGroupHeader'
export { default as MedicationDisplayField } from '@/views/DrugTestWizard/workflows/components/medications/medication-display-field'
