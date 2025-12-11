// Document fetching service
export { fetchDocument } from './documentFetch'
export type { FetchDocumentResult } from './documentFetch'

// Test result computation services
export { computeTestResults, computeFinalStatus } from './testResults'
export type {
  TestType,
  InitialScreenResult,
  FinalStatus,
  ComputeTestResultsParams,
  ComputeTestResultsResult,
  ConfirmationResult,
  ComputeFinalStatusParams,
} from './testResults'

// Email sending service
export { sendEmails } from './emailSender'
export type {
  EmailContent,
  EmailAttachment,
  SendEmailsParams,
  SendEmailsResult,
} from './emailSender'

// Email data preparation utilities
export {
  fetchRecipients,
  fetchHeadshot,
  fetchClientData,
  buildCollectedEmailData,
  buildScreenedEmailData,
  buildCompleteEmailData,
  buildInconclusiveEmailData,
} from './emailData'
export type { EmailStage, EmailDataResult } from './emailData'
