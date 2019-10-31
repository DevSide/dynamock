const { isObjectEmpty, sortObjectKeys, hash } = require('./utils')

function normalizeFixture (unsafeFixture) {
  const fixture = {
    request: sortObjectKeys(unsafeFixture.request),
    response: sortObjectKeys(unsafeFixture.response)
  }

  for (const requestOrResponse of [fixture.request, fixture.response]) {
    for (const property in requestOrResponse) {
      if (property === 'body') {
        continue
      }

      const propertyValue = requestOrResponse[property]

      if (typeof propertyValue === 'object' && !Array.isArray(propertyValue)) {
        if (isObjectEmpty(propertyValue) || propertyValue === null) {
          delete requestOrResponse[property]
        } else {
          requestOrResponse[property] = sortObjectKeys(propertyValue)
        }
      }
    }
  }

  return fixture
}

exports.getRouteId = function getRouteId (app, unsafeFixture) {
  const route = normalizeFixture(unsafeFixture)
  const routeId = '_' + hash(JSON.stringify(route))

  const doesRouteAlreadyIn = app._router.stack.some(({ name, route }) => {
    return (
      name === routeId ||
      (route && route.stack.some(({ name }) => name === routeId))
    )
  })

  if (doesRouteAlreadyIn) {
    return {
      error: 'already exists',
      routeId
    }
  }

  return {
    error: '',
    routeId
  }
}

exports.removeRoute = function removeRoute (app, routeId) {
  let removed = false

  app._router.stack.forEach(({ route }) => {
    if (!route || removed) {
      return
    }

    const routeIndex = route.stack.findIndex(
      ({ handle }) => handle.name === routeId
    )

    if (routeIndex >= 0) {
      route.stack.splice(routeIndex, 1)
      removed = true
    }
  })

  return removed
}

const ROUTE_REGEXP = /_[a-f0-9]{40}/

exports.removeRoutes = function removeRoutes (app) {
  app._router.stack.forEach(({ route }) => {
    if (!route) {
      return
    }

    for (let i = route.stack.length - 1; i >= 0; i--) {
      const { name } = route.stack[i]
      if (ROUTE_REGEXP.test(name)) {
        route.stack.splice(i, 1)
      }
    }
  })
}
