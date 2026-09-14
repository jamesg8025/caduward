import {
  DEFAULT_GENERATOR_CONFIG,
  type GeneratorConfig,
  generatorConfigSchema,
} from "@caduward/shared";

export type { GeneratorConfig };

export function loadConfig(overrides?: Partial<GeneratorConfig>): GeneratorConfig {
  const raw = { ...DEFAULT_GENERATOR_CONFIG, ...overrides };
  return generatorConfigSchema.parse(raw);
}
