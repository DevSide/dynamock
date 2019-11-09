const Joi = require('@hapi/joi')

const schema = Joi.object({
  headers: Joi.object(),
  query: Joi.object(),
  cookies: Joi.object()
}).required()

exports.validateConfiguration = function validateConfiguration (
  unsafeConfiguration
) {
  return schema.validate(unsafeConfiguration).error
}
