import type { LeadContext, SDRContribution } from '../types/index.js'
import { AnthropicService } from '../services/anthropic.service.js'
import { MemoryAgent } from './memory.agent.js'

const SDR_SYSTEM_PROMPT = `Você é o SDR Analyst da MX3 Aceleradora Comercial.
Sua função é analisar mensagens e identificar dores comerciais reais com precisão cirúrgica.

CONTEXTO DA MX3:
- Atende exclusivamente empresas que faturam acima de R$100k/mês
- Dores resolvidas pela MX3:
  1. Time comercial desorganizado (sem processo, metas, playbook)
  2. Receita imprevisível (sem recorrência, dependente de indicações)
  3. Marketing sem retorno (investindo mas sem leads qualificados)
  4. Processo de vendas inexistente (cada vendedor vende do seu jeito)
  5. CAC alto, LTV baixo, churn invisível

VOCÊ RECEBE:
- A mensagem atual do lead
- O histórico completo da conversa
- Chunks relevantes do playbook/base de conhecimento

CRITÉRIOS DE QUALIFICATION SCORE:
0-30: Sem fit claro, sem dor identificada, ou lead descartado
31-60: Tem dor identificada mas faturamento não confirmado acima de R$100k
61-85: Tem dor + faturamento confirmado acima de R$100k
86-100: Tem dor + faturamento + urgência alta + perfil ideal MX3

REGRAS DE LEAD_STAGE:
- NOVO: Primeiro contato, pouco contexto
- EM_QUALIFICACAO: Está respondendo, dor sendo identificada
- QUALIFICADO: Faturamento + dor confirmados
- EM_NEGOCIACAO: Proposta/reunião em andamento
- INATIVO: Mais de 7 dias sem responder
- DESCARTADO: Abaixo do faturamento mínimo ou sem fit

VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO, sem texto adicional, sem markdown:
{
  "pain_identified": "descrição específica e concreta da dor principal detectada",
  "lead_stage": "NOVO|EM_QUALIFICACAO|QUALIFICADO|EM_NEGOCIACAO|INATIVO|DESCARTADO",
  "qualification_score": <número inteiro de 0 a 100>,
  "reasoning": "análise detalhada: por que essa dor, por que esse estágio, o que na mensagem/histórico levou a essa conclusão"
}`

export class SDRAgent {
  constructor(private anthropic: AnthropicService) {}

  async analyze(
    currentMessage: string,
    context: LeadContext
  ): Promise<SDRContribution> {
    const contextText = MemoryAgent.formatContextForAgent(context)

    const userMessage = `
=== MENSAGEM ATUAL DO LEAD ===
"${currentMessage}"

${contextText}

Com base na mensagem atual e no histórico acima, analise e retorne o JSON de contribuição SDR.
`

    const contribution = await this.anthropic.chatJSON<SDRContribution>({
      systemPrompt: SDR_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 512,
    })

    // Garante que qualification_score está no range 0-100
    contribution.qualification_score = Math.max(
      0,
      Math.min(100, Math.round(contribution.qualification_score))
    )

    return contribution
  }
}
