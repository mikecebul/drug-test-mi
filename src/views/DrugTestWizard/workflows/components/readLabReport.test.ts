import { expect, test } from 'vitest'
import { verifyLabReportIdentity } from './readLabReport'
import { getReportClientMatch, getReportClientMismatchKey } from '../instant-test/utils/reportClientMatch'
import type { ParsedPDFData } from '../../types'
const report = { donorName: 'Sample Q Donor', dob: '01/15/1990' } as ParsedPDFData
const client = { firstName: 'Sample', middleInitial: 'Q', lastName: 'Donor', dob: '1990-01-16' }
test('final saves require acknowledgement of the actual uploaded identity, not an earlier profile', async () => {
  await expect(verifyLabReportIdentity(report, client, undefined)).rejects.toThrow()
  await expect(verifyLabReportIdentity(report, client, { confirmed: false, key: null })).rejects.toThrow()
  const key = getReportClientMismatchKey(getReportClientMatch(report.donorName, client, report.dob))
  await expect(verifyLabReportIdentity(report, client, { confirmed: true, key })).resolves.toBeUndefined()
  await expect(
    verifyLabReportIdentity(report, { ...client, lastName: 'Changed' }, { confirmed: true, key }),
  ).rejects.toThrow()
})
test('matching identities do not require acknowledgement', async () => {
  await expect(
    verifyLabReportIdentity(report, { ...client, dob: '1990-01-15' }, undefined),
  ).resolves.toBeUndefined()
})
