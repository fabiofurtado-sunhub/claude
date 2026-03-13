import Anthropic from '@anthropic-ai/sdk'

// ──────────────────────────────────────────────────────────────────────────────
// ESPAÇO SEMÂNTICO DE 128 DIMENSÕES — Domínio B2B / Vendas MX3
//
// Claude Haiku pontua cada dimensão de -1.0 a 1.0 com base no texto.
// O espaço vetorial é FIXO e CONSISTENTE entre todas as chamadas,
// garantindo que cosine similarity funcione corretamente no pgvector.
// ──────────────────────────────────────────────────────────────────────────────
const SEMANTIC_DIMENSIONS = [
  // === DOR COMERCIAL (20 dimensões) ===
  'time_comercial_desorganizado',
  'processo_de_vendas_inexistente',
  'receita_imprevisivelou_irregular',
  'dependencia_de_indicacoes',
  'marketing_sem_retorno_mensuravel',
  'cac_elevado',
  'churn_alto_ou_invisivel',
  'metas_comerciais_nao_batidas',
  'vendedores_sem_playbook_ou_script',
  'pipeline_sem_controle_ou_visibilidade',
  'dependencia_de_vendedor_estrela',
  'ciclo_de_venda_muito_longo',
  'proposta_comercial_sem_padrao',
  'perda_frequente_para_concorrencia',
  'cliente_sumindo_sem_explicacao',
  'crescimento_travado_ou_estagnado',
  'dificuldade_de_escalar_vendas',
  'time_sem_treinamento_comercial',
  'gestao_comercial_por_feeling',
  'falta_de_previsibilidade_receita',

  // === URGÊNCIA E TIMING (15 dimensões) ===
  'urgencia_alta_e_explicita',
  'prazo_definido_ou_deadline',
  'problema_critico_acontecendo_agora',
  'crescimento_estagnado_ha_meses',
  'socio_ou_board_cobrando_resultado',
  'meta_anual_em_risco',
  'competidor_crescendo_na_frente',
  'janela_de_oportunidade_de_mercado',
  'investimento_disponivel_e_aprovado',
  'planejamento_do_proximo_ano_em_curso',
  'sazonalidade_critica_se_aproximando',
  'meta_trimestral_em_risco',
  'timing_neutro_sem_urgencia',
  'explorando_opcoes_sem_pressa',
  'curiosidade_sem_dor_imediata',

  // === PERFIL E QUALIFICAÇÃO DA EMPRESA (15 dimensões) ===
  'faturamento_acima_de_100k_mes',
  'faturamento_entre_50k_e_100k_mes',
  'faturamento_abaixo_de_50k_mes',
  'tem_time_de_vendas_ativo',
  'empresa_de_servicos_b2b',
  'empresa_de_produto_ou_saas',
  'empresa_b2c_ou_varejo',
  'fundador_ou_socio_fala_conosco',
  'gestor_ou_diretor_comercial',
  'empresa_em_fase_de_crescimento',
  'empresa_madura_buscando_otimizacao',
  'startup_em_fase_inicial',
  'empresa_em_encolhimento',
  'indicado_por_cliente_mx3',
  'veio_de_anuncio_ou_conteudo',

  // === OBJEÇÕES (15 dimensões) ===
  'objecao_preco_muito_caro',
  'objecao_sem_tempo_agora',
  'objecao_ja_tentei_consultoria_antes',
  'objecao_nao_e_o_momento_certo',
  'objecao_preciso_pensar_mais',
  'objecao_preciso_falar_com_socio',
  'objecao_ja_temos_processo_interno',
  'objecao_fazemos_isso_nos_mesmos',
  'objecao_resultados_incertos',
  'objecao_contrato_muito_longo',
  'resistencia_alta_sem_objecao_clara',
  'objecao_levantada_mas_superavel',
  'sem_objecao_aparente',
  'ceticismo_sobre_consultoria',
  'desconfianca_em_relacao_ao_metodo',

  // === ESTADO RELACIONAL E EMOCIONAL (15 dimensões) ===
  'primeiro_contato_sem_historico',
  'relacionamento_quente_engajado',
  'relacionamento_morno_neutro',
  'relacionamento_frio_desengajado',
  'lead_reativado_apos_silencio',
  'confianca_estabelecida_no_historico',
  'tom_positivo_e_receptivo',
  'tom_negativo_ou_frustrado',
  'tom_neutro_sem_emocao_clara',
  'lead_animado_e_entusiasmado',
  'lead_cansado_ou_esgotado',
  'lead_urgente_e_ansioso',
  'lead_curioso_e_exploratório',
  'respostas_curtas_desinteresse',
  'respostas_longas_alto_engajamento',

  // === PRONTIDÃO PARA REUNIÃO (10 dimensões) ===
  'pronto_para_reuniao_agora',
  'quase_pronto_precisa_de_empurrão',
  'precisa_mais_nutricao_antes',
  'resistente_a_reuniao',
  'pediu_reuniao_proativamente',
  'aceitou_sugestao_de_reuniao',
  'adiou_ou_cancelou_reuniao',
  'reuniao_ja_agendada',
  'nunca_mencionou_reuniao',
  'solicitou_mais_informacoes_antes',

  // === TÓPICOS MENCIONADOS NA MENSAGEM (20 dimensões) ===
  'fala_sobre_time_ou_vendedores',
  'fala_sobre_faturamento_ou_receita',
  'fala_sobre_crescimento_ou_escala',
  'fala_sobre_processo_ou_metodologia',
  'fala_sobre_marketing_ou_leads',
  'fala_sobre_tecnologia_ou_crm',
  'fala_sobre_treinamento_ou_capacitacao',
  'fala_sobre_metas_ou_resultados',
  'fala_sobre_mercado_ou_setor',
  'fala_sobre_produto_ou_servico',
  'fala_sobre_clientes_ou_churn',
  'fala_sobre_concorrencia',
  'fala_sobre_investimento_ou_budget',
  'fala_sobre_problemas_ou_dores',
  'fala_sobre_solucoes_ou_melhorias',
  'pergunta_sobre_mx3_ou_metodo',
  'compartilha_contexto_da_empresa',
  'responde_pergunta_anterior',
  'mensagem_de_apresentacao',
  'mensagem_curta_sem_contexto',

  // === CONTEÚDO DO PLAYBOOK MX3 (13 dimensões) ===
  'sobre_estruturacao_comercial',
  'sobre_diagnostico_mx3',
  'sobre_playbook_de_vendas',
  'sobre_gestao_de_pipeline',
  'sobre_treinamento_de_time',
  'sobre_metricas_comerciais',
  'sobre_prospecção_ativa',
  'sobre_proposta_e_negociacao',
  'sobre_pos_venda_e_retencao',
  'sobre_previsibilidade_receita',
  'sobre_caso_de_sucesso_mx3',
  'sobre_objecao_conhecida_mx3',
  'sobre_metodologia_de_aceleracao',

  // === SINAIS DE QUALIFICAÇÃO FINAL (5 dimensões) ===
  'altamente_qualificado_perfil_ideal',
  'parcialmente_qualificado',
  'fora_do_perfil_ideal_mx3',
  'informacao_insuficiente',
  'lead_para_descartar',
] as const

export const EMBEDDING_DIM = SEMANTIC_DIMENSIONS.length // 128

// System prompt fixo — NUNCA alterar sem reindexar todos os embeddings
const EMBEDDING_SYSTEM_PROMPT = `Você é um encoder semântico especializado em análise de vendas B2B.

Sua tarefa: dado um texto, pontue cada uma das ${EMBEDDING_DIM} dimensões semânticas abaixo em uma escala de -1.0 a 1.0:
  -1.0 = completamente ausente ou muito negativo para essa dimensão
   0.0 = neutro ou irrelevante
  +1.0 = fortemente presente ou muito positivo para essa dimensão

DIMENSÕES (em ordem exata, não altere):
${SEMANTIC_DIMENSIONS.map((d, i) => `${i}. ${d}`).join('\n')}

REGRAS:
- Retorne APENAS um array JSON com exatamente ${EMBEDDING_DIM} números float
- Nenhum texto, explicação ou markdown
- Formato: [0.8, -0.3, 0.0, 1.0, ...]
- Cada valor DEVE estar entre -1.0 e 1.0`

export class AnthropicService {
  // Lazy-initialized — created only on first use, after dotenv has loaded
  private _client: Anthropic | null = null
  readonly model = 'claude-sonnet-4-6'
  readonly embeddingModel = 'claude-3-haiku-20240307'

  private get client(): Anthropic {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is required. ' +
          'Make sure .env is present and dotenv/config is imported before using this service.'
        )
      }
      this._client = new Anthropic({ apiKey })
    }
    return this._client
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
      messages: [{ role: 'user', content: params.userMessage }],
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
   */
  async chatJSON<T>(params: {
    systemPrompt: string
    userMessage: string
    maxTokens?: number
  }): Promise<T> {
    const raw = await this.chat(params)

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
   * Gera embedding semântico usando Claude Haiku (claude-3-haiku-20240307).
   *
   * Estratégia: Claude pontua 128 dimensões semânticas fixas de domínio B2B/vendas.
   * O espaço vetorial é CONSISTENTE entre todas as chamadas, garantindo que
   * cosine similarity no pgvector produza resultados semanticamente relevantes.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.client.messages.create({
      model: this.embeddingModel,
      max_tokens: 512,
      system: EMBEDDING_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Texto para codificar semanticamente:\n\n"${text.slice(0, 2000)}"`,
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude Haiku returned no text for embedding')
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    let raw: unknown
    try {
      raw = JSON.parse(cleaned)
    } catch {
      throw new Error(
        `Claude Haiku embedding parse error. Raw: "${textBlock.text.slice(0, 200)}"`
      )
    }

    if (!Array.isArray(raw)) {
      throw new Error(`Claude Haiku embedding must be an array, got: ${typeof raw}`)
    }

    if (raw.length !== EMBEDDING_DIM) {
      throw new Error(
        `Claude Haiku embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${raw.length}`
      )
    }

    return raw.map((v, i) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      if (isNaN(n)) {
        throw new Error(`Invalid embedding value at index ${i}: ${v}`)
      }
      return Math.max(-1.0, Math.min(1.0, n))
    })
  }
}
