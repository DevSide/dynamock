import { z } from 'zod'

export const FixtureRequestOptionsSchema = z
  .object({
    origin: z
      .object({
        allowRegex: z.boolean(),
      })
      .strict()
      .partial(),
    path: z
      .object({
        allowRegex: z.boolean(),
        disableEncodeURI: z.boolean(),
      })
      .strict()
      .partial()
      .refine((value) => !(value.allowRegex === true && value.disableEncodeURI === true), {
        message: 'Cannot use options.path.allowRegex and options.path.disableEncodeURI together',
      }),
    method: z
      .object({
        allowRegex: z.boolean(),
      })
      .strict()
      .partial(),
    headers: z
      .object({
        strict: z.boolean(),
        allowRegex: z.boolean(),
      })
      .strict()
      .partial()
      .refine((value) => !(value.strict === true && value.allowRegex === true), {
        message: 'Cannot use options.headers.strict and options.headers.allowRegex together',
      }),
    cookies: z
      .object({
        strict: z.boolean(),
        allowRegex: z.boolean(),
      })
      .strict()
      .partial()
      .refine((value) => !(value.strict === true && value.allowRegex === true), {
        message: 'Cannot use options.cookies.strict and options.cookies.allowRegex together',
      }),
    query: z
      .object({
        strict: z.boolean(),
        allowRegex: z.boolean(),
      })
      .strict()
      .partial()
      .refine((value) => !(value.strict === true && value.allowRegex === true), {
        message: 'Cannot use options.query.strict and options.query.allowRegex together',
      }),
    body: z
      .object({
        strict: z.boolean(),
        allowRegex: z.boolean(),
      })
      .strict()
      .partial()
      .refine((value) => !(value.strict === true && value.allowRegex === true), {
        message: 'Cannot use options.body.strict and options.body.allowRegex together',
      }),
  })
  .partial()

export const RecordOrArrayWithConfigurationSchema = z.union([
  z.record(z.string()),
  z.array(z.union([z.string(), z.record(z.string())])),
])

export const FixtureRequestSchema = z
  .object({
    origin: z.string(),
    path: z.union([z.literal('*'), z.string().startsWith('/')]),
    method: z.string(),
    headers: RecordOrArrayWithConfigurationSchema.nullish(),
    cookies: RecordOrArrayWithConfigurationSchema.nullish(),
    query: RecordOrArrayWithConfigurationSchema.nullish(),
    body: z.unknown(),
    options: FixtureRequestOptionsSchema.nullish(),
  })
  .strict()
  .partial({
    headers: true,
    cookies: true,
    query: true,
    body: true,
    options: true,
  })
  .refine(
    (data) => data.options?.method?.allowRegex || /^(head|delete|put|post|get|options|patch|\*)$/i.test(data.method),
    {
      message: 'Method not allowed, expecting /^(head|delete|put|post|get|options|patch|\\*)$/i',
    },
  )

export const FixtureResponseSchema = z
  .object({
    status: z.number().min(200).max(600),
    headers: RecordOrArrayWithConfigurationSchema.nullish(),
    cookies: RecordOrArrayWithConfigurationSchema.nullish(),
    query: RecordOrArrayWithConfigurationSchema.nullish(),
    body: z.unknown(),
    filepath: z.string(),
    options: z
      .object({
        delay: z.number().nonnegative(),
        lifetime: z.number().nonnegative(),
      })
      .strict()
      .partial()
      .nullish(),
  })
  .strict()
  .partial({
    status: true,
    headers: true,
    cookies: true,
    query: true,
    body: true,
    filepath: true,
    options: true,
  })
  .refine((data) => !(data.body && data.filepath), {
    message: 'Cannot use both response.body and response.filepath',
  })

export const FixtureSchema = z.union([
  z.object({
    request: FixtureRequestSchema,
    response: FixtureResponseSchema,
  }),
  z.object({
    request: FixtureRequestSchema,
    responses: z.array(FixtureResponseSchema).nonempty(),
  }),
])
