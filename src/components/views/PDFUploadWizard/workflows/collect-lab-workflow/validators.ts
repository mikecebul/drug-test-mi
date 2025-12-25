import z from 'zod'

export const steps = ['client', 'medications', 'collection', 'confirm'] as const
export type Steps = typeof steps

export const clientSchema = z.object({
  client: z.object({
    id: z.string().min(1, 'Please select a client'),
    firstName: z.string(),
    lastName: z.string(),
    middleInitial: z.string().nullable(),
    email: z.string(),
    dob: z.string().nullable(),
    headshot: z.string().nullable(),
  }),
})

export const medicationsSchema = z.object({
  medications: z.array(z.any()), // Array of medications to be saved at the end
})

export const collectionSchema = z.object({
  collection: z
    .object({
      testType: z.enum(['11-panel-lab', '17-panel-sos-lab', 'etg-lab']),
      collectionDate: z.string().min(1, 'Collection date is required'),
      collectionTime: z.string().min(1, 'Collection time is required'),
      breathalyzerTaken: z.boolean(),
      breathalyzerResult: z.number().nullable().optional(),
    })
    .superRefine((data, ctx) => {
      // If breathalyzer is checked, validate result
      if (data.breathalyzerTaken) {
        if (data.breathalyzerResult === null || data.breathalyzerResult === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Breathalyzer result is required',
            path: ['breathalyzerResult'],
          })
        } else if (data.breathalyzerResult < 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Breathalyzer result cannot be negative',
            path: ['breathalyzerResult'],
          })
        }
      }
    }),
})

export const formSchema = z.object({
  step: z.enum(steps),
  ...clientSchema.shape,
  ...medicationsSchema.shape,
  ...collectionSchema.shape,
})

export type FormValues = z.infer<typeof formSchema>
