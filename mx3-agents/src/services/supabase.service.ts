import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  LeadRecord,
  LeadContext,
  LeadStage,
  Message,
  AgentWeights,
  SDRContribution,
  BDRContribution,
  CopywriterContribution,
  FollowupContribution,
  CoordinatorOutput,
  InteractionRecord,
} from '../types/index.js'

export class SupabaseService {
  private client: SupabaseClient

  constructor() {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required')
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    })
  }

  // ──────────────────────────────────────────────
  // LEADS
  // ──────────────────────────────────────────────

  async findOrCreateLead(phone: string): Promise<LeadRecord> {
    const { data: existing, error: findError } = await this.client
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .single()

    if (existing && !findError) {
      return existing as LeadRecord
    }

    const { data: created, error: createError } = await this.client
      .from('leads')
      .insert({ phone, stage: 'NOVO' })
      .select('*')
      .single()

    if (createError || !created) {
      throw new Error(`Failed to create lead: ${createError?.message}`)
    }

    return created as LeadRecord
  }

  async updateLead(
    leadId: string,
    updates: Partial<Omit<LeadRecord, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<void> {
    const { error } = await this.client
      .from('leads')
      .update(updates)
      .eq('id', leadId)

    if (error) {
      throw new Error(`Failed to update lead: ${error.message}`)
    }
  }

  // ──────────────────────────────────────────────
  // MENSAGENS
  // ──────────────────────────────────────────────

  async getMessageHistory(leadId: string, limit = 20): Promise<Message[]> {
    const { data, error } = await this.client
      .from('messages')
      .select('role, content, created_at, agent_used')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get messages: ${error.message}`)
    }

    return ((data ?? []) as Array<{
      role: string
      content: string
      created_at: string
      agent_used: string | null
    }>)
      .reverse()
      .map((m) => ({
        role: m.role as 'lead' | 'agent',
        content: m.content,
        timestamp: m.created_at,
        agent_used: m.agent_used,
      }))
  }

  async saveMessage(
    leadId: string,
    role: 'lead' | 'agent',
    content: string,
    agentUsed: string | null = null
  ): Promise<void> {
    const { error } = await this.client.from('messages').insert({
      lead_id: leadId,
      role,
      content,
      agent_used: agentUsed,
    })

    if (error) {
      throw new Error(`Failed to save message: ${error.message}`)
    }
  }

  // ──────────────────────────────────────────────
  // EMBEDDINGS / RAG
  // ──────────────────────────────────────────────

  async searchSimilarChunks(
    embedding: number[],
    matchThreshold = 0.7,
    matchCount = 5
  ): Promise<string[]> {
    const { data, error } = await this.client.rpc('match_embeddings', {
      query_embedding: embedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    })

    if (error) {
      console.error('Vector search error:', error.message)
      return []
    }

    return ((data ?? []) as Array<{ content: string }>).map((row) => row.content)
  }

  async saveEmbedding(
    content: string,
    embedding: number[],
    sourceType: 'playbook' | 'conversa' | 'case' | 'objecao',
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const { error } = await this.client.from('embeddings').insert({
      content,
      embedding,
      source_type: sourceType,
      metadata,
    })

    if (error) {
      throw new Error(`Failed to save embedding: ${error.message}`)
    }
  }

  // ──────────────────────────────────────────────
  // AGENT WEIGHTS
  // ──────────────────────────────────────────────

  async getAgentWeights(leadId: string): Promise<AgentWeights> {
    const { data, error } = await this.client.rpc('get_agent_weights', {
      p_lead_id: leadId,
    })

    if (error || !data) {
      return { sdr: 1.0, bdr: 1.0, copywriter: 1.0, followup: 1.0 }
    }

    const weights = data as { sdr: number; bdr: number; copywriter: number; followup: number }
    return {
      sdr: weights.sdr ?? 1.0,
      bdr: weights.bdr ?? 1.0,
      copywriter: weights.copywriter ?? 1.0,
      followup: weights.followup ?? 1.0,
    }
  }

  // ──────────────────────────────────────────────
  // INTERAÇÕES
  // ──────────────────────────────────────────────

  async saveInteraction(params: {
    leadId: string
    incomingMessage: string
    sdrContribution: SDRContribution
    bdrContribution: BDRContribution
    copywriterContribution: CopywriterContribution
    followupContribution: FollowupContribution
    coordinatorOutput: CoordinatorOutput
    finalMessage: string
    leadContext: LeadContext
  }): Promise<string> {
    const { data, error } = await this.client
      .from('interactions')
      .insert({
        lead_id: params.leadId,
        incoming_message: params.incomingMessage,
        sdr_contribution: params.sdrContribution,
        bdr_contribution: params.bdrContribution,
        copywriter_contribution: params.copywriterContribution,
        followup_contribution: params.followupContribution,
        coordinator_output: params.coordinatorOutput,
        final_message_sent: params.finalMessage,
        lead_context_snapshot: params.leadContext,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to save interaction: ${error?.message}`)
    }

    return (data as { id: string }).id
  }

  async getInteractionById(interactionId: string): Promise<InteractionRecord | null> {
    const { data, error } = await this.client
      .from('interactions')
      .select('*')
      .eq('id', interactionId)
      .single()

    if (error) return null
    return data as InteractionRecord
  }

  // ──────────────────────────────────────────────
  // AGENT PERFORMANCE
  // ──────────────────────────────────────────────

  async saveAgentPerformance(params: {
    leadId: string
    interactionId: string
    agentName: 'sdr' | 'bdr' | 'copywriter' | 'followup'
    contribution: SDRContribution | BDRContribution | CopywriterContribution | FollowupContribution
    wasPrimary: boolean
  }): Promise<string> {
    const { data, error } = await this.client
      .from('agent_performance')
      .insert({
        lead_id: params.leadId,
        interaction_id: params.interactionId,
        agent_name: params.agentName,
        contribution: params.contribution,
        was_primary: params.wasPrimary,
        weight_score: 1.0,
      })
      .select('id')
      .single()

    if (error || !data) {
      throw new Error(`Failed to save agent performance: ${error?.message}`)
    }

    return (data as { id: string }).id
  }

  async updateAgentPerformance(
    performanceId: string,
    updates: {
      lead_replied?: boolean
      reply_time_minutes?: number
      conversion_outcome?: string
      weight_score?: number
    }
  ): Promise<void> {
    const { error } = await this.client
      .from('agent_performance')
      .update(updates)
      .eq('id', performanceId)

    if (error) {
      throw new Error(`Failed to update agent performance: ${error.message}`)
    }
  }

  async getPerformanceByInteraction(
    interactionId: string
  ): Promise<Array<{ id: string; agent_name: string; was_primary: boolean; weight_score: number }>> {
    const { data, error } = await this.client
      .from('agent_performance')
      .select('id, agent_name, was_primary, weight_score')
      .eq('interaction_id', interactionId)

    if (error) return []
    return data as Array<{ id: string; agent_name: string; was_primary: boolean; weight_score: number }>
  }

  // ──────────────────────────────────────────────
  // ÚLTIMO CONTATO
  // ──────────────────────────────────────────────

  async getDaysSinceLastContact(leadId: string): Promise<number> {
    const { data, error } = await this.client
      .from('messages')
      .select('created_at')
      .eq('lead_id', leadId)
      .eq('role', 'lead')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return 0

    const lastContact = new Date((data as { created_at: string }).created_at)
    const now = new Date()
    const diffMs = now.getTime() - lastContact.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }

  // ──────────────────────────────────────────────
  // CONTEXT BUILDER
  // ──────────────────────────────────────────────

  async buildLeadContext(lead: LeadRecord, relevantChunks: string[]): Promise<LeadContext> {
    const [messageHistory, agentWeights] = await Promise.all([
      this.getMessageHistory(lead.id),
      this.getAgentWeights(lead.id),
    ])

    return {
      lead_id: lead.id,
      phone: lead.phone,
      name: lead.name,
      company: lead.company,
      revenue: lead.monthly_revenue,
      stage: lead.stage as LeadStage,
      main_pain: lead.main_pain,
      message_history: messageHistory,
      relevant_chunks: relevantChunks,
      agent_weights: agentWeights,
    }
  }
}
