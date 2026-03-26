import { NormalizedEvent } from '../normalization/schema'

interface DedupEntry {
  canonicalId: string
  sources: Set<string>
  expiresAt: number
}

export type DedupResult =
  | { action: 'new' }
  | { action: 'drop' }
  | { action: 'merge'; canonicalId: string }

/**
 * In-memory deduplication window with cross-source provenance tracking.
 *
 * Keys on areaName+category (without source) so alerts from multiple sources
 * about the same area are merged rather than duplicated. When the same source
 * re-reports within the window the event is dropped entirely.
 */
export class DeduplicationCache {
  private cache = new Map<string, DedupEntry>()
  private windowMs: number

  constructor(windowMs = 30_000) {
    this.windowMs = windowMs
    setInterval(() => this.cleanup(), 60_000).unref()
  }

  check(event: NormalizedEvent): DedupResult {
    const areaKey = `${event.areaName}:${event.category}`
    const now = Date.now()
    const entry = this.cache.get(areaKey)

    if (!entry || entry.expiresAt <= now) {
      // New alert — record it
      this.cache.set(areaKey, {
        canonicalId: event.id,
        sources: new Set([event.source]),
        expiresAt: now + this.windowMs,
      })
      return { action: 'new' }
    }

    // Same alert within window
    if (entry.sources.has(event.source)) {
      // Same source re-reporting — drop
      return { action: 'drop' }
    }

    // Different source reporting same alert — merge provenance
    entry.sources.add(event.source)
    return { action: 'merge', canonicalId: entry.canonicalId }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) this.cache.delete(key)
    }
  }

  get size(): number {
    return this.cache.size
  }
}
