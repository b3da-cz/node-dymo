const s = require('./index')

s.init()
s.on('weight-change', res => {
  console.log(`${res.value} ${res.system}`)
})
