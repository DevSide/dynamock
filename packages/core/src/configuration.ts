import Joi from '@hapi/joi'

export type ConfigurationObjectType = {
  [key: string]: {
    [key: string]: string
  }
}

export type ConfigurationType = {
  cors: null | '*'
  headers: ConfigurationObjectType
  query: ConfigurationObjectType
  cookies: ConfigurationObjectType
}

const schema = Joi.object({
  cors: Joi.alternatives([Joi.string().valid('*'), Joi.object().valid(null)]),
  headers: Joi.object(),
  query: Joi.object(),
  cookies: Joi.object(),
}).required()

export function validateConfiguration(unsafeConfiguration: unknown) {
  return schema.validate(unsafeConfiguration).error
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
