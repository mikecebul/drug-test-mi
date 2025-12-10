import type {
  CollectedEmailData,
  ScreenedEmailData,
  CompleteEmailData,
  InconclusiveEmailData,
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

// Helper: Format date of birth for display
function formatDob(dobString: string): string {
  return new Date(dobString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
  if (result === 'negative' || result === 'expected-positive' || result === 'confirmed-negative')
    return '#22c55e' // green
  if (result === 'unexpected-negative-warning') return '#eab308' // yellow (soft warning)
  return '#ef4444' // red (unexpected-positive, unexpected-negative-critical, mixed-unexpected)
}

// Helper: Get result label for display
function getResultLabel(result: string): string {
  const labels: Record<string, string> = {
    negative: 'NEGATIVE (PASS)',
    'expected-positive': 'EXPECTED POSITIVE (PASS)',
    'confirmed-negative': 'CONFIRMED NEGATIVE (PASS)',
    'unexpected-positive': 'UNEXPECTED POSITIVE (FAIL)',
    'unexpected-negative-critical': 'UNEXPECTED NEGATIVE - CRITICAL (FAIL)',
    'unexpected-negative-warning': 'UNEXPECTED NEGATIVE - WARNING',
    'mixed-unexpected': 'MIXED UNEXPECTED (FAIL)',
    inconclusive: 'INCONCLUSIVE',
  }
  return labels[result] || result.toUpperCase()
}

// Helper: Format substance names for display
function formatSubstance(substance: string): string {
  const substanceMap: Record<string, string> = {
    '6-mam': 'Heroin (6-MAM)',
    alcohol: 'Alcohol (Current Intoxication)',
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
    etg: 'EtG (Past Alcohol Use)',
    synthetic_cannabinoids: 'Synthetic Cannabinoids',
    other: 'Other',
  }
  return substanceMap[substance] || substance
}

/**
 * Inconclusive Test Email
 * Sent when a test sample is invalid and cannot be screened
 */
export function buildInconclusiveEmail(data: InconclusiveEmailData): EmailOutput {
  const { clientName, collectionDate, testType, reason, clientHeadshotDataUri, clientDob } = data

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
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
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
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Test Inconclusive</h1>
            </div>
            <div class="content">
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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

/**
 * Stage 1: Sample Collected Email
 * Sent when a lab test sample is collected and sent to the lab
 */
export function buildCollectedEmail(data: CollectedEmailData): {
  subject: string
  html: string
} {
  const { clientName, collectionDate, testType, breathalyzerTaken, breathalyzerResult, clientHeadshotDataUri, clientDob } = data

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
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Drug Test Sample Collected</h1>
            </div>
            <div class="content">
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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

              ${
                breathalyzerTaken && breathalyzerResult !== null
                  ? `
              <div class="detail-row">
                <span class="label">Breathalyzer:</span> ${breathalyzerResult.toFixed(3)} BAC ${breathalyzerResult > 0.000 ? '<strong style="color: #ef4444;">(POSITIVE)</strong>' : '<strong style="color: #22c55e;">(NEGATIVE)</strong>'}
              </div>
              `
                  : ''
              }

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
    confirmationDecision,
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
  } = data

  const resultColor = getResultColor(initialScreenResult)
  const resultLabel = getResultLabel(initialScreenResult)
  const hasUnexpected =
    initialScreenResult === 'unexpected-positive' ||
    initialScreenResult === 'unexpected-negative' ||
    initialScreenResult === 'mixed-unexpected'

  // Determine confirmation messaging based on test type and decision
  const isInstantTest = testType === '15-panel-instant'
  const isLabScreen = testType !== '15-panel-instant'
  const hasConfirmationDecision = confirmationDecision !== null && confirmationDecision !== undefined
  const isAccepted = confirmationDecision === 'accept'
  const isPending = confirmationDecision === 'pending-decision'

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
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 10px 0; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
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
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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
                breathalyzerTaken && breathalyzerResult !== null
                  ? `
                <div class="substances-section ${breathalyzerResult > 0.000 ? 'red' : 'green'}">
                  <strong>${breathalyzerResult > 0.000 ? '‼️' : '✅'} Breathalyzer Test Result:</strong>
                  <div class="detail-row" style="margin-top: 10px;">
                    <span class="label">BAC Level:</span> ${breathalyzerResult.toFixed(3)}
                  </div>
                  <div class="detail-row">
                    <span class="label">Result:</span> ${breathalyzerResult > 0.000 ? 'POSITIVE (FAIL)' : 'NEGATIVE (PASS)'}
                  </div>
                  ${
                    breathalyzerResult > 0.000
                      ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Any detectable alcohol level constitutes a positive result.</p>'
                      : ''
                  }
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
                  <strong>✅ Expected Positives (from reported medications):</strong>
                  <ul class="substance-list">
                    ${expectedPositives.map((s) => `<li class="substance-item">✅ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : ''
              }

              ${
                unexpectedPositives.length > 0
                  ? `
                <div class="substances-section red">
                  <strong>‼️ Unexpected Positives (not from reported medications):</strong>
                  <ul class="substance-list">
                    ${unexpectedPositives.map((s) => `<li class="substance-item">‼️ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  ${
                    isInstantTest && hasConfirmationDecision
                      ? isAccepted
                        ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Results accepted as final. Sample has been disposed.</p>'
                        : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Sample sent to lab for LC-MS/MS confirmation testing.</p>'
                      : isLabScreen && hasConfirmationDecision
                        ? isAccepted
                          ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">You accepted these results. Sample held by lab for 30 days if you change your mind.</p>'
                          : isPending
                            ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Sample held by lab for 30 days. Confirmation testing available for $45 per substance within 30 days.</p>'
                            : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Sample sent to lab for LC-MS/MS confirmation testing.</p>'
                        : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Confirmation testing available within 30 days.</p>'
                  }
                </div>
              `
                  : ''
              }

              ${
                unexpectedNegatives.length > 0
                  ? `
                <div class="substances-section ${initialScreenResult === 'unexpected-negative-critical' ? 'red' : 'yellow'}">
                  <strong>${initialScreenResult === 'unexpected-negative-critical' ? '‼️' : '⚠️'} Unexpected Negatives (reported medications not detected):</strong>
                  <ul class="substance-list">
                    ${unexpectedNegatives.map((s) => `<li class="substance-item">${initialScreenResult === 'unexpected-negative-critical' ? '‼️' : '⚠️'} ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                    ${
                      initialScreenResult === 'unexpected-negative-critical'
                        ? 'CRITICAL: Required medications were not detected. This requires immediate review and confirmation testing.'
                        : 'Expected medications were not detected. This is being monitored for patterns but does not automatically fail the test.'
                    }
                  </p>
                </div>
              `
                  : ''
              }

              <div class="button-container">
                <a href="${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results" class="cta-button">View Test Results</a>
              </div>

              ${
                initialScreenResult === 'unexpected-negative-warning'
                  ? `
                <div class="info-box warning">
                  <p style="margin: 0; font-weight: bold;">⚠️ About Your Results</p>
                  <p style="margin: 10px 0 0 0;">Your test shows that some of your prescribed medications were not detected. This is being monitored for patterns but does not automatically fail your test.</p>
                  <p style="margin: 10px 0 0 0;"><strong>Note:</strong> One-off missed medications are not uncommon and can be due to timing or other factors. Your referral source will review this as part of your ongoing monitoring.</p>
                </div>
              `
                  : initialScreenResult === 'unexpected-negative-critical'
                    ? `
                <div class="info-box error">
                  <p style="margin: 0; font-weight: bold;">‼️ Critical: Required Medication Missing</p>
                  <p style="margin: 10px 0 0 0;">Your test shows that required medications (marked for strict monitoring) were not detected. This requires immediate review.</p>
                  <p style="margin: 10px 0 0 0;"><strong>Action Required:</strong> Your referral source has been notified and may request confirmation testing. Please contact them directly if you have questions.</p>
                </div>
              `
                    : initialScreenResult === 'unexpected-positive' ||
                        initialScreenResult === 'mixed-unexpected'
                      ? isInstantTest && hasConfirmationDecision
                        ? isAccepted
                          ? `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Results Accepted</p>
                  <p style="margin: 10px 0 0 0;">You chose to accept these screening results as final at the time of collection. The sample has been disposed and confirmation testing is no longer available for this test.</p>
                  <p style="margin: 10px 0 0 0;">Please call us if you have questions about your results.</p>
                </div>
              `
                          : `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Confirmation Testing Requested</p>
                  <p style="margin: 10px 0 0 0;">Your sample has been sent to the laboratory for LC-MS/MS confirmation testing on the unexpected positive substances. You will receive an update when confirmation results are available (typically 2-4 business days).</p>
                  <p style="margin: 10px 0 0 0;">Thank you for choosing confirmation testing to verify your results.</p>
                </div>
              `
                        : isLabScreen && hasConfirmationDecision
                          ? isAccepted
                            ? `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Results Accepted</p>
                  <p style="margin: 10px 0 0 0;">You have accepted these screening results as final. Your sample will be held by the laboratory for 30 days in case you change your mind and wish to request confirmation testing.</p>
                  <p style="margin: 10px 0 0 0;">Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong>. Please call us if you have questions.</p>
                </div>
              `
                            : isPending
                              ? `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Confirmation Testing Available</p>
                  <p style="margin: 10px 0 0 0;">We were unable to reach you about your screening results. Your sample is being held by the laboratory for <strong>30 days</strong> to give you the opportunity to request confirmation testing.</p>
                  <p style="margin: 10px 0 0 0;">Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong> to verify these results. Please call us at your earliest convenience to discuss your options.</p>
                </div>
              `
                              : `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Confirmation Testing Requested</p>
                  <p style="margin: 10px 0 0 0;">Your sample has been sent to the laboratory for LC-MS/MS confirmation testing on the unexpected positive substances. You will receive an update when confirmation results are available (typically 2-4 business days).</p>
                  <p style="margin: 10px 0 0 0;">Thank you for choosing confirmation testing to verify your results.</p>
                </div>
              `
                          : `
                <div class="info-box">
                  <p style="margin: 0; font-weight: bold;">Confirmation Testing Available</p>
                  <p style="margin: 10px 0 0 0;">Your initial screening detected unexpected substances. Confirmation testing is available for <strong>$45 per substance</strong> within <strong>30 days</strong> to verify these results.</p>
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
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
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
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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
                breathalyzerTaken && breathalyzerResult !== null
                  ? `
                <div class="substances-section ${breathalyzerResult > 0.000 ? 'red' : 'green'}">
                  <strong>${breathalyzerResult > 0.000 ? '‼️' : '✅'} Breathalyzer Test Result:</strong>
                  <div class="detail-row" style="margin-top: 10px;">
                    <span class="label">BAC Level:</span> ${breathalyzerResult.toFixed(3)}
                  </div>
                  <div class="detail-row">
                    <span class="label">Result:</span> ${breathalyzerResult > 0.000 ? 'POSITIVE (FAIL)' : 'NEGATIVE (PASS)'}
                  </div>
                  ${
                    breathalyzerResult > 0.000
                      ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Any detectable alcohol level constitutes a positive result.</p>'
                      : ''
                  }
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
                  <strong>✅ Expected Positives (from reported medications):</strong>
                  <ul class="substance-list">
                    ${expectedPositives.map((s) => `<li class="substance-item">✅ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                </div>
              `
                  : ''
              }

              ${
                unexpectedPositives.length > 0
                  ? `
                <div class="substances-section red">
                  <strong>‼️ Unexpected Positives (not from reported medications):</strong>
                  <ul class="substance-list">
                    ${unexpectedPositives.map((s) => `<li class="substance-item">‼️ ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  ${
                    isInstantTest && hasConfirmationDecision
                      ? isAccepted
                        ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Client accepted results as final. Sample has been disposed.</p>'
                        : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Client requested confirmation testing. Sample sent to lab for LC-MS/MS confirmation.</p>'
                      : isLabScreen && hasConfirmationDecision
                        ? isAccepted
                          ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Client accepted results as final. Sample held by lab for 30 days if client changes decision.</p>'
                          : isPending
                            ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Decision pending. Sample held by lab for 30 days for confirmation decision.</p>'
                            : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Client requested confirmation testing. Sample sent to lab for LC-MS/MS confirmation.</p>'
                        : '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Confirmation testing available within 30 days.</p>'
                  }
                </div>
              `
                  : ''
              }

              ${
                unexpectedNegatives.length > 0
                  ? `
                <div class="substances-section ${initialScreenResult === 'unexpected-negative-critical' ? 'red' : 'yellow'}">
                  <strong>${initialScreenResult === 'unexpected-negative-critical' ? '‼️' : '⚠️'} Unexpected Negatives (reported medications not detected):</strong>
                  <ul class="substance-list">
                    ${unexpectedNegatives.map((s) => `<li class="substance-item">${initialScreenResult === 'unexpected-negative-critical' ? '‼️' : '⚠️'} ${formatSubstance(s)}</li>`).join('')}
                  </ul>
                  <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                    ${
                      initialScreenResult === 'unexpected-negative-critical'
                        ? 'CRITICAL: Required medications (marked for strict monitoring) were not detected. Immediate review recommended.'
                        : 'Expected medications were not detected. Monitor for patterns - one-off occurrences are not uncommon.'
                    }
                  </p>
                </div>
              `
                  : ''
              }

              <div class="footer">
                <p><small>This is an automated notification from MI Drug Test.</small></p>
                ${
                  hasUnexpected
                    ? isInstantTest && hasConfirmationDecision
                      ? isAccepted
                        ? '<p><small>Client accepted screening results as final. Sample has been disposed and confirmation testing is not available.</small></p>'
                        : '<p><small>Client requested confirmation testing. Sample has been sent to lab for LC-MS/MS confirmation testing.</small></p>'
                      : isLabScreen && hasConfirmationDecision
                        ? isAccepted
                          ? '<p><small>Client accepted screening results. Sample held by lab for 30 days if client changes decision. Confirmation testing $45 per substance.</small></p>'
                          : isPending
                            ? '<p><small>Decision pending. Sample held by lab for 30 days. Confirmation testing available for $45 per substance.</small></p>'
                            : '<p><small>Client requested confirmation testing. Sample has been sent to lab for LC-MS/MS confirmation testing.</small></p>'
                        : '<p><small>Confirmation testing available for $45 per substance within 30 days of collection.</small></p>'
                    : ''
                }
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
    breathalyzerTaken,
    breathalyzerResult,
    clientHeadshotDataUri,
    clientDob,
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
            .result-badge { display: inline-block; padding: 8px 16px; background-color: ${resultColor}; color: white; border-radius: 5px; font-weight: bold; margin: 10px 0; }
            .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 3px; }
            .label { font-weight: bold; color: #3b82f6; }
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
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
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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
                breathalyzerTaken && breathalyzerResult !== null
                  ? `
                <div class="substances-section ${breathalyzerResult > 0.000 ? 'red' : 'green'}">
                  <strong>${breathalyzerResult > 0.000 ? '‼️' : '✅'} Breathalyzer Test Result:</strong>
                  <div class="detail-row" style="margin-top: 10px;">
                    <span class="label">BAC Level:</span> ${breathalyzerResult.toFixed(3)}
                  </div>
                  <div class="detail-row">
                    <span class="label">Result:</span> ${breathalyzerResult > 0.000 ? 'POSITIVE (FAIL)' : 'NEGATIVE (PASS)'}
                  </div>
                  ${
                    breathalyzerResult > 0.000
                      ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Any detectable alcohol level constitutes a positive result.</p>'
                      : ''
                  }
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
                <a href="${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard/results" class="cta-button">View Test Results</a>
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
            .client-headshot { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid #e5e7eb; margin: 0 auto 10px; display: block; }
            .client-identity { text-align: center; padding: 20px; background-color: white; border-radius: 8px; margin-bottom: 20px; }
            .client-name-caption { margin: 0; font-size: 16px; font-weight: 700; color: #1f2937; }
            .client-dob-caption { margin: 5px 0 0; font-size: 14px; font-weight: 400; color: #6b7280; }
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
              ${clientHeadshotDataUri ? `
              <div class="client-identity">
                <img src="${clientHeadshotDataUri}" alt="${clientName}" class="client-headshot">
                <p class="client-name-caption">${clientName}</p>
                ${clientDob ? `<p class="client-dob-caption">DOB: ${formatDob(clientDob)}</p>` : ''}
              </div>
              ` : ''}
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
                breathalyzerTaken && breathalyzerResult !== null
                  ? `
                <div class="substances-section ${breathalyzerResult > 0.000 ? 'red' : 'green'}">
                  <strong>${breathalyzerResult > 0.000 ? '‼️' : '✅'} Breathalyzer Test Result:</strong>
                  <div class="detail-row" style="margin-top: 10px;">
                    <span class="label">BAC Level:</span> ${breathalyzerResult.toFixed(3)}
                  </div>
                  <div class="detail-row">
                    <span class="label">Result:</span> ${breathalyzerResult > 0.000 ? 'POSITIVE (FAIL)' : 'NEGATIVE (PASS)'}
                  </div>
                  ${
                    breathalyzerResult > 0.000
                      ? '<p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">Any detectable alcohol level constitutes a positive result.</p>'
                      : ''
                  }
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
