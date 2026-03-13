export interface ZapiSendTextParams {
  phone: string
  message: string
}

export interface ZapiResponse {
  zaapId: string
  messageId: string
  id: string
}

export class ZapiService {
  private baseUrl: string
  private instanceId: string
  private token: string
  private securityToken: string | undefined

  constructor() {
    const baseUrl = process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io'
    const instanceId = process.env.ZAPI_INSTANCE_ID
    const token = process.env.ZAPI_TOKEN

    if (!instanceId || !token) {
      throw new Error('ZAPI_INSTANCE_ID and ZAPI_TOKEN are required')
    }

    this.baseUrl = baseUrl
    this.instanceId = instanceId
    this.token = token
    this.securityToken = process.env.ZAPI_SECURITY_TOKEN
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Client-Token': this.token,
    }
    // Security token is required on some Zapi plans
    if (this.securityToken) {
      headers['client-token'] = this.securityToken
    }
    return headers
  }

  private get apiBase(): string {
    return `${this.baseUrl}/instances/${this.instanceId}/token/${this.token}`
  }

  /**
   * Envia uma mensagem de texto via WhatsApp
   */
  async sendText(params: ZapiSendTextParams): Promise<ZapiResponse> {
    const url = `${this.apiBase}/send-text`

    // Zapi espera o telefone sem o + inicial mas com código do país
    const normalizedPhone = this.normalizePhone(params.phone)

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        phone: normalizedPhone,
        message: params.message,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Zapi sendText failed [${response.status}]: ${errorText}`
      )
    }

    const data = (await response.json()) as ZapiResponse
    return data
  }

  /**
   * Envia mensagem tipando indicador (opcional — melhora UX)
   */
  async sendTyping(phone: string, durationMs = 2000): Promise<void> {
    const url = `${this.apiBase}/send-typing`
    const normalizedPhone = this.normalizePhone(phone)

    try {
      await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: normalizedPhone,
          duration: durationMs,
        }),
      })
    } catch {
      // Typing indicator é best-effort, não falha o fluxo
    }
  }

  /**
   * Verifica o status da instância Zapi
   */
  async getStatus(): Promise<{ connected: boolean; session: string }> {
    const url = `${this.apiBase}/status`

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    })

    if (!response.ok) {
      return { connected: false, session: 'disconnected' }
    }

    const data = (await response.json()) as {
      connected: boolean
      session: string
    }
    return data
  }

  /**
   * Normaliza o número de telefone para o formato esperado pela Zapi.
   * Remove espaços, traços e parênteses; garante DDI.
   */
  private normalizePhone(phone: string): string {
    // Remove tudo que não é dígito
    let digits = phone.replace(/\D/g, '')

    // Se começar com 55 e tiver 12-13 dígitos, está OK (BR)
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return digits
    }

    // Se tiver 10-11 dígitos, assume BR e adiciona 55
    if (digits.length === 10 || digits.length === 11) {
      digits = `55${digits}`
    }

    return digits
  }

  /**
   * Extrai o número de telefone de um payload Zapi webhook.
   * Zapi pode enviar o phone com ou sem @c.us ou @s.whatsapp.net
   */
  static extractPhone(rawPhone: string): string {
    return rawPhone
      .replace('@c.us', '')
      .replace('@s.whatsapp.net', '')
      .replace(/\D/g, '')
  }
}
