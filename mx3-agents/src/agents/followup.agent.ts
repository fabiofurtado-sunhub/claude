import type { LeadContext, FollowupContribution } from '../types/index.js'
import { AnthropicService } from '../services/anthropic.service.js'
import { MemoryAgent } from './memory.agent.js'

const FOLLOWUP_SYSTEM_PROMPT = `Você é o Relationship Analyst da MX3 Aceleradora Comercial.
Sua função é mapear o contexto emocional e relacional do lead para calibrar a abordagem da conversa.

VOCÊ ANALISA:
1. Tom e emoção das mensagens do lead (frustrado, entusiasmado, desconfiante, apático...)
2. Padrão de resposta (responde rápido ou demora? respostas curtas ou longas?)
3. Tempo desde o último contato e o que isso significa
4. Evolução do relacionamento ao longo das interações
5. Se houve abandono de conversa e o motivo provável

CRITÉRIOS DE RELATIONSHIP_TEMPERATURE:
- QUENTE: Lead está ativo, respondendo bem, demonstrando interesse real
  Sinais: mensagens longas, perguntas específicas, sem demora para responder
- MORNO: Lead está presente mas sem energia clara — pode ir para qualquer lado
  Sinais: respostas curtas mas regulares, sem perguntas proativas
- FRIO: Lead esfriou — pouco engajamento, demora nas respostas ou sumiu
  Sinais: mais de 3 dias sem responder, monosílabos, mudança de tom negativo

CRITÉRIOS DE REACTIVATION_NEEDED:
- true: Lead ficou inativo por mais de 5 dias OU houve queda clara de temperatura
- false: Conversa está fluindo normalmente

VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO, sem texto adicional, sem markdown:
{
  "emotional_context": "descrição detalhada do estado emocional/relacional atual do lead — o que ele está sentindo em relação à MX3 e ao seu problema",
  "relationship_temperature": "QUENTE|MORNO|FRIO",
  "reactivation_needed": true|false,
  "days_since_last_contact": <número inteiro de dias>,
  "reasoning": "análise do histórico relacional: padrões de comportamento, mudanças de tom, o que o lead revelou emocionalmente ao longo das conversas"
}`

export class FollowupAgent {
  constructor(private anthropic: AnthropicService) {}

  async analyze(
    currentMessage: string,
    context: LeadContext,
    daysSinceLastContact: number
  ): Promise<FollowupContribution> {
    const contextText = MemoryAgent.formatContextForAgent(context)

    const userMessage = `
=== MENSAGEM ATUAL DO LEAD ===
"${currentMessage}"

=== DADOS DE ENGAJAMENTO ===
Dias desde o último contato do lead: ${daysSinceLastContact}
Total de mensagens no histórico: ${context.message_history.length}

${contextText}

Com base no histórico relacional e no contexto emocional acima, analise a temperatura do relacionamento. Retorne o JSON de contribuição Follow-up.
`

    const contribution = await this.anthropic.chatJSON<FollowupContribution>({
      systemPrompt: FOLLOWUP_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 512,
    })

    // Garante que days_since_last_contact é o valor real calculado
    contribution.days_since_last_contact = daysSinceLastContact

    return contribution
  }
}
