# React Email Migration Plan

## Overview
Migrate drug test email templates from raw HTML string generation to React Email components for better maintainability, Outlook compatibility (no `object-fit`), and preview capabilities with `pnpm email`.

## User Preferences
- ✅ Remove `react-email-starter/` after migration
- ✅ Run `pnpm email` from root to preview `src/emails/`
- ✅ Separate components for client vs referral emails
- ✅ Outlook testing available (not critical, but good starting point)

## Architecture Decision
**Integrate React Email into main project at `src/emails/drug-tests/`**

**Key Principle**: Only replace the template generation layer. The service layer (emailSender, documentFetch, emailData, testResults) remains unchanged.

## File Structure

```
src/emails/
├── drug-tests/                          # NEW: Drug test email templates
│   ├── CollectedEmail.tsx               # Lab sample collected (referrals only)
│   ├── ScreenedEmail.tsx                # Screening results (client version)
│   ├── ScreenedEmailReferral.tsx        # Screening results (referral version)
│   ├── CompleteEmail.tsx                # Final results (client version)
│   ├── CompleteEmailReferral.tsx        # Final results (referral version)
│   ├── InconclusiveEmail.tsx            # Invalid sample (client version)
│   ├── InconclusiveEmailReferral.tsx    # Invalid sample (referral version)
│   ├── components/                      # Shared UI components
│   │   ├── ClientIdentity.tsx           # Headshot + name + DOB
│   │   ├── ResultBadge.tsx              # Color-coded result badge
│   │   ├── SubstancesSection.tsx        # Substance breakdown list
│   │   ├── BreathalyzerResult.tsx       # BAC level display
│   │   ├── ConfirmationSection.tsx      # Confirmation test results
│   │   ├── EmailLayout.tsx              # Shared layout wrapper
│   │   └── DetailRow.tsx                # Label-value row
│   └── utils/                           # Utilities
│       ├── formatters.ts                # Date/DOB/substance formatters
│       ├── constants.ts                 # Color maps, result labels
│       └── styles.ts                    # Shared inline styles
├── notification.tsx                     # EXISTING: Contact form emails
└── static/                              # NEW: Email assets
    └── mi-drug-test-logo.png            # Company logo
```

## Implementation Steps

### 1. Setup Email Preview (30 min)

**Add to `package.json` scripts:**
```json
"email": "email dev --dir src/emails",
"email:export": "email export --dir src/emails"
```

**Test:**
```bash
pnpm email
# Should open localhost:3000 showing notification.tsx
```

### 2. Create Utilities Layer (1 hour)

**Create `src/emails/drug-tests/utils/formatters.ts`:**
- Extract from `templates.ts:10-91`:
  - `formatDate()` - Format collection dates
  - `formatDob()` - Format date of birth
  - `formatTestType()` - Map test types to display names
  - `formatSubstance()` - Map substance keys to readable names

**Create `src/emails/drug-tests/utils/constants.ts`:**
- Extract from `templates.ts:42-62`:
  - `RESULT_COLORS` - Color map for result types
  - `RESULT_LABELS` - Display labels for results
  - `TEST_TYPE_MAP` - Test type display names
  - `SUBSTANCE_MAP` - Substance display names

**Create `src/emails/drug-tests/utils/styles.ts`:**
- Common inline styles for email components
- Outlook-compatible styling patterns (no `object-fit`, table-based)

### 3. Build Shared Components (3 hours)

**Create `src/emails/drug-tests/components/EmailLayout.tsx`:**
- Wrapper with `<Html>`, `<Head>`, `<Body>`, `<Container>`
- Company branding header
- Footer with timestamp
- Props: `preview: string`, `children: ReactNode`

**Create `src/emails/drug-tests/components/ClientIdentity.tsx`:**
- Props: `headshotDataUri?: string`, `name: string`, `dob?: string`
- Display client headshot (Base64 data URI) as square image (no `border-radius` for Outlook)
- Show name and DOB if available
- Use `<Img>` component from `@react-email/components`

**Create `src/emails/drug-tests/components/ResultBadge.tsx`:**
- Props: `result: string`
- Color-coded badge using `RESULT_COLORS` and `RESULT_LABELS`
- Use `<Section>` with background color (Outlook-compatible)

**Create `src/emails/drug-tests/components/SubstancesSection.tsx`:**
- Props: `substances: Array<{name: string, category: string}>`
- Display substance lists with colored borders
- Categories: expected-positive, unexpected-positive, unexpected-negative, confirmed-negative

**Create `src/emails/drug-tests/components/BreathalyzerResult.tsx`:**
- Props: `bac?: number`, `result?: string`
- Display BAC level with pass/fail indicator
- Color-coded based on result

**Create `src/emails/drug-tests/components/ConfirmationSection.tsx`:**
- Props: `confirmationResults: Array<{substance: string, result: string}>`
- Display confirmation test results
- Show final status for each substance

**Create `src/emails/drug-tests/components/DetailRow.tsx`:**
- Props: `label: string`, `value: string`
- Simple label-value pair with consistent styling

**All components:**
- Use TypeScript with proper type definitions
- Import types from `@/collections/DrugTests/email/types`
- Use inline styles only (Outlook compatibility)
- Include `PreviewProps` for `pnpm email` development

### 4. Build Email Templates (4 hours)

**Each template follows this pattern:**
```tsx
import { EmailLayout, ClientIdentity, ResultBadge } from './components'
import type { ScreenedEmailData } from '@/collections/DrugTests/email/types'

export function ScreenedEmail(data: ScreenedEmailData) {
  return (
    <EmailLayout preview={`Drug Test Results - ${data.clientName}`}>
      <ClientIdentity
        headshotDataUri={data.clientHeadshotDataUri}
        name={data.clientName}
        dob={data.clientDob}
      />
      {/* Template-specific content */}
    </EmailLayout>
  )
}

ScreenedEmail.PreviewProps = {
  clientName: 'John Doe',
  // ... mock data for preview
} satisfies ScreenedEmailData
```

**Create these 7 templates:**

1. **CollectedEmail.tsx** (referrals only)
   - Reference: `templates.ts:611-765`
   - Shows: collection date, test type, breathalyzer if available
   - Only sent to referrals (no client version)

2. **ScreenedEmail.tsx** (client version)
   - Reference: `templates.ts:141-448`
   - Shows: full results, dashboard link, confirmation testing option
   - Features: substance breakdown, dilute warnings, color-coded badges

3. **ScreenedEmailReferral.tsx** (referral version)
   - Reference: `templates.ts:450-609`
   - Shows: full results with client context
   - No dashboard link, no confirmation testing info

4. **CompleteEmail.tsx** (client version)
   - Reference: `templates.ts:767-937`
   - Shows: confirmation test results, final status
   - Dashboard link to view complete report

5. **CompleteEmailReferral.tsx** (referral version)
   - Reference: `templates.ts:939-1075`
   - Shows: confirmation results with client context
   - No dashboard link

6. **InconclusiveEmail.tsx** (client version)
   - Reference: `templates.ts:100-210`
   - Shows: invalid sample warning, reschedule instructions
   - Dashboard link to reschedule

7. **InconclusiveEmailReferral.tsx** (referral version)
   - Reference: `templates.ts:212-318`
   - Shows: invalid sample notification with client context
   - No reschedule link

**Key Implementation Notes:**
- Use `@react-email/components` primitives: `Html`, `Head`, `Body`, `Container`, `Section`, `Text`, `Img`, `Button`, `Preview`
- All images as `<Img>` with explicit width/height (no `object-fit`)
- Use table-based layouts for complex structures (Outlook compatibility)
- Import formatters from `utils/formatters.ts`
- Import constants from `utils/constants.ts`
- Import shared styles from `utils/styles.ts`

### 5. Create Render Layer (1 hour)

**Create `src/collections/DrugTests/email/render.ts`:**

```typescript
import { render } from '@react-email/components'
import {
  CollectedEmail,
  ScreenedEmail,
  ScreenedEmailReferral,
  CompleteEmail,
  CompleteEmailReferral,
  InconclusiveEmail,
  InconclusiveEmailReferral,
} from '@/emails/drug-tests'
import type {
  CollectedEmailData,
  ScreenedEmailData,
  CompleteEmailData,
  InconclusiveEmailData,
  EmailOutput,
} from './types'

export function buildCollectedEmail(data: CollectedEmailData): EmailOutput {
  const html = render(<CollectedEmail {...data} />)
  return {
    subject: `Drug Test Sample Collected - ${data.clientName}`,
    html,
  }
}

export function buildScreenedEmail(data: ScreenedEmailData): EmailOutput {
  const clientHtml = render(<ScreenedEmail {...data} />)
  const referralHtml = render(<ScreenedEmailReferral {...data} />)

  return {
    client: {
      subject: `Drug Test Results - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Drug Test Results - ${data.clientName}`,
      html: referralHtml,
    },
  }
}

export function buildCompleteEmail(data: CompleteEmailData): EmailOutput {
  const clientHtml = render(<CompleteEmail {...data} />)
  const referralHtml = render(<CompleteEmailReferral {...data} />)

  return {
    client: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Final Drug Test Results - ${data.clientName}`,
      html: referralHtml,
    },
  }
}

export function buildInconclusiveEmail(data: InconclusiveEmailData): EmailOutput {
  const clientHtml = render(<InconclusiveEmail {...data} />)
  const referralHtml = render(<InconclusiveEmailReferral {...data} />)

  return {
    client: {
      subject: `Drug Test - Action Required - ${data.clientName}`,
      html: clientHtml,
    },
    referrals: {
      subject: `Drug Test - Invalid Sample - ${data.clientName}`,
      html: referralHtml,
    },
  }
}
```

**Critical**: Function signatures match `templates.ts` exactly - no changes to service layer required.

### 6. Update Import Statements (15 min)

**Update 3 files to import from `render.ts` instead of `templates.ts`:**

1. **`src/collections/DrugTests/services/emailData.ts`**
   - Line 6-9: Change import path
   ```typescript
   // OLD:
   import { buildScreenedEmail, ... } from '../email/templates'

   // NEW:
   import { buildScreenedEmail, ... } from '../email/render'
   ```

2. **`src/collections/DrugTests/hooks/sendNotificationEmails.ts`**
   - Change import path (same pattern as above)

3. **`src/components/views/PDFUploadWizard/actions.ts`**
   - Lines 522-523, 946: Change import path

**No function call changes** - only import paths update.

### 7. Testing (2-3 hours)

**Preview Testing:**
```bash
pnpm email
# Verify all 7 templates render at localhost:3000
# Check client headshots, badges, substance lists
```

**TEST_MODE Email Sends:**
```bash
# Set in .env:
EMAIL_TEST_MODE=true

# Trigger all email types through the app:
# 1. Collected stage
# 2. Screened stage (with/without breathalyzer)
# 3. Complete stage (with confirmation results)
# 4. Inconclusive stage

# Verify:
# - Emails arrive at test address
# - PDF attachments included
# - All data renders correctly
```

**Email Client Testing:**
- Gmail (web + mobile)
- Outlook (any available version)
- Apple Mail (if available)
- Check rendering consistency

**Functional Testing:**
- Collection hook auto-sends on workflow transitions
- PDF Upload Wizard email preview works
- PDF Upload Wizard manual send works
- Admin alerts trigger on email failures

### 8. Cleanup (30 min)

**Delete old code:**
- Remove `src/collections/DrugTests/email/templates.ts` (1075 lines)
- Remove `react-email-starter/` directory

**Update `CLAUDE.md`:**
- Document `pnpm email` workflow
- Document email template location (`src/emails/drug-tests/`)
- Note Outlook compatibility requirements (no `object-fit`, table-based layouts)

**Create `src/emails/drug-tests/README.md`:**
```markdown
# Drug Test Email Templates

React Email components for drug test notifications.

## Preview
pnpm email  # Opens localhost:3000

## Structure
- 7 email templates (collected, screened, complete, inconclusive)
- Shared components in components/
- Utilities in utils/

## Outlook Compatibility
- No object-fit CSS
- Use table-based layouts
- Inline styles only
- Square images instead of circular
```

## Critical Files

### New Files
- `src/emails/drug-tests/utils/formatters.ts` - Extract formatters from templates.ts
- `src/emails/drug-tests/utils/constants.ts` - Color/label maps
- `src/emails/drug-tests/utils/styles.ts` - Shared inline styles
- `src/emails/drug-tests/components/*.tsx` - 7 shared components
- `src/emails/drug-tests/*.tsx` - 7 email templates
- `src/collections/DrugTests/email/render.ts` - React Email → HTML renderer

### Modified Files
- `package.json` - Add `email` and `email:export` scripts
- `src/collections/DrugTests/services/emailData.ts` - Update import path (line 6-9)
- `src/collections/DrugTests/hooks/sendNotificationEmails.ts` - Update import path
- `src/components/views/PDFUploadWizard/actions.ts` - Update import paths (lines 522-523, 946)

### Deleted Files
- `src/collections/DrugTests/email/templates.ts` - Replaced by React components
- `react-email-starter/` - No longer needed

## Success Criteria

- ✅ All 7 templates converted to React Email components
- ✅ `pnpm email` previews templates at localhost:3000
- ✅ No `object-fit` CSS (Outlook compatibility)
- ✅ Emails tested in Gmail, Outlook, Apple Mail
- ✅ TEST_MODE sends work correctly
- ✅ PDF attachments included
- ✅ No regressions in email functionality
- ✅ Service layer unchanged (no breaking changes)
- ✅ Documentation updated

## Rollback Strategy

If issues arise:
1. Revert import path changes via git
2. Restore `templates.ts` from git history
3. Keep both systems running in parallel during testing week

## Timeline Estimate

- Setup: 30 min
- Utilities: 1 hour
- Components: 3 hours
- Templates: 4 hours
- Render layer: 1 hour
- Update imports: 15 min
- Testing: 2-3 hours
- Cleanup: 30 min

**Total: ~12-13 hours** (1.5-2 days)
