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
  private get instanceId(): string {
    const id = process.env.ZAPI_INSTANCE_ID
    if (!id) throw new Error('ZAPI_INSTANCE_ID is required. Make sure .env is loaded before using ZapiService.')
    return id
  }

  private get token(): string {
    const token = process.env.ZAPI_TOKEN
    if (!token) throw new Error('ZAPI_TOKEN is required. Make sure .env is loaded before using ZapiService.')
    return token
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Client-Token': this.token,
    }
    // Security token is required on some Zapi plans
    const securityToken = process.env.ZAPI_SECURITY_TOKEN
    if (securityToken) {
      headers['client-token'] = securityToken
    }
    return headers
  }

  private get apiBase(): string {
    const baseUrl = process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io'
    return `${baseUrl}/instances/${this.instanceId}/token/${this.token}`
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
