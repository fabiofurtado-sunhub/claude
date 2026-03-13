import Anthropic from '@anthropic-ai/sdk'

export class AnthropicService {
  private client: Anthropic
  readonly model: string

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }

    this.client = new Anthropic({ apiKey })
    this.model = 'claude-sonnet-4-6'
  }

  /**
   * Envia uma mensagem para o Claude e retorna o texto da resposta.
   * Usa streaming internamente para evitar timeouts em respostas longas.
   */
  async chat(params: {
    systemPrompt: string
    userMessage: string
    maxTokens?: number
  }): Promise<string> {
    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.systemPrompt,
      messages: [
        {
          role: 'user',
          content: params.userMessage,
        },
      ],
    })

    const finalMessage = await stream.finalMessage()

    const textBlock = finalMessage.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    return textBlock.text
  }

  /**
   * Envia uma mensagem e faz parse automático do JSON retornado.
   * Garante que o agente retornou JSON válido.
   */
  async chatJSON<T>(params: {
    systemPrompt: string
    userMessage: string
    maxTokens?: number
  }): Promise<T> {
    const raw = await this.chat(params)

    // Remove blocos de markdown caso o modelo os inclua
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    try {
      return JSON.parse(cleaned) as T
    } catch {
      throw new Error(
        `Failed to parse JSON from Claude response.\nRaw: ${raw.slice(0, 500)}`
      )
    }
  }

  /**
   * Gera embeddings via API da OpenAI (Supabase/pgvector espera 1536 dims).
   * Se preferir usar a API da Anthropic para embeddings, troque por outro provider.
   * Por padrão, usamos o endpoint de embeddings do Supabase ou texto simulado.
   *
   * NOTA: A Anthropic não oferece API de embeddings nativamente.
   * Esta implementação usa a API da OpenAI (text-embedding-3-small).
   * Para produção, configure OPENAI_API_KEY ou use outro provider.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      // Fallback: vetor zerado (RAG desabilitado sem OpenAI)
      console.warn(
        'OPENAI_API_KEY not set. RAG disabled — returning zero embedding. ' +
          'Configure OPENAI_API_KEY for production use.'
      )
      return new Array(1536).fill(0)
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 1536,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI embedding error: ${err}`)
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>
    }

    const embedding = data.data[0]?.embedding
    if (!embedding) {
      throw new Error('No embedding returned from OpenAI API')
    }
    return embedding
  }
}
