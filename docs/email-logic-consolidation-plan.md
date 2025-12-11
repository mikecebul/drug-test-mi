# Email Logic Consolidation - Implementation Plan

## Problem Statement

The email notification system has significant duplication between two code paths:
1. **Collection Hook** (`sendNotificationEmails.ts`) - Automatic emails when drug test records change
2. **PDF Upload Wizard** (`PDFUploadWizard/actions.ts`) - Manual email preview and sending

**Duplicated Logic (~420 lines total):**
- Test result computation (comparing detected substances with medications)
- Final status determination after confirmation testing
- PDF document retrieval from S3/local storage
- Email sending with attachments and error handling

## Solution: Service Layer Architecture

Create a new `/src/collections/DrugTests/services/` directory with focused, reusable functions that both the hook and wizard can call.

## New Files to Create

### 1. `/src/collections/DrugTests/services/testResults.ts`
**Exports:**
- `computeTestResults(params)` - Compare detected substances with client medications, classify as expected/unexpected/critical
- `computeFinalStatus(confirmationResults)` - Determine final pass/fail status after confirmation testing
- `applyBreathalyzerOverride(result, breathalyzerData)` - Override test result if breathalyzer positive

**Replaces:**
- `computeTestResultPreview()` in wizard (lines 354-478 of actions.ts)
- Inline computation in `computeTestResults` hook (lines 71-162 of hooks/computeTestResults.ts)
- Final status logic in wizard (lines 814-860 of actions.ts)

### 2. `/src/collections/DrugTests/services/documentFetch.ts`
**Exports:**
- `fetchDocument(documentId, payload)` - Retrieve PDF from private-media collection (handles S3 and local disk transparently)

**Returns:** `{ buffer: Buffer, filename: string, mimeType: string }` or throws error

**Replaces:**
- PDF fetch in hook (lines 418-586 of sendNotificationEmails.ts)
- PDF fetch in wizard (lines 1076-1127 of actions.ts)

### 3. `/src/collections/DrugTests/services/emailSender.ts`
**Exports:**
- `sendEmailsWithAttachment(params)` - Send emails to multiple recipients with PDF attachment
- `sendEmailsWithoutAttachment(params)` - Send emails to multiple recipients (no attachment)
- Handles TEST_MODE routing, error recovery, admin alert creation

**Replaces:**
- Email sending loop in hook (lines 478-588 of sendNotificationEmails.ts)
- Email sending loop in wizard (lines 1129-1217 of actions.ts)

### 4. `/src/collections/DrugTests/services/emailData.ts`
**Exports:**
- `prepareEmailData(stage, drugTest, payload)` - Orchestrate all data gathering for email:
  - Fetch client and recipients
  - Fetch headshot
  - Compute test results if needed
  - Build email HTML using template builders
  - Return complete email package

**Returns:**
```typescript
{
  clientEmail: string,
  referralEmails: string[],
  clientEmailData: { subject: string, html: string },
  referralEmailData: { subject: string, html: string }
}
```

### 5. `/src/collections/DrugTests/services/index.ts`
Barrel export for all service functions.

## Files to Modify

### Critical Files (Major Changes)

1. **`/src/collections/DrugTests/hooks/sendNotificationEmails.ts`**
   - Replace PDF fetch with `fetchDocument()` service (~60 lines removed)
   - Replace email sending with `sendEmailsWithAttachment()` service (~110 lines removed)
   - Use `prepareEmailData()` for data gathering (~40 lines removed)
   - **Line reduction:** ~210 lines (645 → ~435)

2. **`/src/collections/DrugTests/hooks/computeTestResults.ts`**
   - Replace inline computation with `computeTestResults()` service (~90 lines removed)
   - Keep database write logic
   - **Line reduction:** ~90 lines (278 → ~188)

3. **`/src/components/views/PDFUploadWizard/actions.ts`**
   - Remove `computeTestResultPreview()` function (~125 lines removed)
   - Replace with `computeTestResults()` service calls
   - Replace PDF fetch with `fetchDocument()` service (~52 lines removed)
   - Replace email loops with `sendEmailsWithAttachment()` service (~88 lines removed)
   - Use `computeFinalStatus()` service for confirmation results (~47 lines removed)
   - **Line reduction:** ~312 lines (1,813 → ~1,501)

### Supporting Files (Minor Updates)

4. **`/src/collections/DrugTests/helpers/classifyTestResult.ts`**
   - Use as reference pattern for service structure (already well-factored)
   - No changes needed

5. **`/src/collections/DrugTests/email/templates.ts`**
   - No changes needed (already properly shared)

6. **`/src/collections/DrugTests/email/recipients.ts`**
   - No changes needed (already properly shared)

7. **`/src/collections/DrugTests/email/fetch-headshot.ts`**
   - No changes needed (already properly shared)

## Implementation Sequence

### Step 1: Create Service Layer (No Breaking Changes)
- Create `/src/collections/DrugTests/services/` directory
- Implement all 5 service files
- Extract logic from existing code into services
- Add TypeScript types for service parameters/returns
- **Validation:** Services compile without errors, types are correct

### Step 2: Update computeTestResults Hook
- Import `computeTestResults()` from services
- Replace lines 71-162 with service call
- Keep database write logic intact
- Test: Verify test computation still works correctly

### Step 3: Update sendNotificationEmails Hook
- Import `fetchDocument()` and `sendEmailsWithAttachment()` services
- Replace PDF fetch logic (lines 418-586) with service call
- Replace email sending logic (lines 478-588) with service call
- Keep notification tracking and admin alert logic
- Test: Verify emails send with attachments correctly

### Step 4: Update PDF Upload Wizard
- Import all service functions
- Replace `computeTestResultPreview()` calls with `computeTestResults()`
- Replace final status computation with `computeFinalStatus()`
- Replace PDF fetch with `fetchDocument()`
- Replace email sending loops with `sendEmailsWithAttachment()`
- Test: Verify wizard email preview and sending still works

### Step 5: Cleanup and Documentation
- Delete unused `computeTestResultPreview()` function
- Update comments referencing old code locations
- Add JSDoc comments to service functions
- Update CLAUDE.md if email architecture has changed

## Testing Strategy

### Unit Testing (Optional - Future Enhancement)
- Each service function is independently testable
- Mock Payload SDK for database operations
- Mock S3Client for document fetching

### Integration Testing (Required)
1. **Test computeTestResults Hook:**
   - Create test with detected substances
   - Verify expected/unexpected classification matches client medications
   - Verify breathalyzer override logic

2. **Test sendNotificationEmails Hook:**
   - Create test with PDF document
   - Transition to "screened" status
   - Verify emails sent with attachment
   - Verify admin alerts on failure

3. **Test PDF Wizard:**
   - Upload PDF through wizard
   - Preview emails in Step 6
   - Verify data matches what collection hook would send
   - Send emails and verify delivery

4. **Test Edge Cases:**
   - Client with no medications (all substances unexpected)
   - Client with no headshot (email renders without image)
   - Document fetch fails (verify error handling)
   - Email send fails (verify admin alerts)

### Regression Testing
- Test all 4 email stages: collected, screened, complete, inconclusive
- Test both client types: probation, employment, self
- Test both storage modes: S3 (if available) and local disk
- Test EMAIL_TEST_MODE functionality

## Success Metrics

- **Code reduction:** ~420 lines of duplication eliminated
- **Single source of truth:** Test computation, document fetching, email sending
- **Maintainability:** Future email changes only need updates in one place
- **Reusability:** Services can be used for future features (manual resend, batch processing)
- **Zero regression:** All existing email functionality works identically

## Risk Mitigation

1. **Breaking changes:** Services are additions, not replacements initially - can test thoroughly before migration
2. **Behavior changes:** Extract exact logic without modifications - refactor structure, not behavior
3. **Testing coverage:** Comprehensive integration tests verify no regressions
4. **Rollback plan:** Git commit after each step allows easy rollback if issues arise

## Estimated Effort

- Service layer creation: ~8 hours
- Hook updates: ~7 hours
- Wizard updates: ~6 hours
- Testing and validation: ~5 hours
- **Total: ~26 hours (~3.5 days)**

## Future Enhancements (Not in Scope)

- Unit tests for service functions
- Email queue system for retry logic
- Audit logging for email delivery
- Custom email template system
- Batch email sending for multiple tests
