import { z } from "zod";

export const ANOMALY_TYPES = [
  "no_encounter",
  "off_shift",
  "relationship_snoop",
  "vip_access",
  "self_access",
  "dormant_reactivation",
] as const;

export const anomalyTypeSchema = z.enum(ANOMALY_TYPES);
export type AnomalyType = z.infer<typeof anomalyTypeSchema>;

export const ACCESS_TYPES = ["view", "edit", "print"] as const;

export const accessTypeSchema = z.enum(ACCESS_TYPES);
export type AccessType = z.infer<typeof accessTypeSchema>;

export const STAFF_ROLES = ["nurse", "physician", "admin", "lab_tech", "radiologist"] as const;

export const staffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const DEPARTMENTS = [
  "Emergency",
  "Cardiology",
  "Oncology",
  "Pediatrics",
  "General Medicine",
  "Surgery",
  "Radiology",
  "Lab",
] as const;

export const departmentSchema = z.enum(DEPARTMENTS);
export type Department = z.infer<typeof departmentSchema>;

const anomalyMixSchema = z.record(anomalyTypeSchema, z.number().min(0).max(1)).refine((mix) => {
  const sum = Object.values(mix).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) < 0.001;
}, "anomalyMix values must sum to 1");

export const generatorConfigSchema = z.object({
  totalEvents: z.number().int().positive(),
  anomalyRate: z.number().min(0).max(1),
  anomalyMix: anomalyMixSchema,
  seed: z.number().int(),
  staffCount: z.number().int().positive().default(200),
  timeWindowDays: z.number().int().positive().default(30),
});

export type GeneratorConfig = z.infer<typeof generatorConfigSchema>;

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
  totalEvents: 100_000,
  anomalyRate: 0.015,
  anomalyMix: {
    no_encounter: 0.3,
    off_shift: 0.25,
    relationship_snoop: 0.15,
    vip_access: 0.15,
    self_access: 0.05,
    dormant_reactivation: 0.1,
  },
  seed: 42,
  staffCount: 200,
  timeWindowDays: 30,
};
