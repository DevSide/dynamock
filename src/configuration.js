const Joi = require('@hapi/joi')

const schema = Joi.object({
  headers: Joi.object(),
  query: Joi.object(),
  cookies: Joi.object()
}).required()

exports.validateConfiguration = function validateConfiguration (unsafeConfiguration) {
  return schema.validate(unsafeConfiguration).error
}

exports.createConfiguration = function createConfiguration () {
  return {
    headers: {},
    query: {},
    cookies: {}
  }
}

exports.updateConfiguration = function updateConfiguration (configuration, headers, query, cookies) {
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
