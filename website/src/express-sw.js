const expressSw = require('express-service')
const app = require('../../src/createServer')()
const cacheName = 'dynamock'
const cacheUrls = []
expressSw(app, cacheUrls, cacheName)
