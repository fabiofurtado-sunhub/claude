import type { LeadContext } from '../types/index.js'
import { SupabaseService } from '../services/supabase.service.js'
import { AnthropicService } from '../services/anthropic.service.js'

export class MemoryAgent {
  constructor(
    private supabase: SupabaseService,
    private anthropic: AnthropicService
  ) {}

  /**
   * Busca ou cria o lead, recupera histórico, faz busca vetorial RAG
   * e constrói o LeadContext completo que alimenta todos os agentes.
   */
  async buildContext(phone: string, currentMessage: string): Promise<LeadContext> {
    // 1. Garante que o lead existe no banco
    const lead = await this.supabase.findOrCreateLead(phone)

    // 2. Salva a mensagem recebida
    await this.supabase.saveMessage(lead.id, 'lead', currentMessage)

    // 3. Gera embedding da mensagem para busca vetorial
    let relevantChunks: string[] = []
    try {
      const embedding = await this.anthropic.generateEmbedding(currentMessage)
      relevantChunks = await this.supabase.searchSimilarChunks(embedding, 0.65, 5)
    } catch (err) {
      console.error('Memory Agent — RAG search failed:', err)
      // Continua sem chunks — não interrompe o fluxo
    }

    // 4. Constrói o LeadContext com histórico e pesos dos agentes
    const context = await this.supabase.buildLeadContext(lead, relevantChunks)

    return context
  }

  /**
   * Formata o contexto como texto estruturado para injetar nos prompts dos agentes.
   */
  static formatContextForAgent(context: LeadContext): string {
    const historyLines = context.message_history
      .slice(-10) // últimas 10 mensagens
      .map(
        (m) =>
          `[${m.timestamp.slice(0, 10)} ${m.role.toUpperCase()}${m.agent_used ? ` via ${m.agent_used}` : ''}]: ${m.content}`
      )
      .join('\n')

    const chunksSection =
      context.relevant_chunks.length > 0
        ? `\n\nCONTEÚDO RELEVANTE DO PLAYBOOK/BASE:\n${context.relevant_chunks.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
        : ''

    const weights = context.agent_weights
    const sortedAgents = Object.entries(weights).sort(([, a], [, b]) => b - a)
    const topAgent = sortedAgents[0] ?? ['sdr', 1.0]

    return `
=== CONTEXTO DO LEAD ===
ID: ${context.lead_id}
Telefone: ${context.phone}
Nome: ${context.name ?? 'Não informado'}
Empresa: ${context.company ?? 'Não informada'}
Faturamento mensal: ${context.revenue ?? 'Não informado'}
Estágio atual: ${context.stage}
Dor principal registrada: ${context.main_pain ?? 'Não identificada'}

=== PESOS DOS AGENTES (histórico de performance com esse lead) ===
SDR: ${weights.sdr.toFixed(2)} | BDR: ${weights.bdr.toFixed(2)} | Copywriter: ${weights.copywriter.toFixed(2)} | Follow-up: ${weights.followup.toFixed(2)}
Agente mais eficaz: ${topAgent[0].toUpperCase()} (score ${(topAgent[1] as number).toFixed(2)})

=== HISTÓRICO DA CONVERSA (últimas mensagens) ===
${historyLines || 'Primeiro contato — sem histórico'}
${chunksSection}
`.trim()
  }
}
