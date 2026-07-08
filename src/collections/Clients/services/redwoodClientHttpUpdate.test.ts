import { describe, expect, it } from 'vitest'

import { buildRedwoodHttpClientUpdatePlan } from './redwoodClientHttpUpdate'

describe('redwood HTTP client update planning', () => {
  it('maps Payload client fields to Redwood donor form controls', () => {
    const plan = buildRedwoodHttpClientUpdatePlan({
      changedFields: ['firstName', 'middleInitial', 'lastName', 'dob', 'gender', 'phone'],
      client: {
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
})
