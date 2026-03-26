import { logger } from '../logger'

interface BackoffOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs?: number
  label?: string
}

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  opts: BackoffOptions
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs = 30000, label = 'op' } = opts
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt > maxRetries) throw err

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)
      const jitter = Math.random() * delay * 0.2
      const wait = Math.floor(delay + jitter)

      logger.warn({ attempt, wait, label }, 'Retrying after error')
      await sleep(wait)
    }
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))
