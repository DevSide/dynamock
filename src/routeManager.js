const { isObjectEmpty, sortObjectKeys, hash } = require('./utils')

function normalizeRoute (unsafeRoute) {
  const route = sortObjectKeys(unsafeRoute)

  for (const prop in route) {
    const property = route[prop]
    if (typeof property === 'object' && !Array.isArray(property)) {
      if (isObjectEmpty(property) || property === null) {
        delete route[prop]
      } else {
        route[prop] = sortObjectKeys(unsafeRoute)
      }
    }
  }

  return route
}

exports.getRouteId = function getRouteId (app, unsafeRoute) {
  const route = normalizeRoute(unsafeRoute)
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
    if (!route) {
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
