# Server-rendered email

Templates and their components render with React Email in Node. Keep the explicit `@jsxImportSource react` pragma on TSX files in this folder. Financial workflow tests also import these templates through Playwright, whose default JSX runtime creates browser transport objects rather than React elements. The pragma keeps the same React rendering behavior in Next, background jobs, and those integration tests.

`drug-tests/components/` owns the shared identity, result rows, notices, attachments, icons, and contact footer. Client and referral result emails share those templates; compatibility referral exports do not define another layout. `payments/ConfirmationPaymentEmail.tsx` uses the same visual components for confirmation checkout requests.

Vitest checks template content and escaping. `tests/e2e/email-rendering.spec.ts` checks the React runtime boundary, and the payment workflow tests verify actual Mailpit delivery and deduplication.
