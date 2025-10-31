# Inconclusive Test Result Implementation Plan

## Problem Statement

When lab test samples are invalid (leaked during transport, damaged, or otherwise unable to produce results), the system currently has an `isInconclusive` checkbox but it doesn't properly complete the test or trigger notifications. This causes tests to remain stuck in "pending" status indefinitely in both the admin panel and client dashboard.

## Current Issues

1. **`isInconclusive` checkbox exists but is underutilized** (src/collections/DrugTests/index.ts:84-91)
   - Manual checkbox in sidebar
   - Hides `initialScreenResult` and `finalStatus` fields when checked
   - Does NOT trigger completion or send emails

2. **`computeTestResults` hook doesn't handle `isInconclusive`** (src/collections/DrugTests/hooks/computeTestResults.ts)
   - Tests in "collected" status are set to `isComplete = false` and return early
   - If `isInconclusive` is checked, the test never progresses beyond "collected"
   - Lab tests marked inconclusive show as "pending" forever

3. **No dedicated inconclusive email templates**
   - Email templates have inconclusive label support
   - But no email template to notify parties of invalid sample

4. **No admin UI warning**
   - Easy to accidentally mark test as inconclusive
   - No confirmation or visual warning

## Solution Overview

Make inconclusive a valid completion state that:

- Automatically completes the test workflow
- Triggers email notifications to client and referral
- Shows appropriate status in admin and client views
- Has clear warnings to prevent accidental marking

## Implementation Tasks

### 1. Update `computeTestResults.ts` Hook

**File**: `src/collections/DrugTests/hooks/computeTestResults.ts`

Add logic at the beginning (after line 28) to detect and complete inconclusive tests:

```typescript
// Handle inconclusive tests FIRST - skip all other computation
if (data.isInconclusive) {
  data.screeningStatus = 'complete'
  data.isComplete = true
  data.initialScreenResult = undefined // Clear any computed result
  data.finalStatus = 'inconclusive'
  return data
}
```

**Why**: This ensures inconclusive tests move to "complete" status and trigger the notification system.

### 2. Create Inconclusive Email Template

**File**: `src/collections/DrugTests/email/templates.ts`

Add new `buildInconclusiveEmail()` function after `buildCollectedEmail()`:

```typescript
export interface InconclusiveEmailData {
  clientName: string
  collectionDate: string
  testType: string
  reason?: string // Optional reason for inconclusive result
}

/**
 * Inconclusive Test Email
 * Sent when a test sample is invalid and cannot be screened
 */
export function buildInconclusiveEmail(data: InconclusiveEmailData): EmailOutput {
  const { clientName, collectionDate, testType, reason } = data

  const clientEmail = {
    subject: `Drug Test - Inconclusive Result - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Test Inconclusive</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #f59e0b; }
            .cta-button { display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; text-align: center; }
            .button-container { text-align: center; margin: 25px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Test Inconclusive</h1>
            </div>
            <div class="content">
              <div class="warning-box">
                <p style="margin: 0; font-weight: bold;">Your drug test sample could not be screened.</p>
                <p style="margin: 10px 0 0 0;">The sample was invalid and unable to produce test results. ${reason ? `Reason: ${reason}` : 'This may occur if the sample leaked during transport, was damaged, or was otherwise compromised.'}</p>
              </div>

              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>

              <p>A new test will need to be scheduled to obtain valid results. Please contact MI Drug Test to schedule a replacement test.</p>

              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results" class="cta-button">View Test History</a>
              </div>

              <div class="footer">
                <p><strong>Please call us to schedule a replacement test.</strong></p>
                <p><small>This is an automated notification from MI Drug Test.</small></p>
                <p><small>Notification sent: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  const referralEmail = {
    subject: `Drug Test - Inconclusive Result - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Test Inconclusive</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #f59e0b; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Test Inconclusive</h1>
            </div>
            <div class="content">
              <div class="warning-box">
                <p style="margin: 0; font-weight: bold;">Drug test sample could not be screened.</p>
                <p style="margin: 10px 0 0 0;">The sample was invalid and unable to produce test results. ${reason ? `Reason: ${reason}` : 'This may occur if the sample leaked during transport, was damaged, or was otherwise compromised.'}</p>
              </div>

              <div class="detail-row">
                <span class="label">Client:</span> ${clientName}
              </div>
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>

              <p><strong>Action Required:</strong> A new test will need to be scheduled for this client to obtain valid results.</p>

              <div class="footer">
                <p><strong>This test is marked as complete with an inconclusive result.</strong></p>
                <p><small>This is an automated notification from MI Drug Test.</small></p>
                <p><small>Notification sent: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  return {
    client: clientEmail,
    referrals: referralEmail,
  }
}
```

**Why**: Both client and referral need to know the test was invalid and a new one must be scheduled.

### 3. Update `sendNotificationEmails.ts` Hook

**File**: `src/collections/DrugTests/hooks/sendNotificationEmails.ts`

Add inconclusive email stage detection (around line 68):

```typescript
// Stage: Inconclusive (sample invalid - cannot be screened)
else if (doc.isInconclusive && !sentStages.has('inconclusive')) {
  emailStage = 'inconclusive'
}
```

Update email building logic (around line 150):

```typescript
if (emailStage === 'collected') {
  // ... existing code
} else if (emailStage === 'inconclusive') {
  const emails = buildInconclusiveEmail({
    clientName,
    collectionDate: doc.collectionDate!,
    testType: doc.testType,
    reason: doc.processNotes || undefined, // Optional reason from process notes
  })
  clientEmailData = emails.client
  referralEmailData = emails.referrals
} else if (emailStage === 'screened') {
  // ... existing code
}
```

Update email sending logic for inconclusive (around line 194):

```typescript
// For "collected" and "inconclusive" stages, send notification without attachment
if (emailStage === 'collected' || emailStage === 'inconclusive') {
  // Send to client
  if (emailStage === 'inconclusive' && clientEmailData && clientEmail) {
    // ... send client email
  }

  // Send to referrals
  if (referralEmailData && referralEmails.length > 0) {
    // ... send referral emails
  }
}
```

**Why**: Inconclusive emails don't need test document attachments - just notification that sample was invalid.

### 4. Update Admin UI Warning

**File**: `src/collections/DrugTests/index.ts`

Update the `isInconclusive` field (line 84):

```typescript
{
  name: 'isInconclusive',
  type: 'checkbox',
  admin: {
    description:
      '⚠️ CRITICAL WARNING: Check this ONLY if the sample is INVALID (leaked during transport, damaged, or unable to produce results). This will immediately mark the test as COMPLETE with an INCONCLUSIVE result and send notification emails to client and referral. A new test must be scheduled.',
    position: 'sidebar',
    // Consider adding custom component with confirmation dialog
    components: {
      Field: '@/components/InconclusiveCheckboxWithConfirmation', // Optional: custom component
    },
  },
}
```

**Why**: Clear warning prevents accidental marking. The description emphasizes this is a final action.

### 5. Update Email Types

**File**: `src/collections/DrugTests/email/types.ts`

Add InconclusiveEmailData type:

```typescript
export interface InconclusiveEmailData {
  clientName: string
  collectionDate: string
  testType: string
  reason?: string
}
```

Update emailStage type to include 'inconclusive':

```typescript
type EmailStage = 'collected' | 'screened' | 'complete' | 'inconclusive'
```

## Testing Checklist

After implementation, test the following scenarios:

- [ ] Create a lab test in "collected" status
- [ ] Check the "isInconclusive" checkbox and save
- [ ] Verify `screeningStatus` changes to "complete"
- [ ] Verify `isComplete` is set to `true`
- [ ] Verify `finalStatus` is set to "inconclusive"
- [ ] Verify email is sent to client with inconclusive notification
- [ ] Verify email is sent to referral with inconclusive notification
- [ ] Check notification history shows "inconclusive" stage
- [ ] Verify test shows as "Inconclusive" in client dashboard results view
- [ ] Verify test shows as complete in admin panel (not stuck in pending)
- [ ] Verify no duplicate emails are sent on subsequent saves
- [ ] Test with `EMAIL_TEST_MODE=true` to verify emails

## Key Benefits

✅ **Inconclusive becomes a valid completion state** - not stuck in pending
✅ **Automatic email notifications** - both client and referral are informed
✅ **Clear in admin** - warning prevents accidental marking
✅ **Proper tracking** - shows in results view correctly
✅ **Audit trail** - notification history records it
✅ **Workflow completion** - test is properly closed out

## Files Modified

1. `src/collections/DrugTests/hooks/computeTestResults.ts` - Handle inconclusive early
2. `src/collections/DrugTests/email/templates.ts` - Add inconclusive email template
3. `src/collections/DrugTests/email/types.ts` - Add inconclusive types
4. `src/collections/DrugTests/hooks/sendNotificationEmails.ts` - Send inconclusive emails
5. `src/collections/DrugTests/index.ts` - Update admin UI warning

## Notes

- Inconclusive tests are a RESULT, not a pending state
- They represent tests that cannot be completed due to sample issues
- A new test must be scheduled to get valid results
- The email templates should be clear about this being an invalid sample
