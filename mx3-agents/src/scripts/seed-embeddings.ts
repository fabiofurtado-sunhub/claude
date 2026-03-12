/**
 * Script de seed: indexa o playbook MX3 no banco vetorial.
 * Execute: npm run seed
 *
 * Pré-requisito: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY no .env
 */

import 'dotenv/config'
import { AnthropicService } from '../services/anthropic.service.js'
import { SupabaseService } from '../services/supabase.service.js'
import { EmbeddingsManager, MX3_PLAYBOOK_SEED } from '../utils/embeddings.js'

async function main(): Promise<void> {
  console.log('🚀 MX3 Agents — Seed de Embeddings')
  console.log('─'.repeat(50))

  const anthropic = new AnthropicService()
  const supabase = new SupabaseService()
  const manager = new EmbeddingsManager(anthropic, supabase)

  console.log(`Indexando ${MX3_PLAYBOOK_SEED.length} documentos...`)

  const result = await manager.indexBatch(MX3_PLAYBOOK_SEED)

  console.log('─'.repeat(50))
  console.log(`✅ Sucesso: ${result.success} documentos`)
  console.log(`❌ Erros:   ${result.errors} documentos`)
  console.log('─'.repeat(50))

  if (result.success > 0) {
    console.log('Testando busca vetorial...')
    const chunks = await manager.search('time de vendas desorganizado', {
      threshold: 0.6,
      limit: 3,
    })
    console.log(`Encontrados ${chunks.length} chunks relevantes:`)
    chunks.forEach((c, i) => console.log(`  ${i + 1}. ${c.slice(0, 100)}...`))
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
