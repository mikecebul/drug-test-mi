/**
 * Temporary styles file - only contains legacy styles for field groups
 * that haven't been refactored to use shared components yet.
 *
 * TODO: Remove this file once all field groups are refactored to use:
 * - WizardSection instead of wizardContainerStyles.content
 * - Direct className strings instead of wizardWrapperStyles
 */

export const wizardContainerStyles = {
  // Card padding - legacy, use WizardCard component instead
  card: 'p-4',

  // Main content spacing - legacy, use WizardSection component instead
  content: 'space-y-8',

  // Field group spacing - legacy
  fields: 'space-y-6',

  // Section spacing - legacy
  section: 'space-y-5',
} as const

export const wizardWrapperStyles = {
  // Main workflow wrapper - used by workflow files
  workflow: 'mx-auto flex max-w-lg flex-col pb-8 md:max-w-4xl lg:mx-auto lg:max-w-4xl',

  // Completion screen wrapper
  completion:
    'mx-auto my-32 flex max-w-sm flex-col items-center md:max-w-2xl lg:mx-auto lg:max-w-4xl',

  // Section spacing for header
  header: 'mb-8',

  // Section spacing for stepper
  stepper: 'mb-8',
} as const
