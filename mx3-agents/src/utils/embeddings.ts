import { AnthropicService } from '../services/anthropic.service.js'
import { SupabaseService } from '../services/supabase.service.js'

/**
 * Utilitário para indexar conteúdo no banco vetorial (pgvector).
 * Embeddings gerados pelo Claude Haiku (claude-3-haiku-20240307)
 * via pontuação de 128 dimensões semânticas fixas de domínio B2B/vendas.
 * Não há dependência de OpenAI ou qualquer outro provider externo.
 *
 * Use para alimentar a base de conhecimento da MX3 com:
 * - Playbooks de vendas
 * - Casos de sucesso
 * - Objeções mapeadas
 * - Transcrições de conversas de alta performance
 */
export class EmbeddingsManager {
  constructor(
    private anthropic: AnthropicService,
    private supabase: SupabaseService
  ) {}

  /**
   * Indexa um único documento no banco vetorial
   */
  async indexDocument(params: {
    content: string
    sourceType: 'playbook' | 'conversa' | 'case' | 'objecao'
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const embedding = await this.anthropic.generateEmbedding(params.content)
    await this.supabase.saveEmbedding(
      params.content,
      embedding,
      params.sourceType,
      params.metadata ?? {}
    )
  }

  /**
   * Indexa múltiplos documentos em lote
   */
  async indexBatch(
    items: Array<{
      content: string
      sourceType: 'playbook' | 'conversa' | 'case' | 'objecao'
      metadata?: Record<string, unknown>
    }>
  ): Promise<{ success: number; errors: number }> {
    let success = 0
    let errors = 0

    for (const item of items) {
      try {
        await this.indexDocument(item)
        success++
        // Rate limit protection
        await sleep(100)
      } catch (err) {
        console.error(`Failed to index: "${item.content.slice(0, 50)}..."`, err)
        errors++
      }
    }

    return { success, errors }
  }

  /**
   * Busca chunks relevantes por similaridade semântica
   */
  async search(
    query: string,
    options: { threshold?: number; limit?: number } = {}
  ): Promise<string[]> {
    const embedding = await this.anthropic.generateEmbedding(query)
    return this.supabase.searchSimilarChunks(
      embedding,
      options.threshold ?? 0.7,
      options.limit ?? 5
    )
  }
}

/**
 * Conteúdo padrão do playbook MX3 para seed inicial.
 * Execute `npx ts-node seed-embeddings.ts` para indexar.
 */
export const MX3_PLAYBOOK_SEED = [
  {
    content:
      'A MX3 Aceleradora Comercial atende exclusivamente empresas com faturamento mensal acima de R$100.000. Empresas abaixo desse patamar não têm o perfil ideal para os programas da MX3.',
    sourceType: 'playbook' as const,
    metadata: { category: 'qualificacao', priority: 'high' },
  },
  {
    content:
      'Principal entrega da MX3: estruturação do processo comercial completo — desde a prospecção até o fechamento. Time treinado, meta definida, playbook criado, pipeline organizado.',
    sourceType: 'playbook' as const,
    metadata: { category: 'entrega', priority: 'high' },
  },
  {
    content:
      'Dor #1 atendida pela MX3: time comercial desorganizado. Cada vendedor vende do seu jeito, sem processo, sem script, sem funil. Resultado: receita imprevisível e dependente de pessoas-chave.',
    sourceType: 'playbook' as const,
    metadata: { category: 'dores', pain: 'time-desorganizado' },
  },
  {
    content:
      'Dor #2 atendida pela MX3: receita imprevisível. Empresa cresce por indicação mas não sabe como replicar. Não tem máquina de vendas ativa. Depende de sorte, não de processo.',
    sourceType: 'playbook' as const,
    metadata: { category: 'dores', pain: 'receita-imprevisivel' },
  },
  {
    content:
      'Dor #3: marketing investindo sem retorno mensurável. Empresa gasta em ads, influencer, eventos mas não consegue atribuir ROI. Não há conexão entre marketing e vendas.',
    sourceType: 'playbook' as const,
    metadata: { category: 'dores', pain: 'marketing-sem-retorno' },
  },
  {
    content:
      'Objeção comum: "Já tentei consultoria antes e não funcionou." Reframe: a maioria das consultorias entrega diagnóstico e vai embora. A MX3 fica dentro da operação e implementa. A diferença está na execução, não no plano.',
    sourceType: 'objecao' as const,
    metadata: { category: 'objecoes', objection: 'consultoria-nao-funcionou' },
  },
  {
    content:
      'Objeção comum: "Não tenho tempo agora." Reframe: empresas que não têm tempo para estruturar vendas são exatamente as que mais precisam disso. A falta de tempo é um sintoma do problema, não uma razão para adiar a solução.',
    sourceType: 'objecao' as const,
    metadata: { category: 'objecoes', objection: 'sem-tempo' },
  },
  {
    content:
      'Objeção comum: "Está muito caro." Reframe: qual o custo de continuar com vendas travadas por mais 6 meses? Um vendedor mediano custa R$5-8k/mês sem o método certo. A MX3 paga seu investimento no primeiro mês de execução.',
    sourceType: 'objecao' as const,
    metadata: { category: 'objecoes', objection: 'caro' },
  },
  {
    content:
      'Case de sucesso: empresa de serviços B2B, faturamento de R$180k/mês, time de 3 vendedores sem processo. Em 90 dias com a MX3: funil estruturado, taxa de conversão subiu de 8% para 23%, faturamento chegou a R$280k/mês.',
    sourceType: 'case' as const,
    metadata: { category: 'cases', sector: 'servicos-b2b', result: '+55%' },
  },
  {
    content:
      'Reunião de diagnóstico MX3: 30 minutos com especialista. Objetivo: entender o momento atual da empresa, mapear os gargalos comerciais e apresentar o caminho de estruturação. Sem pitch de venda — foco total no diagnóstico.',
    sourceType: 'playbook' as const,
    metadata: { category: 'reuniao', type: 'diagnostico' },
  },
]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
