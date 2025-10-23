import { z } from 'zod';
import { personalInfoFieldSchema } from '../field-groups/PersonalInfoGroup';
import { accountInfoFieldSchema } from '../field-groups/AccountInfoGroup';
import { screeningRequestFieldSchema } from '../field-groups/ScreeningRequestGroup';
import { termsAndConditionsFieldSchema } from '../field-groups/TermsAndConditionsGroup';

// Step 1: Personal Information - reusing field group schema
export const personalInfoSchema = z.object({
  personalInfo: personalInfoFieldSchema,
});

// Step 2: Account Information - reusing field group schema with password confirmation validation
export const accountInfoSchema = z.object({
  accountInfo: accountInfoFieldSchema,
}).refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
  error: "Passwords don't match",
  path: ['accountInfo', 'confirmPassword'],
});

// Step 3: Screening Request - reusing field group schema
export const screeningRequestSchema = z.object({
  screeningRequest: screeningRequestFieldSchema,
});

// Step 4: Results Recipient (dynamic validation based on requestedBy)
export const resultsRecipientSchema = z.object({
  resultsRecipient: z.object({
    // Self-pay recipient fields
    useSelfAsRecipient: z.boolean().optional(),
    alternativeRecipientName: z.string().optional(),
    alternativeRecipientEmail: z.union([z.email(), z.literal('')]).optional(),

    // Employment recipient fields
    employerName: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.union([z.email(), z.literal('')]).optional(),

    // Probation/Court recipient fields
    selectedCourt: z.string().optional(),
    selectedCircuitOfficer: z.string().optional(),
    courtName: z.string().optional(),
    probationOfficerName: z.string().optional(),
    probationOfficerEmail: z.union([z.email(), z.literal('')]).optional(),
  }),
  screeningRequest: z.object({
    requestedBy: z.enum(['probation', 'employment', 'self']),
  }),
}).superRefine((data, ctx) => {
  const { resultsRecipient, screeningRequest } = data;
  const { requestedBy } = screeningRequest;

  if (requestedBy === 'self') {
    if (resultsRecipient.useSelfAsRecipient === false) {
      if (!resultsRecipient.alternativeRecipientName) {
        ctx.addIssue({
          code: 'custom',
          message: 'Recipient name is required',
          path: ['resultsRecipient', 'alternativeRecipientName'],
        });
      }
      if (!resultsRecipient.alternativeRecipientEmail) {
        ctx.addIssue({
          code: 'custom',
          message: 'Recipient email is required',
          path: ['resultsRecipient', 'alternativeRecipientEmail'],
        });
      }
    }
  } else if (requestedBy === 'employment') {
    if (!resultsRecipient.employerName) {
      ctx.addIssue({
        code: 'custom',
        message: 'Employer name is required',
        path: ['resultsRecipient', 'employerName'],
      });
    }
    if (!resultsRecipient.contactName) {
      ctx.addIssue({
        code: 'custom',
        message: 'Contact name is required',
        path: ['resultsRecipient', 'contactName'],
      });
    }
    if (!resultsRecipient.contactEmail) {
      ctx.addIssue({
        code: 'custom',
        message: 'Contact email is required',
        path: ['resultsRecipient', 'contactEmail'],
      });
    }
  } else if (requestedBy === 'probation') {
    if (!resultsRecipient.selectedCourt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select a court',
        path: ['resultsRecipient', 'selectedCourt'],
      });
    }

    // Charlevoix Circuit Court requires officer selection
    if (resultsRecipient.selectedCourt === 'charlevoix-circuit' && !resultsRecipient.selectedCircuitOfficer) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select a probation officer',
        path: ['resultsRecipient', 'selectedCircuitOfficer'],
      });
    }

    // "Other" or courts without pre-configured recipients require manual entry
    const requiresManualEntry = ['other', 'charlevoix-circuit-bond'].includes(resultsRecipient.selectedCourt || '');
    if (requiresManualEntry) {
      if (!resultsRecipient.courtName) {
        ctx.addIssue({
          code: 'custom',
          message: 'Court name is required',
          path: ['resultsRecipient', 'courtName'],
        });
      }
      if (!resultsRecipient.probationOfficerName) {
        ctx.addIssue({
          code: 'custom',
          message: 'Probation officer name is required',
          path: ['resultsRecipient', 'probationOfficerName'],
        });
      }
      if (!resultsRecipient.probationOfficerEmail) {
        ctx.addIssue({
          code: 'custom',
          message: 'Probation officer email is required',
          path: ['resultsRecipient', 'probationOfficerEmail'],
        });
      }
    }
  }
});

// Step 5: Terms and Conditions - reusing field group schema
export const termsAndConditionsSchema = z.object({
  termsAndConditions: termsAndConditionsFieldSchema,
});

// Complete form schema for final validation
export const completeRegistrationSchema = z.object({
  personalInfo: personalInfoSchema.shape.personalInfo,
  accountInfo: accountInfoSchema.shape.accountInfo,
  screeningRequest: screeningRequestSchema.shape.screeningRequest,
  resultsRecipient: resultsRecipientSchema.shape.resultsRecipient,
  termsAndConditions: termsAndConditionsSchema.shape.termsAndConditions,
}).refine((data) => data.accountInfo.password === data.accountInfo.confirmPassword, {
  message: "Passwords don't match",
  path: ['accountInfo', 'confirmPassword'],
});

// Step schemas array for the stepper hook
export const stepSchemas = [
  personalInfoSchema,
  accountInfoSchema,
  screeningRequestSchema,
  resultsRecipientSchema,
  termsAndConditionsSchema,
];

// Type inference
export type RegistrationFormType = z.infer<typeof completeRegistrationSchema>;