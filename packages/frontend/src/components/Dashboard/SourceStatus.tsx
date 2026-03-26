'use client'
import { useEffect, useState } from 'react'
import { useSystemStore } from '@/store/systemStore'
import { CheckCircle2, XCircle, Radio, Loader2, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { he } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// Human-readable source names in Hebrew
const SOURCE_DISPLAY: Record<string, { name: string; description: string }> = {
  oref: { name: "פיקוד העורף", description: 'מערכת ההתרעה הלאומית' },
  mock: { name: 'סימולציה', description: 'נתוני פיתוח — לא מקור חי' },
  simulation: { name: 'סימולציה', description: 'נתוני פיתוח — לא מקור חי' },
  seed: { name: 'נתוני בדיקה', description: 'מסד נתונים ראשוני' },
}

type AdapterMode = 'live' | 'stale' | 'connecting' | 'error' | 'simulation'

function resolveMode(
  healthy: boolean,
  lastSuccess: string | null,
  name: string,
  updateIntervalMs?: number,
  now = Date.now()
): AdapterMode {
  if (name === 'mock' || name === 'simulation') return 'simulation'
  if (!healthy) {
    if (!lastSuccess) return 'connecting'
    return 'error'
  }
  // Check for stale: healthy flag is true but last success is older than 3× the interval
  if (lastSuccess && updateIntervalMs) {
    const age = now - new Date(lastSuccess).getTime()
    if (age > updateIntervalMs * 3) return 'stale'
  }
  return 'live'
}

const MODE_CONFIG: Record<AdapterMode, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  live: { label: 'מחובר', color: 'text-green-600', icon: CheckCircle2 },
  stale: { label: 'מושהה', color: 'text-yellow-600', icon: AlertTriangle },
  connecting: { label: 'מתחבר...', color: 'text-blue-500', icon: Loader2 },
  error: { label: 'שגיאה', color: 'text-red-600', icon: XCircle },
  simulation: { label: 'סימולציה', color: 'text-yellow-600', icon: Radio },
}

function formatAge(isoString: string, now: number): string {
  const ms = now - new Date(isoString).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 5) return 'עכשיו'
  if (secs < 60) return `לפני ${secs} שניות`
  return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: he })
}

export default function SourceStatus() {
  const { adapterStatuses } = useSystemStore()
  // Tick every second so elapsed-time labels stay accurate
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (adapterStatuses.length === 0) {
    return (
      <div className="px-3 py-3">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 -mx-3 mb-2 bg-gray-50">
          <Radio className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-700 text-xs font-semibold">מקורות מידע</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>מחכה לנתונים...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
        <Radio className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-700 text-xs font-semibold">מקורות מידע</span>
      </div>

      <div className="divide-y divide-gray-50">
        {adapterStatuses.map((s) => {
          const mode = resolveMode(s.healthy, s.lastSuccess, s.name, s.updateIntervalMs, now)
          const cfg = MODE_CONFIG[mode]
          const display = SOURCE_DISPLAY[s.name] ?? { name: s.name, description: '' }
          const ModeIcon = cfg.icon

          return (
            <div key={s.name} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <ModeIcon
                  className={cn(
                    'w-3.5 h-3.5 flex-shrink-0',
                    cfg.color,
                    mode === 'connecting' && 'animate-spin'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{display.name}</div>
                  {display.description && (
                    <div className="text-[10px] text-gray-400">{display.description}</div>
                  )}
                </div>
                <span className={cn('text-[10px] font-semibold flex-shrink-0', cfg.color)}>
                  {cfg.label}
                </span>
              </div>

              <div className="mr-5 mt-1 flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-gray-400">
                  {s.eventCount.toLocaleString('he-IL')} אירועים
                </span>
                {s.lastSuccess && (
                  <span className={cn(
                    'text-[10px]',
                    mode === 'stale' ? 'text-yellow-600 font-medium' : 'text-gray-400'
                  )}>
                    {formatAge(s.lastSuccess, now)}
                  </span>
                )}
                {mode === 'live' && !s.lastSuccess && (
                  <span className="text-[10px] text-blue-500">מצלם...</span>
                )}
                {s.updateIntervalMs && (
                  <span className="text-[10px] text-gray-300">
                    כל {s.updateIntervalMs / 1000}ש׳
                  </span>
                )}
              </div>

              {mode === 'error' && s.lastError && (
                <div className="mr-5 mt-0.5 text-[10px] text-red-500 truncate">
                  {s.lastError}
                </div>
              )}

              {mode === 'simulation' && (
                <div className="mr-5 mt-0.5 text-[10px] text-yellow-600/80">
                  מצב פיתוח — לא מציג בסביבת ייצור
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
