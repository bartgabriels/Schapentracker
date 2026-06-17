import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { prisma } from './prisma.js'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'flockops-server' })
})

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'connected' })
  } catch (error) {
    res.status(500).json({ ok: false, db: 'error', message: error.message })
  }
})

app.listen(port, () => {
  console.log(`FlockOps server listening on http://localhost:${port}`)
})
