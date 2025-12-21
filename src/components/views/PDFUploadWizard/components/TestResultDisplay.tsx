import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { formatSubstance } from '@/lib/substances'

interface TestResultDisplayProps {
  expectedPositives?: string[]
  unexpectedPositives?: string[]
  unexpectedNegatives?: string[]
  confirmedNegatives?: string[]
}

/**
 * TestResultDisplay - Reusable component for displaying test results
 * Follows the same pattern as email SubstancesSection component
 */
export function TestResultDisplay({
  expectedPositives = [],
  unexpectedPositives = [],
  unexpectedNegatives = [],
  confirmedNegatives = [],
}: TestResultDisplayProps) {
  // Check if there are any substances to display
  const hasSubstances =
    expectedPositives.length > 0 ||
    unexpectedPositives.length > 0 ||
    unexpectedNegatives.length > 0 ||
    confirmedNegatives.length > 0

  // If no substances, show "All Negative" success alert
  if (!hasSubstances) {
    return (
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>All Negative</AlertTitle>
        <AlertDescription>All panels tested negative.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {/* Expected Positives (Success) */}
      {expectedPositives.length > 0 && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="uppercase">Expected Positives (Prescribed Medications)</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {expectedPositives.map((substance) => (
                <div key={substance} className="">
                  • {formatSubstance(substance)}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Unexpected Positives (Destructive) */}
      {unexpectedPositives.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="uppercase">Unexpected Positives (Not Prescribed)</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {unexpectedPositives.map((substance) => (
                <div key={substance} className="">
                  • {formatSubstance(substance)}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Unexpected Negatives (Warning) */}
      {unexpectedNegatives.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="uppercase">
            Unexpected Negatives (Missing Expected Medications)
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {unexpectedNegatives.map((substance) => (
                <div key={substance} className="">
                  • {formatSubstance(substance)}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Confirmed Negatives (Success) */}
      {confirmedNegatives.length > 0 && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="uppercase">Confirmed Negative (LC-MS/MS)</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {confirmedNegatives.map((substance) => (
                <div key={substance} className="">
                  • {formatSubstance(substance)}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
