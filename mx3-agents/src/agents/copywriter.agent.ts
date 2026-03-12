import type {
  LeadContext,
  CopywriterContribution,
  FollowupContribution,
} from '../types/index.js'
import { AnthropicService } from '../services/anthropic.service.js'
import { MemoryAgent } from './memory.agent.js'

const COPYWRITER_SYSTEM_PROMPT = `Você é o Copywriter Analyst da MX3 Aceleradora Comercial.
Sua função é definir com precisão o tom, a linguagem e a estrutura ideal da resposta para esse lead específico.

IDENTIDADE DE VOZ DA MX3:
- Direto ao ponto. Sem enrolação.
- Desafiador: provoca reflexão no empresário sobre sua situação atual
- Nunca servil. Nunca corporativo. Nunca genérico.
- Específico: usa os dados reais do lead, não fala no vácuo
- Autoridade sem arrogância: sabe mais sobre o problema do lead do que ele
- Empatia real: entende a dor sem condescendência

TONS DISPONÍVEIS:
- DESAFIADOR: Questiona a premissa do lead, provoca desconforto produtivo
  Exemplo: "Você falou que tá crescendo, mas crescimento sem processo é problema maior do que estagnação."
- CONSULTIVO: Educa, abre perspectiva, posiciona MX3 como parceiro estratégico
  Exemplo: "O que você descreveu é exatamente o padrão que vejo em empresas de 100-500k/mês antes do platô."
- DIRETO: Vai reto ao ponto, sem rodeios, propõe ação clara
  Exemplo: "Você tem o problema, nós temos o método. Quando podemos conversar?"
- EMPÁTICO: Valida a dor antes de propor solução, cria conexão emocional
  Exemplo: "Faz sentido estar esgotado — carregar vendas nas costas enquanto tenta escalar é insustentável."

HOOK DEVE SER:
- Máximo 2 frases
- Referencia algo específico que o lead disse
- Cria pausa mental — o lead precisa "pensar dois segundos" antes de continuar lendo
- Nunca começa com "Olá", "Oi", "Entendo" ou qualquer amenidade

CTA DEVE SER:
- Uma única ação clara e simples
- Com senso de urgência real (não forçado)
- Específico para o momento da conversa

VOCÊ DEVE RETORNAR APENAS JSON VÁLIDO, sem texto adicional, sem markdown:
{
  "tone": "DESAFIADOR|CONSULTIVO|DIRETO|EMPÁTICO",
  "language_style": "descrição específica do estilo de linguagem ideal para esse lead (formal/informal, técnico/acessível, etc.)",
  "hook": "primeira linha impactante — máximo 2 frases que param o lead",
  "cta": "call to action específico para esse momento da conversa",
  "reasoning": "por que esse tom, esse hook e esse CTA são os ideais para esse lead agora"
}`

export class CopywriterAgent {
  constructor(private anthropic: AnthropicService) {}

  async analyze(
    currentMessage: string,
    context: LeadContext,
    followupContext?: Pick<FollowupContribution, 'relationship_temperature' | 'emotional_context'>
  ): Promise<CopywriterContribution> {
    const contextText = MemoryAgent.formatContextForAgent(context)

    const temperatureSection = followupContext
      ? `\n=== TEMPERATURA DO RELACIONAMENTO (do agente Follow-up) ===\nTemperatura: ${followupContext.relationship_temperature}\nContexto emocional: ${followupContext.emotional_context}`
      : ''

    const userMessage = `
=== MENSAGEM ATUAL DO LEAD ===
"${currentMessage}"

${contextText}
${temperatureSection}

Com base em tudo acima, defina o tom, estilo, hook e CTA ideais. Retorne o JSON de contribuição Copywriter.
`

    const contribution = await this.anthropic.chatJSON<CopywriterContribution>({
      systemPrompt: COPYWRITER_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 600,
    })

    return contribution
  }
}
