import { ServerMessage } from '@/types'

type MessageHandler = (msg: ServerMessage) => void
type StatusHandler = (connected: boolean) => void

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'
const PING_INTERVAL = 25_000
const RECONNECT_DELAY_BASE = 1_500
const RECONNECT_MAX_DELAY = 30_000

export class AlertWebSocket {
  private ws: WebSocket | null = null
  private messageHandlers: MessageHandler[] = []
  private statusHandlers: StatusHandler[] = []
  private reconnectAttempt = 0
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    const endpoint = `${WS_URL}/ws`
    console.log(`[WebSocket] connecting to ${endpoint}`)
    this.ws = new WebSocket(endpoint)

    this.ws.onopen = () => {
      this.reconnectAttempt = 0
      this.notifyStatus(true)
      this.startPing()
    }

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage
        this.messageHandlers.forEach((h) => h(msg))
      } catch {
        // Ignore malformed messages
      }
    }

    this.ws.onclose = () => {
      this.notifyStatus(false)
      this.stopPing()
      if (!this.destroyed) this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
    }
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler)
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler)
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_INTERVAL)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_DELAY_BASE * Math.pow(1.5, this.reconnectAttempt),
      RECONNECT_MAX_DELAY
    )
    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private notifyStatus(connected: boolean): void {
    this.statusHandlers.forEach((h) => h(connected))
  }
}

// Singleton instance
let instance: AlertWebSocket | null = null

export function getWebSocket(): AlertWebSocket {
  if (!instance) instance = new AlertWebSocket()
  return instance
}
