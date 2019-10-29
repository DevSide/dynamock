exports.removeRoute = function removeRoute (app, routeName) {
  let removed = false

  app._router.stack.forEach(({ route }) => {
    if (!route) {
      return
    }

    const routeIndex = route.stack.findIndex(
      ({ handle }) => handle.name === routeName
    )

    if (routeIndex >= 0) {
      route.stack.splice(routeIndex, 1)
      removed = true
    }
  })

  return removed
}

exports.removeRoutes = function removeRoutes (app) {
  app._router.stack.forEach(({ route }) => {
    if (!route) {
      return
    }

    route.stack = []
  })
}

exports.isRouteAlreadyRegistered = function isRouteAlreadyRegistered (
  app,
  routeName
) {
  const _routeName = '_' + routeName

  return app._router.stack.some(({ name, route }) => {
    if (name === _routeName) {
      return true
    }

    if (route && route.stack.some(({ name }) => name === _routeName)) {
      return true
    }

    return false
  })
}
