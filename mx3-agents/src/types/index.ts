export interface Message {
  role: 'lead' | 'agent'
  content: string
  timestamp: string
  agent_used: string | null
}

export interface AgentWeights {
  sdr: number
  bdr: number
  copywriter: number
  followup: number
}

export type LeadStage =
  | 'NOVO'
  | 'EM_QUALIFICACAO'
  | 'QUALIFICADO'
  | 'EM_NEGOCIACAO'
  | 'INATIVO'
  | 'DESCARTADO'

export interface LeadContext {
  lead_id: string
  phone: string
  name: string | null
  company: string | null
  revenue: string | null
  stage: LeadStage
  main_pain: string | null
  message_history: Message[]
  relevant_chunks: string[]
  agent_weights: AgentWeights
}

export interface SDRContribution {
  pain_identified: string
  lead_stage: string
  qualification_score: number // 0-100
  reasoning: string
}

export interface BDRContribution {
  urgency_level: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_IDENTIFICADA'
  objection_detected: string | null
  meeting_readiness: number // 0-100
  reasoning: string
}

export interface CopywriterContribution {
  tone: 'DESAFIADOR' | 'CONSULTIVO' | 'DIRETO' | 'EMPÁTICO'
  language_style: string
  hook: string
  cta: string
  reasoning: string
}

export interface FollowupContribution {
  emotional_context: string
  relationship_temperature: 'QUENTE' | 'MORNO' | 'FRIO'
  reactivation_needed: boolean
  days_since_last_contact: number
  reasoning: string
}

export interface AgentContributions {
  sdr: SDRContribution
  bdr: BDRContribution
  copywriter: CopywriterContribution
  followup: FollowupContribution
}

export interface CoordinatorOutput {
  final_message: string
  synthesis_reasoning: string
  primary_skill_used: 'sdr' | 'bdr' | 'copywriter' | 'followup'
  confidence_score: number
}

export interface ZapiWebhookPayload {
  phone: string
  message: string
  messageId?: string
  momment?: number
  status?: string
  chatName?: string
  senderName?: string
  senderPhoto?: string
  isGroup?: boolean
  instanceId?: string
}

export interface LeadRecord {
  id: string
  phone: string
  name: string | null
  company: string | null
  monthly_revenue: string | null
  stage: LeadStage
  main_pain: string | null
  urgency_level: string | null
  meeting_scheduled_at: string | null
  created_at: string
  updated_at: string
}

export interface InteractionRecord {
  id: string
  lead_id: string
  incoming_message: string
  sdr_contribution: SDRContribution | null
  bdr_contribution: BDRContribution | null
  copywriter_contribution: CopywriterContribution | null
  followup_contribution: FollowupContribution | null
  coordinator_output: CoordinatorOutput | null
  final_message_sent: string | null
  lead_context_snapshot: LeadContext | null
  created_at: string
}

export interface AgentPerformanceRecord {
  id: string
  lead_id: string
  interaction_id: string
  agent_name: string
  contribution: SDRContribution | BDRContribution | CopywriterContribution | FollowupContribution
  was_primary: boolean
  lead_replied: boolean | null
  reply_time_minutes: number | null
  conversion_outcome: string | null
  weight_score: number
  created_at: string
}

export interface EmbeddingRecord {
  id: string
  content: string
  embedding: number[]
  source_type: 'playbook' | 'conversa' | 'case' | 'objecao'
  metadata: Record<string, unknown>
  created_at: string
}
