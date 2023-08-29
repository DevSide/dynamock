const { outputs } = require('../app.json')
const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')

const replacement = Object.keys(outputs)
  .map(output => {
    const assetPath = output.split('/').slice(-1)[0]

    if (assetPath.endsWith('.js')) {
      return `<script async src="${assetPath}"></script>`
    }

    if (assetPath.endsWith('.css')) {
      return `<link rel="stylesheet" href="${assetPath}">`
    }

    return ''
  })
  .join('\n')

const template = readFileSync('src/index.html').toString()
writeFileSync('public/index.html', template.replace('##ASSETS##', replacement))
