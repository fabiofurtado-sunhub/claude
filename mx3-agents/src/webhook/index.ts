import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AnthropicService } from '../services/anthropic.service.js'
import { SupabaseService } from '../services/supabase.service.js'
import { ZapiService } from '../services/zapi.service.js'
import { MemoryAgent } from '../agents/memory.agent.js'
import { SDRAgent } from '../agents/sdr.agent.js'
import { BDRAgent } from '../agents/bdr.agent.js'
import { CopywriterAgent } from '../agents/copywriter.agent.js'
import { FollowupAgent } from '../agents/followup.agent.js'
import { CoordinatorAgent } from '../agents/coordinator.agent.js'
import { LearningLoop } from '../utils/learning.js'
import type {
  ZapiWebhookPayload,
  AgentContributions,
} from '../types/index.js'

// ──────────────────────────────────────────────
// INICIALIZAÇÃO DOS SERVIÇOS (singleton)
// ──────────────────────────────────────────────

const anthropic = new AnthropicService()
const supabase = new SupabaseService()
const zapi = new ZapiService()

const memoryAgent = new MemoryAgent(supabase, anthropic)
const sdrAgent = new SDRAgent(anthropic)
const bdrAgent = new BDRAgent(anthropic)
const copywriterAgent = new CopywriterAgent(anthropic)
const followupAgent = new FollowupAgent(anthropic)
const coordinatorAgent = new CoordinatorAgent(anthropic)
const learningLoop = new LearningLoop(supabase)

// ──────────────────────────────────────────────
// PROCESSAMENTO DO WEBHOOK
// ──────────────────────────────────────────────

/**
 * Fluxo principal do sistema multi-agente:
 * 1. Memory Agent → LeadContext
 * 2. 4 Agentes em paralelo → Contribuições
 * 3. Coordinator → Resposta final
 * 4. Salva interação + envia via Zapi
 * 5. Inicia Learning Loop assíncrono
 */
async function processIncomingMessage(payload: ZapiWebhookPayload): Promise<void> {
  const phone = ZapiService.extractPhone(payload.phone)
  const message = payload.message?.trim()

  if (!message || message.length === 0) {
    console.warn(`[Webhook] Empty message from ${phone} — skipping`)
    return
  }

  console.log(`[Webhook] Incoming from ${phone}: "${message.slice(0, 80)}..."`)

  // ── STEP 1: Memory Agent — constrói contexto completo ──
  const context = await memoryAgent.buildContext(phone, message)
  console.log(`[Memory] Lead ${context.lead_id} — stage: ${context.stage}`)

  // ── STEP 2: Busca dias desde último contato (para Follow-up) ──
  const daysSinceLastContact = await supabase.getDaysSinceLastContact(context.lead_id)

  // ── STEP 3: 4 Agentes em PARALELO ──
  console.log(`[Agents] Running SDR, BDR, Copywriter, Followup in parallel...`)

  // Follow-up roda primeiro para alimentar Copywriter com temperatura
  // SDR e Follow-up são independentes — rodam em paralelo
  const [sdrContribution, followupContribution] = await Promise.all([
    sdrAgent.analyze(message, context),
    followupAgent.analyze(message, context, daysSinceLastContact),
  ])

  // BDR usa o resultado do SDR; Copywriter usa temperatura do Follow-up
  const [bdrContribution, copywriterContribution] = await Promise.all([
    bdrAgent.analyze(message, context, sdrContribution),
    copywriterAgent.analyze(message, context, {
      relationship_temperature: followupContribution.relationship_temperature,
      emotional_context: followupContribution.emotional_context,
    }),
  ])

  const contributions: AgentContributions = {
    sdr: sdrContribution,
    bdr: bdrContribution,
    copywriter: copywriterContribution,
    followup: followupContribution,
  }

  console.log(`[Agents] SDR score: ${sdrContribution.qualification_score} | BDR readiness: ${bdrContribution.meeting_readiness} | Temp: ${followupContribution.relationship_temperature}`)

  // ── STEP 4: Coordinator — síntese final ──
  const coordinatorOutput = await coordinatorAgent.synthesize(
    message,
    context,
    contributions
  )

  console.log(`[Coordinator] Primary skill: ${coordinatorOutput.primary_skill_used} | Confidence: ${coordinatorOutput.confidence_score}`)

  // ── STEP 5: Salva interação no banco ──
  const interactionId = await supabase.saveInteraction({
    leadId: context.lead_id,
    incomingMessage: message,
    sdrContribution,
    bdrContribution,
    copywriterContribution,
    followupContribution,
    coordinatorOutput,
    finalMessage: coordinatorOutput.final_message,
    leadContext: context,
  })

  // ── STEP 6: Salva performance de cada agente ──
  await Promise.all([
    supabase.saveAgentPerformance({
      leadId: context.lead_id,
      interactionId,
      agentName: 'sdr',
      contribution: sdrContribution,
      wasPrimary: coordinatorOutput.primary_skill_used === 'sdr',
    }),
    supabase.saveAgentPerformance({
      leadId: context.lead_id,
      interactionId,
      agentName: 'bdr',
      contribution: bdrContribution,
      wasPrimary: coordinatorOutput.primary_skill_used === 'bdr',
    }),
    supabase.saveAgentPerformance({
      leadId: context.lead_id,
      interactionId,
      agentName: 'copywriter',
      contribution: copywriterContribution,
      wasPrimary: coordinatorOutput.primary_skill_used === 'copywriter',
    }),
    supabase.saveAgentPerformance({
      leadId: context.lead_id,
      interactionId,
      agentName: 'followup',
      contribution: followupContribution,
      wasPrimary: coordinatorOutput.primary_skill_used === 'followup',
    }),
  ])

  // ── STEP 7: Atualiza estágio do lead se o SDR propôs mudança ──
  const proposedStage = sdrContribution.lead_stage as string
  const validStages = ['NOVO', 'EM_QUALIFICACAO', 'QUALIFICADO', 'EM_NEGOCIACAO', 'INATIVO', 'DESCARTADO']
  if (validStages.includes(proposedStage) && proposedStage !== context.stage) {
    await supabase.updateLead(context.lead_id, {
      stage: proposedStage as any,
      main_pain: sdrContribution.pain_identified || context.main_pain,
      urgency_level: bdrContribution.urgency_level,
    })
  }

  // ── STEP 8: Indica digitação + envia mensagem via Zapi ──
  const sentAt = new Date()

  try {
    await zapi.sendTyping(phone, 2000)
    await sleep(2000)
    await zapi.sendText({
      phone,
      message: coordinatorOutput.final_message,
    })
    console.log(`[Zapi] Message sent to ${phone}`)
  } catch (err) {
    console.error(`[Zapi] Failed to send message to ${phone}:`, err)
  }

  // ── STEP 9: Salva mensagem enviada no histórico ──
  await supabase.saveMessage(
    context.lead_id,
    'agent',
    coordinatorOutput.final_message,
    coordinatorOutput.primary_skill_used
  )

  // ── STEP 10: Inicia Learning Loop assíncrono (não bloqueia) ──
  learningLoop.startMonitoring({
    leadId: context.lead_id,
    interactionId,
    coordinatorOutput,
    sentAt,
  })

  console.log(`[Webhook] ✓ Interaction ${interactionId} complete for lead ${context.lead_id}`)
}

// ──────────────────────────────────────────────
// HTTP SERVER
// ──────────────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk.toString()))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

function validateWebhookSecret(req: IncomingMessage): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true // sem secret configurado — aceita tudo (dev)

  const headerSecret = req.headers['x-webhook-secret'] as string | undefined
  const querySecret = new URL(
    req.url ?? '',
    'http://localhost'
  ).searchParams.get('secret')

  return headerSecret === secret || querySecret === secret
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname

  // ── Health check ──
  if (path === '/health' || path === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'mx3-agents', timestamp: new Date().toISOString() }))
    return
  }

  // ── Webhook Zapi ──
  if (path === '/webhook/zapi' && req.method === 'POST') {
    // Valida secret
    if (!validateWebhookSecret(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    let body: string
    try {
      body = await readBody(req)
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to read body' }))
      return
    }

    let payload: ZapiWebhookPayload
    try {
      payload = JSON.parse(body) as ZapiWebhookPayload
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    // Ignora mensagens de grupos
    if (payload.isGroup) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ignored', reason: 'group_message' }))
      return
    }

    // Responde imediatamente (202 Accepted) e processa em background
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'accepted' }))

    // Processa de forma assíncrona
    processIncomingMessage(payload).catch((err) => {
      console.error('[Webhook] processIncomingMessage error:', err)
    })

    return
  }

  // ── 404 ──
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// ──────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10)

const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res)
  } catch (err) {
    console.error('[Server] Unhandled error:', err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  }
})

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     MX3 Aceleradora — Multi-Agent WhatsApp AI        ║
╠══════════════════════════════════════════════════════╣
║  Server:   http://localhost:${PORT}                     ║
║  Webhook:  POST /webhook/zapi                        ║
║  Health:   GET /health                               ║
╚══════════════════════════════════════════════════════╝
  `)
})

server.on('error', (err) => {
  console.error('[Server] Fatal error:', err)
  process.exit(1)
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export { server }
