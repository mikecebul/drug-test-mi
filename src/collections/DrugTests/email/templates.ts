import type {
  CollectedEmailData,
  ScreenedEmailData,
  CompleteEmailData,
  EmailOutput,
} from './types'

// Helper: Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Helper: Format test type for display
function formatTestType(testType: string): string {
  const typeMap: Record<string, string> = {
    '11-panel-lab': '11-Panel Lab Test',
    '15-panel-instant': '15-Panel Instant Test',
    '17-panel-sos-lab': '17-Panel SOS Lab Test',
    'etg-lab': 'EtG Lab Test',
  }
  return typeMap[testType] || testType
}

// Helper: Get result color based on test result
function getResultColor(result: string): string {
  if (result === 'negative' || result === 'expected-positive' || result === 'confirmed-negative') return '#22c55e' // green
  if (result === 'unexpected-negative') return '#eab308' // yellow
  return '#ef4444' // red (unexpected-positive, mixed-unexpected)
}

// Helper: Get result label for display
function getResultLabel(result: string): string {
  const labels: Record<string, string> = {
    negative: 'NEGATIVE (PASS)',
    'expected-positive': 'EXPECTED POSITIVE (PASS)',
    'confirmed-negative': 'CONFIRMED NEGATIVE (PASS)',
    'unexpected-positive': 'UNEXPECTED POSITIVE (FAIL)',
    'unexpected-negative': 'UNEXPECTED NEGATIVE (Warning)',
    'mixed-unexpected': 'MIXED UNEXPECTED (FAIL)',
    inconclusive: 'INCONCLUSIVE',
  }
  return labels[result] || result.toUpperCase()
}

// Helper: Format substance names for display
function formatSubstance(substance: string): string {
  const substanceMap: Record<string, string> = {
    '6-mam': 'Heroin (6-MAM)',
    amphetamines: 'Amphetamines',
    methamphetamines: 'Methamphetamines',
    benzodiazepines: 'Benzodiazepines',
    thc: 'THC (Marijuana)',
    opiates: 'Opiates',
    oxycodone: 'Oxycodone',
    cocaine: 'Cocaine',
    pcp: 'PCP',
    barbiturates: 'Barbiturates',
    methadone: 'Methadone',
    propoxyphene: 'Propoxyphene',
    tricyclic_antidepressants: 'Tricyclic Antidepressants',
    mdma: 'MDMA (Ecstasy)',
    buprenorphine: 'Buprenorphine',
    tramadol: 'Tramadol',
    fentanyl: 'Fentanyl',
    kratom: 'Kratom',
    etg: 'EtG (Alcohol)',
    synthetic_cannabinoids: 'Synthetic Cannabinoids',
    other: 'Other',
  }
  return substanceMap[substance] || substance
}

/**
 * Stage 1: Sample Collected Email
 * Sent when a lab test sample is collected and sent to the lab
 */
export function buildCollectedEmail(data: CollectedEmailData): {
  subject: string
  html: string
} {
  const { clientName, collectionDate, testType } = data

  return {
    subject: `Drug Test Sample Collected - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Sample Collected</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Drug Test Sample Collected</h1>
            </div>
            <div class="content">
              <p>A drug test sample has been collected and is being sent to the laboratory for screening:</p>

              <div class="detail-row">
                <span class="label">Client:</span> ${clientName}
              </div>
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>

              <p>You will receive another notification when laboratory results are available.</p>

              <div class="footer">
                <p><small>This is an automated notification from MI Drug Test. Please do not reply to this email.</small></p>
                <p><small>Notification sent: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

/**
 * Stage 2: Screening Complete Email
 * Sent when initial screening results are entered
 * Different versions for client (notification only) vs referrals (full results)
 */
export function buildScreenedEmail(data: ScreenedEmailData): EmailOutput {
  const {
    clientName,
    collectionDate,
    testType,
    initialScreenResult,
    detectedSubstances,
    expectedPositives,
    unexpectedPositives,
    unexpectedNegatives,
    isDilute,
  } = data

  const resultColor = getResultColor(initialScreenResult)
  const resultLabel = getResultLabel(initialScreenResult)
  const hasUnexpected =
    initialScreenResult === 'unexpected-positive' ||
    initialScreenResult === 'unexpected-negative' ||
    initialScreenResult === 'mixed-unexpected'

  // Client email - full results breakdown with attachment
  const clientEmail = {
    subject: `Drug Test Results - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Drug Test Results</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${resultColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 15px 0; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .substances-section { margin: 15px 0; padding: 15px; background-color: white; border-left: 4px solid #ccc; border-radius: 3px; }
            .substances-section.green { border-left-color: #22c55e; }
            .substances-section.red { border-left-color: #ef4444; }
            .substances-section.yellow { border-left-color: #eab308; }
            .substance-list { list-style: none; padding-left: 0; margin: 10px 0 0 0; }
            .substance-item { padding: 5px 0; }
            .dilute-warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .info-box { background-color: #fff3cd; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .info-box.warning { background-color: #fef3c7; border-left-color: #eab308; }
            .cta-button { display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; text-align: center; }
            .cta-button:hover { background-color: #2563eb; }
            .button-container { text-align: center; margin: 25px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Drug Test Results</h1>
              <div class="result-badge">${resultLabel}</div>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>

              ${
                isDilute
                  ? `
                <div class="dilute-warning">
                  <strong>⚠️ DILUTE SAMPLE</strong>
                  <p style="margin: 5px 0 0 0;">This sample was dilute and may affect result accuracy.</p>
                </div>
              `
                  : ''
              }

              ${
                detectedSubstances.length > 0
                  ? `
                <div class="substances-section">
                  <strong>Detected Substances:</strong>
                  <ul class="substance-list">
                    ${detectedSubstances.map((s) => `<li class="substance-item">• ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : '<div class="substances-section"><strong>No substances detected</strong></div>'
              }

              ${
                expectedPositives.length > 0
                  ? `
                <div class="substances-section green">
                  <strong>✓ Expected Positives (from documented medications):</strong>
                  <ul class="substance-list">
                    ${expectedPositives.map((s) => `<li class="substance-item">✓ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : ''
              }

              ${
                unexpectedPositives.length > 0
                  ? `
                <div class="substances-section red">
                  <strong>✗ Unexpected Positives (not from documented medications):</strong>
                  <ul class="substance-list">
                    ${unexpectedPositives.map((s) => `<li class="substance-item">✗ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Confirmation testing available within 30 days.</p>
                </div>
              `
                  : ''
              }

              ${
                unexpectedNegatives.length > 0
                  ? `
                <div class="substances-section yellow">
                  <strong>⚠ Unexpected Negatives (documented medications not detected):</strong>
                  <ul class="substance-list">
                    ${unexpectedNegatives.map((s) => `<li class="substance-item">⚠ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Expected medications were not detected in this test.</p>
                </div>
              `
                  : ''
              }

              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results" class="cta-button">View Full Results</a>
              </div>

              ${
                initialScreenResult === 'unexpected-negative'
                  ? `
                <div class="info-box warning">
                  <p style="margin: 0; font-weight: bold;">About Your Results</p>
                  <p style="margin: 10px 0 0 0;">Your test shows that some of your prescribed medications were not detected. This is uncommon and may indicate timing or other factors.</p>
                  <p style="margin: 10px 0 0 0;"><strong>Note:</strong> Confirmation testing is rarely necessary for missing medications. Any decisions about further testing should be made between you and your referral source.</p>
                </div>
              `
                  : initialScreenResult === 'unexpected-positive' || initialScreenResult === 'mixed-unexpected'
                    ? `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Confirmation Testing Available</p>
                  <p style="margin: 10px 0 0 0;">Your initial screening detected unexpected substances. Confirmation testing is available for <strong>$45</strong> within <strong>30 days</strong> to verify these results.</p>
                  <p style="margin: 10px 0 0 0;">Please call us at your earliest convenience to discuss your results.</p>
                </div>
              `
                    : ''
              }

              <div class="footer">
                <p><strong>Your complete test report is attached to this email.</strong></p>
                <p><small>If you have questions, please contact MI Drug Test.</small></p>
                <p><small>Notification sent: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  // Referral email - full results with color-coding
  const referralEmail = {
    subject: `Drug Test Results - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Drug Test Results</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${resultColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 10px 0; }
            .substances-section { margin: 15px 0; padding: 15px; background-color: white; border-left: 4px solid #ccc; border-radius: 3px; }
            .substances-section.green { border-left-color: #22c55e; }
            .substances-section.red { border-left-color: #ef4444; }
            .substances-section.yellow { border-left-color: #eab308; }
            .substance-list { list-style: none; padding-left: 0; margin: 10px 0 0 0; }
            .substance-item { padding: 5px 0; }
            .dilute-warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Drug Test Results</h1>
              <div class="result-badge">${resultLabel}</div>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Client:</span> ${clientName}
              </div>
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>

              ${
                isDilute
                  ? `
                <div class="dilute-warning">
                  <strong>⚠️ DILUTE SAMPLE</strong>
                  <p style="margin: 5px 0 0 0;">This sample was dilute and may affect result accuracy.</p>
                </div>
              `
                  : ''
              }

              ${
                detectedSubstances.length > 0
                  ? `
                <div class="substances-section">
                  <strong>Detected Substances:</strong>
                  <ul class="substance-list">
                    ${detectedSubstances.map((s) => `<li class="substance-item">• ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : '<div class="substances-section"><strong>No substances detected</strong></div>'
              }

              ${
                expectedPositives.length > 0
                  ? `
                <div class="substances-section green">
                  <strong>✓ Expected Positives (from documented medications):</strong>
                  <ul class="substance-list">
                    ${expectedPositives.map((s) => `<li class="substance-item">✓ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : ''
              }

              ${
                unexpectedPositives.length > 0
                  ? `
                <div class="substances-section red">
                  <strong>✗ Unexpected Positives (not from documented medications):</strong>
                  <ul class="substance-list">
                    ${unexpectedPositives.map((s) => `<li class="substance-item">✗ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Confirmation testing available within 30 days.</p>
                </div>
              `
                  : ''
              }

              ${
                unexpectedNegatives.length > 0
                  ? `
                <div class="substances-section yellow">
                  <strong>⚠ Unexpected Negatives (documented medications not detected):</strong>
                  <ul class="substance-list">
                    ${unexpectedNegatives.map((s) => `<li class="substance-item">⚠ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Expected medications were not detected in this test.</p>
                </div>
              `
                  : ''
              }

              <div class="footer">
                <p><small>This is an automated notification from MI Drug Test.</small></p>
                ${hasUnexpected ? '<p><small>Confirmation testing available for $45 within 30 days of collection.</small></p>' : ''}
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

/**
 * Stage 3: Confirmation Complete Email
 * Sent when all confirmation testing is complete and test is marked as complete
 */
export function buildCompleteEmail(data: CompleteEmailData): EmailOutput {
  const {
    clientName,
    collectionDate,
    testType,
    initialScreenResult,
    confirmationResults,
    finalStatus,
    isDilute,
  } = data

  const resultColor = getResultColor(finalStatus)
  const resultLabel = getResultLabel(finalStatus)

  // Client email - full results with confirmation data
  const clientEmail = {
    subject: `Final Drug Test Results - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Final Drug Test Results</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${resultColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 15px 0; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .substances-section { margin: 15px 0; padding: 15px; background-color: white; border-left: 4px solid #ccc; border-radius: 3px; }
            .substances-section.green { border-left-color: #22c55e; }
            .substances-section.red { border-left-color: #ef4444; }
            .substances-section.yellow { border-left-color: #eab308; }
            .substances-section.blue { border-left-color: #3b82f6; }
            .substance-list { list-style: none; padding-left: 0; margin: 10px 0 0 0; }
            .substance-item { padding: 5px 0; }
            .dilute-warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .confirmation-section { margin: 15px 0; padding: 15px; background-color: white; border: 2px solid #3b82f6; border-radius: 5px; }
            .confirmation-item { padding: 10px; margin: 5px 0; background-color: #f0f9ff; border-radius: 3px; }
            .cta-button { display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; text-align: center; }
            .cta-button:hover { background-color: #2563eb; }
            .button-container { text-align: center; margin: 25px 0; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Final Drug Test Results</h1>
              <div class="result-badge">${resultLabel}</div>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>
              <div class="detail-row">
                <span class="label">Initial Screen Result:</span> ${getResultLabel(initialScreenResult)}
              </div>

              ${
                isDilute
                  ? `
                <div class="dilute-warning">
                  <strong>⚠️ DILUTE SAMPLE</strong>
                  <p style="margin: 5px 0 0 0;">This sample was dilute and may affect result accuracy.</p>
                </div>
              `
                  : ''
              }

              ${
                confirmationResults && confirmationResults.length > 0
                  ? `
                <div class="confirmation-section">
                  <strong>✓ Confirmation Test Results:</strong>
                  ${confirmationResults
                    .map(
                      (conf) => `
                    <div class="confirmation-item">
                      <strong>${formatSubstance(conf.substance)}:</strong> ${conf.result.replace(/-/g, ' ').toUpperCase()}
                      ${conf.notes ? `<br><em style="color: #666; font-size: 14px;">${conf.notes}</em>` : ''}
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : ''
              }

              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results" class="cta-button">View Full Results</a>
              </div>

              <div class="footer">
                <p><strong>Your complete test report is attached to this email.</strong></p>
                <p><small>All testing is now complete. If you have questions, please contact MI Drug Test.</small></p>
                <p><small>Notification sent: ${new Date().toLocaleString()}</small></p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  }

  // Referral email - full results with confirmation data
  const referralEmail = {
    subject: `Final Drug Test Results - ${clientName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Final Drug Test Results</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${resultColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 10px 0; }
            .confirmation-section { margin: 15px 0; padding: 15px; background-color: white; border: 2px solid #3b82f6; border-radius: 5px; }
            .confirmation-item { padding: 10px; margin: 5px 0; background-color: #f0f9ff; border-radius: 3px; }
            .dilute-warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 3px; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Final Drug Test Results</h1>
              <div class="result-badge">${resultLabel}</div>
            </div>
            <div class="content">
              <div class="detail-row">
                <span class="label">Client:</span> ${clientName}
              </div>
              <div class="detail-row">
                <span class="label">Collection Date:</span> ${formatDate(collectionDate)}
              </div>
              <div class="detail-row">
                <span class="label">Test Type:</span> ${formatTestType(testType)}
              </div>
              <div class="detail-row">
                <span class="label">Initial Screen Result:</span> ${getResultLabel(initialScreenResult)}
              </div>

              ${
                isDilute
                  ? `
                <div class="dilute-warning">
                  <strong>⚠️ DILUTE SAMPLE</strong>
                  <p style="margin: 5px 0 0 0;">This sample was dilute and may affect result accuracy.</p>
                </div>
              `
                  : ''
              }

              ${
                confirmationResults && confirmationResults.length > 0
                  ? `
                <div class="confirmation-section">
                  <strong>Confirmation Test Results:</strong>
                  ${confirmationResults
                    .map(
                      (conf) => `
                    <div class="confirmation-item">
                      <strong>${formatSubstance(conf.substance)}:</strong> ${conf.result.replace(/-/g, ' ').toUpperCase()}
                      ${conf.notes ? `<br><em style="color: #666; font-size: 14px;">${conf.notes}</em>` : ''}
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
                  : '<div class="confirmation-section"><strong>No confirmation testing was performed - results accepted as-is.</strong></div>'
              }

              <div class="footer">
                <p><strong>This is the final result for this drug test. All testing is complete.</strong></p>
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
