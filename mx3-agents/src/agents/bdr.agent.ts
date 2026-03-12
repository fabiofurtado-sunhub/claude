import type { LeadContext, BDRContribution, SDRContribution } from '../types/index.js'
import { AnthropicService } from '../services/anthropic.service.js'
import { MemoryAgent } from './memory.agent.js'

const BDR_SYSTEM_PROMPT = `Você é o BDR Analyst da MX3 Aceleradora Comercial.
Sua função é avaliar urgência, detectar objeções e medir a prontidão para reunião de diagnóstico.

CONTEXTO DA MX3:
- Reunião de diagnóstico: 30min com especialista MX3
- Objeções comuns:
  1. "Já tentei consultoria antes e não funcionou"
  2. "Não tenho tempo agora"
  3. "Está muito caro sem nem saber o que vocês oferecem"
  4. "Preciso pensar / falar com meu sócio"
  5. "Estou satisfeito com o resultado atual" (negação da dor)

VOCÊ RECEBE:
- A mensagem atual do lead
- O histórico completo da conversa
- O qualification_score do agente SDR
- O contexto completo do lead

CRITÉRIOS DE MEETING READINESS:
0-30: Lead não está pronto — precisa mais qualificação ou está resistente
31-60: Interesse presente mas sem urgência clara — manter nutrição
61-85: Urgência presente, objeção contornável — push para reunião
86-100: Pronto para agendar agora — fechar data imediatamente

CRITÉRIOS DE URGENCY_LEVEL:
- ALTA: Mencionou prazo, problema urgente, crescimento parado, sócio cobrando
- MEDIA: Tem problema mas sem prazo claro
- BAIXA: Explorando opções, sem dor imediata
- NAO_IDENTIFICADA: Mensagem muito superficial ou primeiro contato

VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO, sem texto adicional, sem markdown:
{
  "urgency_level": "ALTA|MEDIA|BAIXA|NAO_IDENTIFICADA",
  "objection_detected": "descrição detalhada da objeção ou null se não há objeção",
  "meeting_readiness": <número inteiro de 0 a 100>,
  "reasoning": "análise detalhada: sinais de urgência detectados, objeções identificadas, o que indica o nível de prontidão"
}`

export class BDRAgent {
  constructor(private anthropic: AnthropicService) {}

  async analyze(
    currentMessage: string,
    context: LeadContext,
    sdrContribution: SDRContribution
  ): Promise<BDRContribution> {
    const contextText = MemoryAgent.formatContextForAgent(context)

    const userMessage = `
=== MENSAGEM ATUAL DO LEAD ===
"${currentMessage}"

${contextText}

=== ANÁLISE DO AGENTE SDR (use como contexto) ===
Dor identificada: ${sdrContribution.pain_identified}
Estágio proposto: ${sdrContribution.lead_stage}
Qualification Score: ${sdrContribution.qualification_score}/100
Reasoning SDR: ${sdrContribution.reasoning}

Com base em tudo acima, analise urgência, objeções e prontidão para reunião. Retorne o JSON de contribuição BDR.
`

    const contribution = await this.anthropic.chatJSON<BDRContribution>({
      systemPrompt: BDR_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 512,
    })

    // Garante range 0-100
    contribution.meeting_readiness = Math.max(
      0,
      Math.min(100, Math.round(contribution.meeting_readiness))
    )

    return contribution
  }
}
