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
  'time_comercial_desorganizado',       // 0
  'processo_de_vendas_inexistente',     // 1
  'receita_imprevisivelou_irregular',   // 2
  'dependencia_de_indicacoes',          // 3
  'marketing_sem_retorno_mensuravel',   // 4
  'cac_elevado',                        // 5
  'churn_alto_ou_invisivel',            // 6
  'metas_comerciais_nao_batidas',       // 7
  'vendedores_sem_playbook_ou_script',  // 8
  'pipeline_sem_controle_ou_visibilidade', // 9
  'dependencia_de_vendedor_estrela',    // 10
  'ciclo_de_venda_muito_longo',         // 11
  'proposta_comercial_sem_padrao',      // 12
  'perda_frequente_para_concorrencia',  // 13
  'cliente_sumindo_sem_explicacao',     // 14
  'crescimento_travado_ou_estagnado',   // 15
  'dificuldade_de_escalar_vendas',      // 16
  'time_sem_treinamento_comercial',     // 17
  'gestao_comercial_por_feeling',       // 18
  'falta_de_previsibilidade_receita',   // 19

  // === URGÊNCIA E TIMING (15 dimensões) ===
  'urgencia_alta_e_explicita',          // 20
  'prazo_definido_ou_deadline',         // 21
  'problema_critico_acontecendo_agora', // 22
  'crescimento_estagnado_ha_meses',     // 23
  'socio_ou_board_cobrando_resultado',  // 24
  'meta_anual_em_risco',                // 25
  'competidor_crescendo_na_frente',     // 26
  'janela_de_oportunidade_de_mercado',  // 27
  'investimento_disponivel_e_aprovado', // 28
  'planejamento_do_proximo_ano_em_curso', // 29
  'sazonalidade_critica_se_aproximando', // 30
  'meta_trimestral_em_risco',           // 31
  'timing_neutro_sem_urgencia',         // 32
  'explorando_opcoes_sem_pressa',       // 33
  'curiosidade_sem_dor_imediata',       // 34

  // === PERFIL E QUALIFICAÇÃO DA EMPRESA (15 dimensões) ===
  'faturamento_acima_de_100k_mes',      // 35
  'faturamento_entre_50k_e_100k_mes',   // 36
  'faturamento_abaixo_de_50k_mes',      // 37
  'tem_time_de_vendas_ativo',           // 38
  'empresa_de_servicos_b2b',            // 39
  'empresa_de_produto_ou_saas',         // 40
  'empresa_b2c_ou_varejo',              // 41
  'fundador_ou_socio_fala_conosco',     // 42
  'gestor_ou_diretor_comercial',        // 43
  'empresa_em_fase_de_crescimento',     // 44
  'empresa_madura_buscando_otimizacao', // 45
  'startup_em_fase_inicial',            // 46
  'empresa_em_encolhimento',            // 47
  'indicado_por_cliente_mx3',           // 48
  'veio_de_anuncio_ou_conteudo',        // 49

  // === OBJEÇÕES (15 dimensões) ===
  'objecao_preco_muito_caro',           // 50
  'objecao_sem_tempo_agora',            // 51
  'objecao_ja_tentei_consultoria_antes', // 52
  'objecao_nao_e_o_momento_certo',      // 53
  'objecao_preciso_pensar_mais',        // 54
  'objecao_preciso_falar_com_socio',    // 55
  'objecao_ja_temos_processo_interno',  // 56
  'objecao_fazemos_isso_nos_mesmos',    // 57
  'objecao_resultados_incertos',        // 58
  'objecao_contrato_muito_longo',       // 59
  'resistencia_alta_sem_objecao_clara', // 60
  'objecao_levantada_mas_superavel',    // 61
  'sem_objecao_aparente',               // 62
  'ceticismo_sobre_consultoria',        // 63
  'desconfianca_em_relacao_ao_metodo',  // 64

  // === ESTADO RELACIONAL E EMOCIONAL (15 dimensões) ===
  'primeiro_contato_sem_historico',     // 65
  'relacionamento_quente_engajado',     // 66
  'relacionamento_morno_neutro',        // 67
  'relacionamento_frio_desengajado',    // 68
  'lead_reativado_apos_silencio',       // 69
  'confianca_estabelecida_no_historico', // 70
  'tom_positivo_e_receptivo',           // 71
  'tom_negativo_ou_frustrado',          // 72
  'tom_neutro_sem_emocao_clara',        // 73
  'lead_animado_e_entusiasmado',        // 74
  'lead_cansado_ou_esgotado',           // 75
  'lead_urgente_e_ansioso',             // 76
  'lead_curioso_e_exploratório',        // 77
  'respostas_curtas_desinteresse',      // 78
  'respostas_longas_alto_engajamento',  // 79

  // === PRONTIDÃO PARA REUNIÃO (10 dimensões) ===
  'pronto_para_reuniao_agora',          // 80
  'quase_pronto_precisa_de_empurrão',   // 81
  'precisa_mais_nutricao_antes',        // 82
  'resistente_a_reuniao',               // 83
  'pediu_reuniao_proativamente',        // 84
  'aceitou_sugestao_de_reuniao',        // 85
  'adiou_ou_cancelou_reuniao',          // 86
  'reuniao_ja_agendada',                // 87
  'nunca_mencionou_reuniao',            // 88
  'solicitou_mais_informacoes_antes',   // 89

  // === TÓPICOS MENCIONADOS NA MENSAGEM (20 dimensões) ===
  'fala_sobre_time_ou_vendedores',      // 90
  'fala_sobre_faturamento_ou_receita',  // 91
  'fala_sobre_crescimento_ou_escala',   // 92
  'fala_sobre_processo_ou_metodologia', // 93
  'fala_sobre_marketing_ou_leads',      // 94
  'fala_sobre_tecnologia_ou_crm',       // 95
  'fala_sobre_treinamento_ou_capacitacao', // 96
  'fala_sobre_metas_ou_resultados',     // 97
  'fala_sobre_mercado_ou_setor',        // 98
  'fala_sobre_produto_ou_servico',      // 99
  'fala_sobre_clientes_ou_churn',       // 100
  'fala_sobre_concorrencia',            // 101
  'fala_sobre_investimento_ou_budget',  // 102
  'fala_sobre_problemas_ou_dores',      // 103
  'fala_sobre_solucoes_ou_melhorias',   // 104
  'pergunta_sobre_mx3_ou_metodo',       // 105
  'compartilha_contexto_da_empresa',    // 106
  'responde_pergunta_anterior',         // 107
  'mensagem_de_apresentacao',           // 108
  'mensagem_curta_sem_contexto',        // 109

  // === CONTEÚDO DO PLAYBOOK MX3 (13 dimensões) ===
  'sobre_estruturacao_comercial',       // 110
  'sobre_diagnostico_mx3',              // 111
  'sobre_playbook_de_vendas',           // 112
  'sobre_gestao_de_pipeline',           // 113
  'sobre_treinamento_de_time',          // 114
  'sobre_metricas_comerciais',          // 115
  'sobre_prospecção_ativa',             // 116
  'sobre_proposta_e_negociacao',        // 117
  'sobre_pos_venda_e_retencao',         // 118
  'sobre_previsibilidade_receita',      // 119
  'sobre_caso_de_sucesso_mx3',          // 120
  'sobre_objecao_conhecida_mx3',        // 121
  'sobre_metodologia_de_aceleracao',    // 122

  // === SINAIS DE QUALIFICAÇÃO FINAL (5 dimensões) ===
  'altamente_qualificado_perfil_ideal', // 123
  'parcialmente_qualificado',           // 124
  'fora_do_perfil_ideal_mx3',           // 125
  'informacao_insuficiente',            // 126
  'lead_para_descartar',                // 127
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
  private client: Anthropic
  readonly model: string
  readonly embeddingModel: string

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required')
    }

    this.client = new Anthropic({ apiKey })
    this.model = 'claude-sonnet-4-6'
    this.embeddingModel = 'claude-3-haiku-20240307'
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
   * Gera embedding semântico usando Claude Haiku (claude-3-haiku-20240307).
   *
   * Estratégia: Claude pontua 128 dimensões semânticas fixas de domínio B2B/vendas.
   * O espaço vetorial é CONSISTENTE entre todas as chamadas, garantindo que
   * cosine similarity no pgvector produza resultados semanticamente relevantes.
   *
   * Dimensões cobertas: dores comerciais, urgência, perfil empresa, objeções,
   * estado emocional, prontidão para reunião, tópicos e conteúdo do playbook MX3.
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

    // Remove markdown se presente
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

    // Valida e limita cada valor ao intervalo [-1, 1]
    return raw.map((v, i) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      if (isNaN(n)) {
        throw new Error(`Invalid embedding value at index ${i}: ${v}`)
      }
      return Math.max(-1.0, Math.min(1.0, n))
    })
  }
}
