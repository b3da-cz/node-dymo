const NodeDymo = require('./NodeDymo.js').NodeDymo

const s = new NodeDymo()
s.init()
s.on('weight-change', res => {
  console.log(`${res.value} ${res.system}`)
})
