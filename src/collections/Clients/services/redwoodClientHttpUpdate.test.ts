import { describe, expect, it } from 'vitest'

import {
  buildRedwoodHttpClientUpdatePlan,
  redwoodResponseHasValidationFailure,
  resolveRedwoodIntakeDateRepair,
} from './redwoodClientHttpUpdate'

describe('redwood HTTP client update planning', () => {
  it('maps Payload client fields to Redwood donor form controls', () => {
    const plan = buildRedwoodHttpClientUpdatePlan({
      changedFields: ['firstName', 'middleInitial', 'lastName', 'dob', 'gender', 'phone'],
      client: {
        createdAt: '2026-08-19T14:00:00.000Z',
        dob: '1982-03-13',
        firstName: 'Bob',
        gender: 'male',
        id: 'client-1',
        lastName: 'Testing',
        middleInitial: 'F',
        phone: '(231) 373-6341',
      },
    })

    expect(plan).toEqual([
      {
        expectedValue: 'Bob',
        field: 'firstName',
        formName: 'ctl00$PageContent$Donor$txtFirstName',
      },
      {
        expectedValue: 'F',
        field: 'middleInitial',
        formName: 'ctl00$PageContent$Donor$txtMI',
      },
      {
        expectedValue: 'Testing',
        field: 'lastName',
        formName: 'ctl00$PageContent$Donor$txtLastName',
      },
      {
        expectedValue: '03/13/1982',
        field: 'dob',
        formName: 'ctl00$PageContent$Donor$txtDateofBirth',
      },
      {
        expectedValue: 'rdbMale',
        field: 'gender',
        formName: 'ctl00$PageContent$Donor$sex',
      },
      {
        expectedValue: '231-373-6341',
        field: 'phone',
        formName: 'ctl00$PageContent$Donor$txtPhoneNum',
      },
    ])
  })

  it('deduplicates requested fields', () => {
    const plan = buildRedwoodHttpClientUpdatePlan({
      changedFields: ['phone', 'phone'],
      client: {
        createdAt: '2026-08-19T14:00:00.000Z',
        firstName: 'Bob',
        id: 'client-1',
        lastName: 'Testing',
        phone: '2313736341',
      },
    })

    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({
      expectedValue: '231-373-6341',
      field: 'phone',
      formName: 'ctl00$PageContent$Donor$txtPhoneNum',
    })
  })

  it('repairs an intake date that would precede the corrected DOB', () => {
    expect(
      resolveRedwoodIntakeDateRepair({
        clientCreatedAt: '2026-02-17T16:30:00.000Z',
        currentIntakeDate: '02/17/1978',
        expectedDob: '02/18/1978',
      }),
    ).toBe('02/17/2026')
  })

  it('repairs any intake date that does not match the Payload registration date', () => {
    expect(
      resolveRedwoodIntakeDateRepair({
        clientCreatedAt: '2026-02-17T16:30:00.000Z',
        currentIntakeDate: '08/01/2025',
        expectedDob: '02/17/1978',
      }),
    ).toBe('02/17/2026')
  })

  it('uses the Eastern registration date when the Payload timestamp crosses midnight in UTC', () => {
    expect(
      resolveRedwoodIntakeDateRepair({
        clientCreatedAt: '2026-02-18T03:30:00.000Z',
        currentIntakeDate: '02/17/1978',
        expectedDob: '02/18/1978',
      }),
    ).toBe('02/17/2026')
  })

  it('preserves an intake date that already matches the Payload registration date', () => {
    expect(
      resolveRedwoodIntakeDateRepair({
        clientCreatedAt: '2026-02-17T16:30:00.000Z',
        currentIntakeDate: '02/17/2026',
        expectedDob: '02/18/1978',
      }),
    ).toBeNull()
  })

  it('identifies an active ToxAccess intake-date validator in a refused save response', () => {
    expect(
      redwoodResponseHasValidationFailure(
        '<span id="PageContent_Donor_cvIntakeDate" style="color:#E4002B;">*</span>',
        'PageContent_Donor_cvIntakeDate',
      ),
    ).toBe(true)
    expect(
      redwoodResponseHasValidationFailure(
        '<span id="PageContent_Donor_cvIntakeDate" style="display:none;">*</span>',
        'PageContent_Donor_cvIntakeDate',
      ),
    ).toBe(false)
    expect(
      redwoodResponseHasValidationFailure(
        'PageContent_Donor_cvIntakeDate.isvalid = "False";',
        'PageContent_Donor_cvIntakeDate',
      ),
    ).toBe(true)
  })
})
