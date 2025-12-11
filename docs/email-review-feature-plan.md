# Email Review Feature - Implementation Plan

## Overview

Add a 6th step to the PDF upload wizard for reviewing and approving emails before sending. This also includes enhanced email history management in the Payload admin panel.

## Feature Requirements

### Wizard Step 6: Email Review
- Show full HTML email previews for all recipients
- Allow opting out individual emails (marked as 'unsent' in history)
- Allow full editing of recipients (add/remove/edit email addresses)
- Smart grouping:
  - **Probation/Employment**: Separate client and referral sections
  - **Self-pay**: Combined section (client receives referral email)
- Create test first, then send approved emails
- Email failures create admin alerts
- Track complete email history (all sends, resends, opt-outs with timestamps)

### Payload Collection Enhancements
- Add resend/preview buttons next to notification history entries
- Group notifications by stage (collected, screened, complete, inconclusive)
- Track sent vs unsent emails
- Allow resending originally unapproved emails

## Architecture: Pragmatic Balance Approach

### Key Design Decisions

**Email Send Timing**: Use existing `skipNotificationHook` context flag, add manual trigger in Step 6
- **Trade-off**: Fast implementation using existing patterns vs full refactor
- **Justification**: Existing hook system works well, just needs control layer

**Email Preview Storage**: Generate previews client-side, store final sent emails in enhanced `notificationsSent`
- **Trade-off**: Hybrid approach - ephemeral previews with permanent history
- **Justification**: No need to store unsent emails, only track what was actually sent

**Recipient Management**: Full recipient editor with validation
- **Trade-off**: Quality over speed for this component
- **Justification**: Bad email addresses cause critical support issues

**Email History Tracking**: Enhance existing array structure
- **Trade-off**: Fast schema extension vs new collection
- **Justification**: Backwards compatible, no migration needed

## Components Overview

### 1. RecipientEditor Component
**File**: `/src/components/views/PDFUploadWizard/components/RecipientEditor.tsx`

**Responsibilities**:
- Display list of email addresses with add/remove buttons
- Validate email format on blur
- Show diff indicators (added/removed from original)
- Support comma-separated paste
- Export clean email array

**Validation**:
- Email format (RFC 5322 simplified)
- No duplicates
- Required validation for probation/employment clients

### 2. EmailPreviewModal Component
**File**: `/src/components/views/PDFUploadWizard/components/EmailPreviewModal.tsx`

**Responsibilities**:
- Display full HTML email in iframe (sandboxed)
- Show email metadata (subject, recipients, stage)
- Security: Use `sandbox="allow-same-origin"` to prevent XSS

### 3. ReviewEmailsFieldGroup Component
**File**: `/src/components/views/PDFUploadWizard/field-groups/ReviewEmailsFieldGroup.tsx`

**Responsibilities**:
- Fetch email preview data via server action
- Display smart-grouped recipient lists
- Show preview buttons for client and referral emails
- Handle opt-out checkboxes
- Submit approved email configuration

**Smart Grouping Logic**:
- Probation/Employment: Show separate "Client Email" and "Referral Emails" sections
- Self-pay: Show single "Your Email" section (client is in referral list)

### 4. NotificationHistoryField Component
**File**: `/src/collections/DrugTests/components/NotificationHistoryField.tsx`

**Responsibilities**:
- Custom Payload field for notification history
- Group notifications by stage
- Show status badges (sent/failed/opted-out)
- Add "Preview" and "Resend" buttons per entry

### 5. ResendEmailModal Component
**File**: `/src/collections/DrugTests/components/ResendEmailModal.tsx`

**Responsibilities**:
- Modal for resending notifications
- Pre-fill with original recipients (editable)
- Email preview
- Send action that updates history

## Server Actions

### 1. getEmailPreview
**File**: `/src/components/views/PDFUploadWizard/actions.ts`

**Purpose**: Generate email preview data for Step 6

**Process**:
1. Fetch client and medications
2. Compute test results (reuse `computeTestResultPreview`)
3. Call `getRecipients()` for smart grouping
4. Generate email HTML using `buildScreenedEmail()` template
5. Return recipients and HTML previews

**Returns**:
```typescript
{
  clientEmail: string
  referralEmails: string[]
  clientHtml: string
  referralHtml: string
  smartGrouping: 'separate' | 'combined'
}
```

### 2. createDrugTestWithEmailReview
**File**: `/src/components/views/PDFUploadWizard/actions.ts`

**Purpose**: Create drug test and send approved emails

**Process**:
1. Create drug test with `skipNotificationHook: true`
2. Build email content using existing templates
3. Send emails to approved recipients (skip opted-out)
4. Update `notificationsSent` history with detailed tracking
5. Create admin alerts for failures

**Parameters**:
```typescript
{
  testData: { /* normal creation params */ }
  emailConfig: {
    clientEmailEnabled: boolean
    clientRecipients: string[]
    referralEmailEnabled: boolean
    referralRecipients: string[]
  }
}
```

### 3. resendNotification
**File**: `/src/collections/DrugTests/actions/resendNotification.ts`

**Purpose**: Resend notification for specific stage

**Process**:
1. Fetch drug test data
2. Regenerate email HTML for that stage
3. Send to specified recipients
4. Add new entry to notification history
5. Create admin alert if fails

## Enhanced Notification History Schema

**Location**: `/src/collections/DrugTests/index.ts` (lines 513-548)

**New Fields**:
```typescript
{
  name: 'notificationsSent',
  type: 'array',
  fields: [
    // Existing fields
    { name: 'stage', type: 'select' },
    { name: 'sentAt', type: 'date' },
    { name: 'recipients', type: 'textarea' },

    // NEW fields
    { name: 'status', type: 'select', options: ['sent', 'failed', 'opted-out'] },
    { name: 'optedOutBy', type: 'text' }, // 'wizard' or 'manual-resend'
    { name: 'originalRecipients', type: 'textarea' }, // track computed vs edited
    { name: 'errorMessage', type: 'textarea' }, // for failed sends
  ]
}
```

## Data Flow

### Wizard Email Review Flow

```
Step 5 (Confirm) Submit
  ↓
Advance to Step 6 (Review Emails)
  ↓
Step 6 mounts → calls getEmailPreview(clientId, testData)
  → Server fetches client
  → Calls getRecipients() → { clientEmail, referralEmails }
  → Calls buildScreenedEmail() → { client: {...}, referrals: {...} }
  → Returns preview data
  ↓
UI displays:
  - RecipientEditor (pre-filled with computed values)
  - Preview buttons for client/referral emails
  - Opt-out checkboxes
  ↓
User actions:
  - Edit recipient lists
  - Preview full HTML in modal
  - Opt out emails via checkboxes
  ↓
User clicks "Create Drug Test & Send Emails"
  ↓
Calls createDrugTestWithEmailReview(testData, emailConfig)
  → Creates drug test with skipNotificationHook: true
  → Sends approved emails to edited recipient lists
  → Updates notificationsSent with full details
  → Returns { testId, emailResults }
  ↓
Redirect to /admin/collections/drug-tests/{testId}
```

### Payload Admin Resend Flow

```
Admin views Drug Test → Notification History tab
  ↓
Each notification shows:
  - Stage badge
  - Status (sent/failed/opted-out)
  - Recipients list
  - Preview + Resend buttons
  ↓
Admin clicks "Resend" on notification
  ↓
Opens ResendEmailModal
  - Pre-fills with original recipients (editable)
  - Shows current status
  - Preview button available
  ↓
Admin edits recipients (optional) → Clicks "Resend"
  ↓
Calls resendNotification(testId, stage, recipients)
  → Fetches drug test
  → Regenerates email HTML for stage
  → Sends emails
  → Adds new entry to notificationsSent
    - status: 'sent'/'failed'
    - optedOutBy: 'manual-resend'
  → Returns results
  ↓
Modal closes, history refreshes
```

## Implementation Phases

### Phase 1: Core Email Preview Components
**Files to Create**:
- `/src/components/views/PDFUploadWizard/components/RecipientEditor.tsx`
- `/src/components/views/PDFUploadWizard/components/EmailPreviewModal.tsx`
- `/src/components/views/PDFUploadWizard/field-groups/ReviewEmailsFieldGroup.tsx`

**Files to Modify**:
- `/src/components/views/PDFUploadWizard/schemas/pdfUploadSchemas.ts` (add Step 6 schema)

**Test**: Step 6 loads, shows previews, recipient editing works

### Phase 2: Email Control and Server Actions
**Files to Modify**:
- `/src/components/views/PDFUploadWizard/actions.ts` (add getEmailPreview, createDrugTestWithEmailReview)
- `/src/components/views/PDFUploadWizard/use-pdf-upload-form-opts.ts` (use new action)

**Test**: Wizard creates test without auto-sending, sends only approved emails

### Phase 3: Wizard Integration
**Files to Modify**:
- `/src/components/views/PDFUploadWizard/PDFUploadWizardClient.tsx` (add Step 6)

**Test**: Full wizard flow works end-to-end

### Phase 4: Enhanced Notification History
**Files to Modify**:
- `/src/collections/DrugTests/index.ts` (enhance notificationsSent schema)

**Test**: History tracks new fields correctly

### Phase 5: Payload UI Resend Features
**Files to Create**:
- `/src/collections/DrugTests/components/NotificationHistoryField.tsx`
- `/src/collections/DrugTests/components/ResendEmailModal.tsx`
- `/src/collections/DrugTests/actions/resendNotification.ts`

**Files to Modify**:
- `/src/collections/DrugTests/index.ts` (wire custom field component)

**Test**: Admin can preview, resend, history updates correctly

## Key Trade-offs Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email Infrastructure | Keep hook-based, add control | Leverage existing tested code |
| Preview Storage | Client-side generation | No need to persist unsent emails |
| Recipient Editing | Full editor with validation | Prevent critical email delivery errors |
| History Schema | Extend existing array | Backwards compatible, no migration |
| UI Components | Quality modals/editors | Small scope, prevents future UX debt |

## Migration & Rollout

**Backwards Compatibility**:
- Existing notification history entries work unchanged (new fields optional)
- Existing hook continues for manual admin test creation
- No data migration needed

**Rollout Strategy**:
1. Deploy Phases 1-3 (wizard enhancement)
2. Monitor email send success rates
3. Deploy Phases 4-5 (Payload UI)
4. Train admins on resend feature

**Rollback Plan**:
- Remove Step 6 from wizard (revert to 5 steps)
- Existing tests work with auto-send hook
- No data cleanup required

## Security Considerations

- **Email preview iframe**: Use `sandbox` attribute to prevent XSS
- **Recipient validation**: Server-side email format validation before sending
- **Access control**: Resend action uses Payload admin auth
- **Input sanitization**: Email addresses validated, HTML previews escaped

## Testing Strategy

**Unit Tests**:
- Test `getEmailPreview()` with various client types (probation/employment/self)
- Test RecipientEditor validation logic
- Test smart grouping logic

**Integration Tests**:
- Test wizard flow end-to-end (mock email sending)
- Test resend from Payload admin
- Test opt-out scenarios

**Manual Tests**:
- Create test via wizard with edited recipients
- Verify history shows correct data
- Test email failures create admin alerts
- Test all three client types (probation, employment, self)

## Implementation Estimate

**Total Time**: 2-3 days

- Phase 1: 4 hours
- Phase 2: 4 hours
- Phase 3: 2 hours
- Phase 4: 2 hours
- Phase 5: 4 hours
- Testing & Polish: 4 hours

## Success Criteria

✅ Wizard has 6 steps with email review
✅ Admins can edit recipients before sending
✅ Full HTML email previews work
✅ Opt-out functionality tracks correctly
✅ Email failures create admin alerts
✅ Notification history shows complete audit trail
✅ Resend feature works from Payload admin
✅ Smart grouping works for all client types
✅ No regressions in existing auto-send flow
