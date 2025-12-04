# PR Review - Drug Test Wizard

## Commits Reviewed
- d7e63df - refactor: Replace useEffect data fetching with TanStack Query across PDF upload wizard
- 6163c2f - feat: Enhance PDF upload workflows with filename generation and result evaluation logic
- 026be6d - feat: Refactor EnterLabConfirmationWorkflow to include verification steps and new field groups
- 2a1851b - feat: Add unified lab test extractor and distinguish alcohol vs EtG testing
- 8eefb27 - test: Add comprehensive test suite for 15-panel instant test extractor

## Files Changed (37 files)
- PDF Upload Wizard components and workflows
- Lab test extractors with tests
- TanStack Query integration
- Substance options and mappings

---

## Critical Issues (8 found - must fix before merge)

| # | Agent | Issue | Location |
|---|-------|-------|----------|
| 1 | code-reviewer | **QueryClient shared across requests** - Module-level singleton can leak data between users | `QueryClientProvider.tsx:8` |
| 2 | code-reviewer | **Duplicate 'use server' directive** - Redundant and incorrect placement | `actions.ts:1536` |
| 3 | error-handler | **Silent fallback on medication fetch** - Returns empty array, user proceeds without medications | `actions.ts:343-346` |
| 4 | error-handler | **Silent fallback on pending tests** - Returns empty array, admin sees "no tests" | `actions.ts:1575-1578` |
| 5 | error-handler | **Query swallows errors, returns null** - `useGetClientFromTestQuery` loses error messages | `queries.ts:130-145` |
| 6 | error-handler | **Lost server error details** - Generic "Failed to fetch" loses specific messages | `queries.ts:152-168` |
| 7 | comment-analyzer | **Incorrect substance mapping comment** - Methaqualone is NOT a tricyclic antidepressant | `extractLabTest.ts:207` |
| 8 | comment-analyzer | **Wrong substance count** - Comment says 11 substances, array has 10; CR is not a drug panel | `substanceOptions.ts:54-57` |

## Important Issues (12 found - should fix)

| # | Agent | Issue | Location |
|---|-------|-------|----------|
| 1 | code-reviewer | **Test files use local paths** - Will fail in CI/CD | `extractLabTest.test.ts:9-11` |
| 2 | code-reviewer | **Inconsistent return types** - `getSubstanceOptions` returns different array types | `substanceOptions.ts:147` |
| 3 | code-reviewer | **Date parsing can throw** - `format()` throws on invalid dates | `generateFilename.ts:39` |
| 4 | code-reviewer | **Unused import** - `DrugTest` imported but unused | `actions.ts:10` |
| 5 | test-analyzer | **No tests for generateFilename.ts** - Critical filename generation logic untested | `generateFilename.ts` |
| 6 | test-analyzer | **No tests for calculateSimilarity** - Client matching logic untested | `actions.ts:60-89` |
| 7 | test-analyzer | **No tests for email confirmation status logic** - Complex business logic | `actions.ts:750-796` |
| 8 | error-handler | **No escalation for client email failures** - Only referral failures get admin alerts | `actions.ts:1015-1079` |
| 9 | error-handler | **Missing try-catch in useEffect async** - Unhandled rejections could freeze UI | `ExtractFieldGroup.tsx:68-113` |
| 10 | error-handler | **throwOnError:false without proper handling** - Suppresses errors that aren't handled | `QueryClientProvider.tsx:17-18` |
| 11 | error-handler | **S3 credentials not validated** - Non-null assertions on env vars | `actions.ts:980-989` |
| 12 | comment-analyzer | **17-panel count mismatch** - Comment says 17, array has 14 substances | `substanceOptions.ts:71-77` |

## Suggestions (9 found - nice to have)

| # | Agent | Issue | Location |
|---|-------|-------|----------|
| 1 | code-reviewer | Console.log statements in production code | `actions.ts` (multiple) |
| 2 | code-reviewer | Magic numbers for stale times | `queries.ts` (multiple) |
| 3 | test-analyzer | Test data should be committed fixtures, not local paths | All test files |
| 4 | error-handler | Lost stack trace in error wrapping | `extractLabTest.ts:283-285` |
| 5 | error-handler | setState during render (anti-pattern) | `VerifyClientFieldGroup.tsx:105-107` |
| 6 | comment-analyzer | Missing JSDoc on generateTestFilename | `generateFilename.ts:16-21` |
| 7 | comment-analyzer | Missing date extraction strategy explanation | `extractLabTest.ts:104-170` |
| 8 | comment-analyzer | Unused React import | `workflow-config.tsx:3` |
| 9 | comment-analyzer | Inconsistent EtG labeling (should say "Past Alcohol Use") | `substanceOptions.ts:41, 101` |

---

## Strengths

- **Excellent TanStack Query migration** - Custom hooks follow best practices with proper typing and stale times
- **Good separation of concerns** - Workflows cleanly separated with own schemas
- **Critical domain distinction** - Alcohol vs EtG testing correctly documented
- **Comprehensive substance mapping** - Unified extractor handles multiple test types well
- **Good confidence scoring** - Extraction results indicate reliability

---

## Detailed Issue Descriptions

### Critical Issue #1: QueryClient Shared Across Requests

**File:** `src/app/(payload)/QueryClientProvider.tsx:8`

The `QueryClient` is instantiated as a module-level constant. In Next.js, this creates a singleton that is shared across all requests on the server, which can lead to data leakage between users.

**Fix:** Use the recommended factory pattern:
```typescript
function makeQueryClient() {
  return new QueryClient({ /* options */ })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient() // Server: always new
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient // Browser: singleton
  }
}
```

### Critical Issue #3-4: Silent Fallbacks

**Files:** `actions.ts:343-346` and `actions.ts:1575-1578`

When fetching medications or pending tests fails, the functions return empty arrays instead of error states. Users see empty data with no indication of failure.

**Fix:** Return error states: `{ success: false, error: "..." }` or throw errors for proper handling.

### Critical Issue #5-6: Query Error Swallowing

**File:** `queries.ts:130-145` and `queries.ts:152-168`

Query functions convert errors to `null` without surfacing error messages. The `result.error` is completely lost.

**Fix:** Throw errors when operations fail:
```typescript
if (!result.success) {
  throw new Error(result.error || 'Operation failed')
}
```

---

## Recommended Action Plan

### Priority 1: Fix Critical Issues
1. QueryClientProvider.tsx - Use factory pattern for QueryClient
2. actions.ts:1536 - Remove duplicate 'use server' directive
3. queries.ts - Throw errors instead of returning null
4. actions.ts - Return error states instead of empty arrays

### Priority 2: Fix Important Issues
5. generateFilename.ts:39 - Add date validation before format()
6. actions.ts - Add admin alerts for client email failures
7. substanceOptions.ts - Fix comment inaccuracies

### Priority 3: Add Missing Tests
8. Add unit tests for generateFilename.ts
9. Add unit tests for calculateSimilarity
10. Create test fixtures for CI/CD

### Priority 4: Clean Up
11. Remove unused DrugTest import
12. Replace console.log/error with structured logging
13. Add missing JSDoc comments
