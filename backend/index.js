const express = require('express')
const app = express()
const port = 3000

// bon la on definit les routes quoi
// app.use('/api', apiRouter) par exemple pour les routes de l'api


app.get('/', (req, res) => {
  res.status(200).json({ message: 'Presto API' })
})

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})