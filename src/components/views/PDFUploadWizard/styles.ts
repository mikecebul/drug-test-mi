/**
 * Centralized styling utilities for PDF Upload Wizard
 * Provides consistent spacing, padding, and container widths across all wizard components
 */

export const wizardContainerStyles = {
  // Card padding - up from p-6 (+33%)
  card: 'p-4',

  // Main content spacing - up from space-y-6 (+33%)
  content: 'space-y-8',

  // Field group spacing - up from space-y-4 (+50% for better field separation)
  fields: 'space-y-6',

  // Section spacing - up from space-y-4 (+25%)
  section: 'space-y-5',
} as const

export const wizardWidthStyles = {
  // For single column forms
  narrow: 'max-w-2xl mx-auto',

  // For most content (default)
  standard: 'max-w-4xl mx-auto',

  // For multi-column layouts
  wide: 'max-w-6xl mx-auto',
} as const

export const wizardWrapperStyles = {
  // Main workflow wrapper - matches PDFUploadWizardClient pattern
  workflow: 'mx-auto flex max-w-lg flex-col pb-8 md:max-w-4xl lg:mx-auto lg:max-w-4xl',

  // Completion screen wrapper
  completion:
    'mx-auto my-32 flex max-w-sm flex-col items-center md:max-w-2xl lg:mx-auto lg:max-w-4xl',

  // Section spacing for header
  header: 'mb-8',

  // Section spacing for stepper
  stepper: 'mb-8',
} as const
