import type { Where } from 'payload'

interface RegistrationIdentity {
  firstName: string
  lastName: string
  dob: string
}

export function registrationDuplicateWhere({ firstName, lastName, dob }: RegistrationIdentity): Where {
  return {
    and: [{ firstName: { equals: firstName } }, { lastName: { equals: lastName } }, { dob: { equals: dob } }],
  }
}
