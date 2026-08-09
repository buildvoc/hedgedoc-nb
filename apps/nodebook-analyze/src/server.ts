/*
 * SPDX-FileCopyrightText: 2026 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import Fastify from 'fastify'
import { llmConfigFromEnv, NodeBookAnalyzeService } from './analyze-service'

// Standalone nodeBook analyze service. Mirrors the endpoints the frontend
// already calls at /api/private/nodebook/* — the reverse proxy strips the
// prefix and MUST enforce authentication (e.g. Caddy forward_auth against
// HedgeDoc's /api/private/me), because this service performs LLM calls with
// a configured API key and does no authentication of its own.

const service = new NodeBookAnalyzeService(llmConfigFromEnv())
const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 })

app.get('/healthz', () => ({ ok: true }))

app.get('/status', () => service.getStatus())

interface AnalyzeBody {
  text?: unknown
  categories?: unknown
}

app.post('/analyze', async (request, reply) => {
  if (!service.isConfigured()) {
    return reply.status(501).send({ message: 'LLM service is not configured' })
  }
  const body = (request.body ?? {}) as AnalyzeBody
  const text = typeof body.text === 'string' ? body.text : null
  const categories = Array.isArray(body.categories) ? body.categories.filter((c) => typeof c === 'string') : null
  if (!text || text.length === 0 || !categories || categories.length === 0) {
    return reply.status(400).send({ message: 'text and categories are required' })
  }
  if (text.length > 100_000) {
    return reply.status(400).send({ message: 'text too long' })
  }
  try {
    return await service.analyze(text, categories as never)
  } catch (error) {
    request.log.error(error)
    return reply.status(500).send({ message: 'Text analysis failed' })
  }
})

const port = Number(process.env.PORT ?? 8600)
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`nodebook-analyze listening on :${port}`))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
