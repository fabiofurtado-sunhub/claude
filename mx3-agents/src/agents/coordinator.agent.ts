import type {
  LeadContext,
  AgentContributions,
  CoordinatorOutput,
} from '../types/index.js'
import { AnthropicService } from '../services/anthropic.service.js'
import { MemoryAgent } from './memory.agent.js'

const COORDINATOR_SYSTEM_PROMPT = `Você é o Coordinator da MX3 Aceleradora Comercial.
Você recebe as análises de 4 agentes especialistas e sintetiza UMA resposta final
que integra todas as skills simultaneamente para o empresário certo, na hora certa.

REGRAS ABSOLUTAS DE SÍNTESE:
1. ABERTURA: Use o hook do Copywriter como primeira frase — ele foi criado para parar o lead
2. CORPO: Endereça a dor identificada pelo SDR de forma específica — sem generalidades
3. PRESSÃO: Calibra intensidade pelo urgency_level do BDR:
   - ALTA: Pressão real, urgência clara, CTA direto para agendar agora
   - MEDIA: Valor claro + urgência implícita + CTA para próximo passo
   - BAIXA: Mais conteúdo/valor, menos pressão, CTA leve
   - NAO_IDENTIFICADA: Pergunta qualificadora + valor inicial
4. TEMPERATURA: Respeita o estado emocional do Follow-up:
   - QUENTE: Aproveita o momentum, vai mais direto
   - MORNO: Aquece mais antes de pedir ação
   - FRIO/REATIVAÇÃO: Reabre com curiosidade genuína, não com pitch
5. FECHAMENTO: Use o CTA do Copywriter — ele foi pensado para esse momento específico
6. TAMANHO: Máximo 250 palavras — empresário não tem tempo para romance
7. FORMATAÇÃO: Parágrafos curtos (2-3 linhas max). Sem listas com bullet. Sem headers. Sem markdown.
8. TOM: Sempre direto e desafiador — nunca corporativo, nunca servil, nunca genérico

SE HOUVER OBJEÇÃO DETECTADA PELO BDR:
- Endereça a objeção de frente, não a ignore
- Use reframe: transforma a objeção em evidência do problema

VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO, sem texto adicional, sem markdown:
{
  "final_message": "mensagem completa para enviar ao lead via WhatsApp",
  "synthesis_reasoning": "como você integrou as 4 contribuições — qual foi a lógica da síntese",
  "primary_skill_used": "sdr|bdr|copywriter|followup",
  "confidence_score": <número inteiro de 0 a 100>
}`

export class CoordinatorAgent {
  constructor(private anthropic: AnthropicService) {}

  async synthesize(
    currentMessage: string,
    context: LeadContext,
    contributions: AgentContributions
  ): Promise<CoordinatorOutput> {
    const contextText = MemoryAgent.formatContextForAgent(context)

    const { sdr, bdr, copywriter, followup } = contributions

    const userMessage = `
=== MENSAGEM ORIGINAL DO LEAD ===
"${currentMessage}"

${contextText}

=== CONTRIBUIÇÃO DO AGENTE SDR ===
Dor identificada: ${sdr.pain_identified}
Estágio proposto: ${sdr.lead_stage}
Qualification Score: ${sdr.qualification_score}/100
Reasoning: ${sdr.reasoning}

=== CONTRIBUIÇÃO DO AGENTE BDR ===
Urgência: ${bdr.urgency_level}
Objeção detectada: ${bdr.objection_detected ?? 'Nenhuma'}
Meeting Readiness: ${bdr.meeting_readiness}/100
Reasoning: ${bdr.reasoning}

=== CONTRIBUIÇÃO DO AGENTE COPYWRITER ===
Tom: ${copywriter.tone}
Estilo de linguagem: ${copywriter.language_style}
Hook (primeira linha): "${copywriter.hook}"
CTA (call to action): "${copywriter.cta}"
Reasoning: ${copywriter.reasoning}

=== CONTRIBUIÇÃO DO AGENTE FOLLOW-UP ===
Contexto emocional: ${followup.emotional_context}
Temperatura do relacionamento: ${followup.relationship_temperature}
Reativação necessária: ${followup.reactivation_needed ? 'SIM' : 'NÃO'}
Dias desde último contato: ${followup.days_since_last_contact}
Reasoning: ${followup.reasoning}

Agora sintetize UMA resposta final que integra todas essas contribuições.
Lembre: máximo 250 palavras, parágrafos curtos, tom direto e desafiador.
Retorne o JSON de output do Coordinator.
`

    const output = await this.anthropic.chatJSON<CoordinatorOutput>({
      systemPrompt: COORDINATOR_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1024,
    })

    // Garante confidence_score no range 0-100
    output.confidence_score = Math.max(
      0,
      Math.min(100, Math.round(output.confidence_score))
    )

    return output
  }
}
