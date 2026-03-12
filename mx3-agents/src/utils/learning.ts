import { SupabaseService } from '../services/supabase.service.js'
import type { CoordinatorOutput } from '../types/index.js'

/**
 * Learning Loop — Sistema de aprendizado contínuo baseado em resposta do lead.
 *
 * Lógica de peso:
 * - Lead respondeu em < 30min  → todos os agentes ganham +0.1
 * - Lead respondeu entre 30min e 2h → ganham +0.05
 * - Lead não respondeu em 24h  → perdem -0.05
 * - Lead agendou reunião       → primary_skill_used ganha +0.3 adicional
 *
 * Os pesos são usados pelo Memory Agent para priorizar contribuições no próximo ciclo.
 */
export class LearningLoop {
  private static readonly WEIGHT_MIN = 0.1
  private static readonly WEIGHT_MAX = 3.0

  constructor(private supabase: SupabaseService) {}

  /**
   * Inicia o monitoramento assíncrono após o envio da resposta.
   * Verifica se o lead respondeu em até 24h e atualiza os pesos.
   */
  async startMonitoring(params: {
    leadId: string
    interactionId: string
    coordinatorOutput: CoordinatorOutput
    sentAt: Date
  }): Promise<void> {
    // Executa de forma assíncrona sem bloquear o webhook
    this.monitorAsync(params).catch((err) => {
      console.error(
        `Learning Loop error for interaction ${params.interactionId}:`,
        err
      )
    })
  }

  private async monitorAsync(params: {
    leadId: string
    interactionId: string
    coordinatorOutput: CoordinatorOutput
    sentAt: Date
  }): Promise<void> {
    const checkIntervals = [
      30 * 60 * 1000,     // 30 minutos
      2 * 60 * 60 * 1000, // 2 horas
      24 * 60 * 60 * 1000, // 24 horas
    ]

    let leadReplied = false
    let replyTimeMinutes: number | undefined

    for (const intervalMs of checkIntervals) {
      await sleep(intervalMs)

      // Verifica se houve nova mensagem do lead após o envio
      const result = await this.checkLeadReply(
        params.leadId,
        params.sentAt,
        intervalMs
      )

      if (result.replied) {
        leadReplied = true
        replyTimeMinutes = result.minutesElapsed
        break
      }
    }

    // Atualiza performance de todos os agentes dessa interação
    await this.updateAgentWeights({
      interactionId: params.interactionId,
      leadId: params.leadId,
      leadReplied,
      replyTimeMinutes,
      coordinatorOutput: params.coordinatorOutput,
    })
  }

  private async checkLeadReply(
    leadId: string,
    sentAt: Date,
    maxElapsedMs: number
  ): Promise<{ replied: boolean; minutesElapsed: number }> {
    try {
      // Busca mensagens do lead após o envio da resposta do agente
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { auth: { persistSession: false } }
      )

      const { data } = await client
        .from('messages')
        .select('created_at')
        .eq('lead_id', leadId)
        .eq('role', 'lead')
        .gt('created_at', sentAt.toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!data) {
        return { replied: false, minutesElapsed: Math.floor(maxElapsedMs / 60000) }
      }

      const replyTime = new Date((data as { created_at: string }).created_at)
      const minutesElapsed = Math.floor(
        (replyTime.getTime() - sentAt.getTime()) / 60000
      )

      return { replied: true, minutesElapsed }
    } catch {
      return { replied: false, minutesElapsed: Math.floor(maxElapsedMs / 60000) }
    }
  }

  private async updateAgentWeights(params: {
    interactionId: string
    leadId: string
    leadReplied: boolean
    replyTimeMinutes?: number
    coordinatorOutput: CoordinatorOutput
  }): Promise<void> {
    const performanceRecords = await this.supabase.getPerformanceByInteraction(
      params.interactionId
    )

    if (performanceRecords.length === 0) return

    // Calcula o delta de peso baseado no comportamento do lead
    const baseDelta = this.calculateBaseDelta(
      params.leadReplied,
      params.replyTimeMinutes
    )

    for (const record of performanceRecords) {
      let delta = baseDelta

      // Bônus para o agente primário se o lead agendou reunião
      const conversionOutcome = await this.detectConversionOutcome(
        params.leadId,
        params.interactionId
      )

      if (
        record.was_primary &&
        conversionOutcome === 'REUNIAO_AGENDADA'
      ) {
        delta += 0.3
      }

      // Aplica o delta e limita ao range [MIN, MAX]
      const newWeight = clamp(
        record.weight_score + delta,
        LearningLoop.WEIGHT_MIN,
        LearningLoop.WEIGHT_MAX
      )

      await this.supabase.updateAgentPerformance(record.id, {
        lead_replied: params.leadReplied,
        reply_time_minutes: params.replyTimeMinutes,
        conversion_outcome: conversionOutcome,
        weight_score: newWeight,
      })
    }

    console.log(
      `[Learning Loop] Interaction ${params.interactionId}: ` +
        `replied=${params.leadReplied}, ` +
        `replyTime=${params.replyTimeMinutes ?? 'N/A'}min, ` +
        `baseDelta=${baseDelta >= 0 ? '+' : ''}${baseDelta}`
    )
  }

  /**
   * Calcula o delta base do peso com base no tempo de resposta do lead.
   */
  private calculateBaseDelta(
    leadReplied: boolean,
    replyTimeMinutes?: number
  ): number {
    if (!leadReplied) return -0.05

    if (replyTimeMinutes === undefined || replyTimeMinutes < 30) return +0.1

    if (replyTimeMinutes < 120) return +0.05

    return 0 // Respondeu após 2h — neutro
  }

  /**
   * Verifica se houve reunião agendada ou outro outcome de conversão
   * após a interação.
   */
  private async detectConversionOutcome(
    leadId: string,
    _interactionId: string
  ): Promise<string | undefined> {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        { auth: { persistSession: false } }
      )

      // Verifica se o lead tem reunião agendada ou estágio atualizado
      const { data } = await client
        .from('leads')
        .select('stage, meeting_scheduled_at')
        .eq('id', leadId)
        .single()

      if (!data) return undefined

      const lead = data as { stage: string; meeting_scheduled_at: string | null }

      if (lead.meeting_scheduled_at) return 'REUNIAO_AGENDADA'
      if (lead.stage === 'EM_NEGOCIACAO') return 'QUALIFICADO'
      if (lead.stage === 'DESCARTADO') return 'PERDIDO'

      return undefined
    } catch {
      return undefined
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
