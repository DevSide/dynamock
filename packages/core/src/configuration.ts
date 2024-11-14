import { z } from 'zod'

const ConfigurationObjectSchema = z.record(z.record(z.string()))

const ConfigurationSchema = z
  .object({
    cors: z.union([z.literal('*'), z.literal(null)]),
    headers: z.record(z.record(z.string())),
    query: z.record(z.record(z.string())),
    cookies: z.record(z.record(z.string())),
  })
  .strict()

const ConfigurationPartialSchema = ConfigurationSchema.partial()

export type ConfigurationObjectType = z.infer<typeof ConfigurationObjectSchema>
export type ConfigurationPartialType = z.infer<typeof ConfigurationPartialSchema>
export type ConfigurationType = z.infer<typeof ConfigurationSchema>

export function validateConfiguration(unsafeConfiguration: unknown) {
  return ConfigurationPartialSchema.safeParse(unsafeConfiguration)
}

export function createConfiguration(): ConfigurationType {
  return {
    cors: null,
    headers: {},
    query: {},
    cookies: {},
  }
}

export function updateConfiguration(
  configuration: ConfigurationType,
  cors: undefined | null | '*',
  headers: undefined | ConfigurationObjectType,
  query: undefined | ConfigurationObjectType,
  cookies: undefined | ConfigurationObjectType,
) {
  if (cors !== undefined) {
    configuration.cors = cors === '*' ? '*' : null
  }

  if (headers) {
    Object.assign(configuration.headers, headers)
  }

  if (query) {
    Object.assign(configuration.query, query)
  }

  if (cookies) {
    Object.assign(configuration.cookies, cookies)
  }
}
