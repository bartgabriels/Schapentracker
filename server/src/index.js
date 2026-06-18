import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import crypto from 'node:crypto'
import { prisma } from './prisma.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || 24 * 30)
const corsOrigin = process.env.CORS_ORIGIN || '*'

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }))
app.use(express.json())

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function validateCredentials(email, password) {
  if (!email || !password) return 'Email and password are required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please provide a valid email address.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  return null
}

function normalizePreferredLanguage(value) {
  const lang = String(value || '').trim().toLowerCase()
  return lang === 'en' || lang === 'fr' ? lang : 'nl'
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || '').split(':')
  if (!salt || !key) return false
  const hashBuffer = crypto.scryptSync(password, salt, 64)
  const keyBuffer = Buffer.from(key, 'hex')
  if (hashBuffer.length !== keyBuffer.length) return false
  return crypto.timingSafeEqual(hashBuffer, keyBuffer)
}

function createSessionToken() {
  return crypto.randomBytes(48).toString('base64url')
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ ok: false, message: 'Missing auth token.' })
    return
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } })
    }
    res.status(401).json({ ok: false, message: 'Session expired. Please log in again.' })
    return
  }

  req.user = session.user
  req.session = session
  next()
}

app.post('/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email ?? req.body?.username)
    const password = String(req.body?.password || '')
    const preferredLanguage = normalizePreferredLanguage(req.body?.preferredLanguage)
    const validationError = validateCredentials(email, password)
    if (validationError) {
      res.status(400).json({ ok: false, message: validationError })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username: email } })
    if (existing) {
      res.status(409).json({ ok: false, message: 'Email is already registered.' })
      return
    }

    const user = await prisma.user.create({
      data: {
        username: email,
        passwordHash: hashPassword(password),
        cloudState: {
          settings: {
            language: preferredLanguage,
            showAllOutOfFlockSheep: true
          }
        }
      }
    })

    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000)
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    })

    res.status(201).json({ ok: true, username: user.username, token, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email ?? req.body?.username)
    const password = String(req.body?.password || '')
    if (!email || !password) {
      res.status(400).json({ ok: false, message: 'Email and password are required.' })
      return
    }

    const user = await prisma.user.findUnique({ where: { username: email } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ ok: false, message: 'Invalid email or password.' })
      return
    }

    const token = createSessionToken()
    const expiresAt = new Date(Date.now() + sessionTtlHours * 3600 * 1000)
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    })

    res.json({ ok: true, username: user.username, token, expiresAt: expiresAt.toISOString() })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/auth/logout', authMiddleware, async (req, res) => {
  await prisma.session.delete({ where: { id: req.session.id } })
  res.json({ ok: true })
})

app.get('/auth/me', authMiddleware, async (req, res) => {
  res.json({ ok: true, username: req.user.username })
})

app.get('/state', authMiddleware, async (req, res) => {
  res.json({ ok: true, data: req.user.cloudState || null })
})

app.put('/state', authMiddleware, async (req, res) => {
  const data = req.body?.data
  if (!data || typeof data !== 'object') {
    res.status(400).json({ ok: false, message: 'Invalid state payload.' })
    return
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { cloudState: data }
  })

  res.json({ ok: true })
})

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
