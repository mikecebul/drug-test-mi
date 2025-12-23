import z from 'zod'

export const steps = ['clientData', 'medicationsData']

export const verifyClientFieldSchema = z.object({
  clientData: z.object({
    id: z.string().min(1, 'Please select a client'),
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string().nullable(),
    email: z.string(),
    dob: z.string().nullable(),
    headshot: z.string().nullable(),
  }),
})

export const verifyMedicationsFieldSchema = z.object({
  medicationsData: z.object({
    medications: z.array(z.any()), // Array of medications to be saved at the end
  }),
})

export const formSchema = z.object({
  section: z.enum(['clientData', 'medicationsData']),
  ...verifyClientFieldSchema.shape,
  ...verifyMedicationsFieldSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>
