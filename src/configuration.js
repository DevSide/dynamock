const Joi = require('@hapi/joi')

const schema = Joi.object({
  cors: Joi.alternatives([Joi.string().valid('*'), Joi.object().valid(null)]),
  headers: Joi.object(),
  query: Joi.object(),
  cookies: Joi.object(),
}).required()

exports.validateConfiguration = function validateConfiguration(unsafeConfiguration) {
  return schema.validate(unsafeConfiguration).error
}

exports.createConfiguration = function createConfiguration() {
  return {
    cors: null,
    headers: {},
    query: {},
    cookies: {},
  }
}

exports.updateConfiguration = function updateConfiguration(configuration, cors, headers, query, cookies) {
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
