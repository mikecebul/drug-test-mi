import { Section, Text } from '@react-email/components'
import * as React from 'react'
import { formatSubstance } from '../utils/formatters'
import { contentSection, successBox } from '../utils/styles'

interface SubstancesSectionProps {
  expectedPositives?: string[]
  unexpectedPositives?: string[]
  unexpectedNegatives?: string[]
  confirmedNegatives?: string[]
}

/**
 * SubstancesSection displays substance breakdown with color-coded categories
 * Categories: expected-positive, unexpected-positive, unexpected-negative, confirmed-negative
 */
export function SubstancesSection({
  expectedPositives,
  unexpectedPositives,
  unexpectedNegatives,
  confirmedNegatives,
}: SubstancesSectionProps) {
  // Check if there are substances to display
  const hasSubstances =
    (expectedPositives && expectedPositives.length > 0) ||
    (unexpectedPositives && unexpectedPositives.length > 0) ||
    (unexpectedNegatives && unexpectedNegatives.length > 0) ||
    (confirmedNegatives && confirmedNegatives.length > 0)

  // If no substances, show green "all negative" summary box
  if (!hasSubstances) {
    return (
      <Section style={{ ...successBox, marginBottom: '24px' }}>
        <Text
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#065f46',
            margin: '0 0 8px 0',
            textAlign: 'left',
          }}
        >
          ✓ All Negative
        </Text>
        <Text
          style={{
            fontSize: '14px',
            color: '#047857',
            margin: '0',
            textAlign: 'left',
          }}
        >
          All panels tested negative.
        </Text>
      </Section>
    )
  }

  const renderSubstanceList = (
    substances: string[],
    title: string,
    borderColor: string,
    backgroundColor: string,
  ) => {
    if (!substances || substances.length === 0) return null

    return (
      <Section
        style={{
          ...contentSection,
          backgroundColor,
          border: `2px solid ${borderColor}`,
          marginBottom: '16px',
        }}
      >
        <Text
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#1f2937',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </Text>

        {substances.map((substance, index) => (
          <Text
            key={index}
            style={{
              fontSize: '14px',
              color: '#374151',
              margin: '4px 0',
              paddingLeft: '8px',
            }}
          >
            • {formatSubstance(substance)}
          </Text>
        ))}
      </Section>
    )
  }

  return (
    <Section style={{ marginBottom: '24px' }}>
      {/* Expected Positives (Green) */}
      {renderSubstanceList(
        expectedPositives || [],
        'Expected Positives (Prescribed Medications)',
        '#10b981',
        '#d1fae5',
      )}

      {/* Unexpected Positives (Red) */}
      {renderSubstanceList(
        unexpectedPositives || [],
        'Unexpected Positives (Not Prescribed)',
        '#ef4444',
        '#fee2e2',
      )}

      {/* Unexpected Negatives (Yellow/Red) */}
      {renderSubstanceList(
        unexpectedNegatives || [],
        'Unexpected Negatives (Missing Expected Medications)',
        '#f59e0b',
        '#fef3c7',
      )}

      {/* Confirmed Negatives (Green) */}
      {renderSubstanceList(
        confirmedNegatives || [],
        'Confirmed Negative (LC-MS/MS)',
        '#10b981',
        '#d1fae5',
      )}
    </Section>
  )
}

SubstancesSection.PreviewProps = {
  expectedPositives: ['benzodiazepines', 'opiates'],
  unexpectedPositives: ['thc', 'cocaine'],
  unexpectedNegatives: ['tramadol'],
  confirmedNegatives: ['amphetamines'],
} as SubstancesSectionProps
