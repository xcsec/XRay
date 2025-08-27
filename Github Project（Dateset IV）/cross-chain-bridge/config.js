const path = require('path')
const fs = require('fs')

const filePath = path.resolve(__dirname, 'artifacts/contracts', 'Token.sol', 'Token.json')
const src = fs.readFileSync(filePath, 'utf8')
module.exports = JSON.parse(src)