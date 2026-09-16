import { z } from "zod";

export const fhirHumanNameSchema = z.object({
  family: z.string(),
  given: z.array(z.string()).min(1),
});

export const fhirAddressSchema = z.object({
  line: z.array(z.string()).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

export const fhirContactSchema = z.object({
  relationship: z.array(z.object({ text: z.string().optional() })).optional(),
  name: fhirHumanNameSchema.optional(),
});

export const fhirPatientSchema = z.object({
  resourceType: z.literal("Patient"),
  id: z.string(),
  name: z.array(fhirHumanNameSchema).min(1),
  birthDate: z.string(),
  address: z.array(fhirAddressSchema).optional(),
  contact: z.array(fhirContactSchema).optional(),
});

export const fhirEncounterSchema = z.object({
  resourceType: z.literal("Encounter"),
  id: z.string(),
  subject: z.object({
    reference: z.string(),
  }),
  participant: z
    .array(
      z.object({
        individual: z
          .object({
            display: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  class: z
    .union([
      z.object({ code: z.string().optional() }),
      z.object({ coding: z.array(z.object({ code: z.string().optional() })).optional() }),
    ])
    .optional(),
  period: z
    .object({
      start: z.string().optional(),
      end: z.string().optional(),
    })
    .optional(),
  type: z
    .array(
      z.object({
        text: z.string().optional(),
      }),
    )
    .optional(),
});

export const fhirBundleSchema = z.object({
  resourceType: z.literal("Bundle"),
  type: z.string(),
  entry: z.array(
    z.object({
      resource: z.union([
        fhirPatientSchema,
        fhirEncounterSchema,
        z.object({ resourceType: z.string() }),
      ]),
    }),
  ),
});

export type FhirPatient = z.infer<typeof fhirPatientSchema>;
export type FhirEncounter = z.infer<typeof fhirEncounterSchema>;
export type FhirBundle = z.infer<typeof fhirBundleSchema>;
