import Joi from '@hapi/joi'

const schema = Joi.object({
  cors: Joi.alternatives([Joi.string().valid('*'), Joi.object().valid(null)]),
  headers: Joi.object(),
  query: Joi.object(),
  cookies: Joi.object(),
}).required()

export function validateConfiguration(unsafeConfiguration) {
  return schema.validate(unsafeConfiguration).error
}

export function createConfiguration() {
  return {
    cors: null,
    headers: {},
    query: {},
    cookies: {},
  }
}

export function updateConfiguration(configuration, cors, headers, query, cookies) {
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
