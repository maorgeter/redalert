'use client'
import { useEffect, useState } from 'react'
import { useSystemStore } from '@/store/systemStore'
import { AdapterStatus } from '@/types'
import { api } from '@/lib/api'
import {
  CheckCircle2,
  XCircle,
  Radio,
  Loader2,
  AlertTriangle,
  Shield,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_DISPLAY: Record<string, { name: string; description: string }> = {
  oref: { name: "פיקוד העורף", description: 'מערכת ההתרעה הלאומית — מקור ראשי' },
  mock: { name: 'סימולציה', description: 'נתוני פיתוח — אינו מקור חי' },
  simulation: { name: 'סימולציה', description: 'נתוני פיתוח — אינו מקור חי' },
  seed: { name: 'נתוני בדיקה', description: 'מסד נתונים ראשוני' },
}

const TYPE_LABEL: Record<string, string> = {
  polling: 'סקר',
  websocket: 'WebSocket',
  webhook: 'Webhook',
  manual: 'ידני',
}

type Mode = 'live' | 'stale' | 'connecting' | 'error' | 'simulation' | 'disabled'

function resolveMode(s: AdapterStatus, now: number): Mode {
  if (!s.enabled) return 'disabled'
  if (s.name === 'mock' || s.name === 'simulation') return 'simulation'
  if (!s.healthy) return s.lastSuccess ? 'error' : 'connecting'
  if (s.lastSuccess && s.updateIntervalMs) {
    const age = now - new Date(s.lastSuccess).getTime()
    if (age > s.updateIntervalMs * 3) return 'stale'
  }
  return 'live'
}

const MODE_CONFIG: Record<Mode, { label: string; color: string; bgColor: string; Icon: React.ComponentType<{ className?: string }> }> = {
  live: { label: 'מחובר', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', Icon: CheckCircle2 },
  stale: { label: 'מושהה', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', Icon: AlertTriangle },
  connecting: { label: 'מתחבר...', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', Icon: Loader2 },
  error: { label: 'שגיאה', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', Icon: XCircle },
  simulation: { label: 'סימולציה', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200', Icon: Radio },
  disabled: { label: 'מושבת', color: 'text-gray-400', bgColor: 'bg-gray-50 border-gray-100', Icon: ToggleLeft },
}

function ReliabilityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.8 ? 'bg-green-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400 tabular-nums w-7">{pct}%</span>
    </div>
  )
}

export default function SourcePanel() {
  const { adapterStatuses } = useSystemStore()
  const [now, setNow] = useState(() => Date.now())
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleToggle = async (s: AdapterStatus) => {
    if (toggling) return
    setToggling(s.name)
    try {
      await api.toggleSource(s.name, !s.enabled)
    } catch (err) {
      console.error('Failed to toggle source:', err)
    } finally {
      setToggling(null)
    }
  }

  if (adapterStatuses.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
          <Radio className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-700 text-xs font-semibold">ניהול מקורות</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-xs px-3 py-3">
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
        <span className="text-gray-700 text-xs font-semibold flex-1">ניהול מקורות</span>
        <span className="text-[10px] text-gray-400">{adapterStatuses.length} מקורות</span>
      </div>

      <div className="divide-y divide-gray-50">
        {adapterStatuses.map((s) => {
          const mode = resolveMode(s, now)
          const cfg = MODE_CONFIG[mode]
          const display = SOURCE_DISPLAY[s.name] ?? { name: s.name, description: '' }
          const ModeIcon = cfg.Icon
          const isToggling = toggling === s.name

          return (
            <div key={s.name} className="px-3 py-3 space-y-2">
              {/* Header row */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-gray-800">{display.name}</span>
                    {s.isPrimary && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
                        <Shield className="w-2.5 h-2.5" />
                        ראשי
                      </span>
                    )}
                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {TYPE_LABEL[s.type] ?? s.type}
                    </span>
                  </div>
                  {display.description && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{display.description}</div>
                  )}
                </div>
                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(s)}
                  disabled={!!isToggling || s.isPrimary}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    s.isPrimary ? 'cursor-not-allowed opacity-40' : 'hover:opacity-80',
                    s.enabled ? 'text-blue-500' : 'text-gray-300'
                  )}
                  title={s.isPrimary ? 'לא ניתן להשבית מקור ראשי' : s.enabled ? 'השבת' : 'הפעל'}
                >
                  {isToggling
                    ? <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                    : s.enabled
                    ? <ToggleRight className="w-5 h-5" />
                    : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>

              {/* Status badge */}
              <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-medium', cfg.bgColor)}>
                <ModeIcon className={cn('w-3 h-3', cfg.color, mode === 'connecting' && 'animate-spin')} />
                <span className={cfg.color}>{cfg.label}</span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">אירועים</span>
                  <span className="font-semibold text-gray-700">{s.eventCount.toLocaleString('he-IL')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">שגיאות</span>
                  <span className={cn('font-semibold', s.errorCount > 0 ? 'text-red-500' : 'text-gray-700')}>
                    {s.errorCount}
                  </span>
                </div>
              </div>

              {/* Reliability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-400">אמינות</span>
                </div>
                <ReliabilityBar score={s.reliabilityScore} />
              </div>

              {/* Error message */}
              {mode === 'error' && s.lastError && (
                <div className="text-[10px] text-red-500 truncate bg-red-50 px-2 py-1 rounded">
                  {s.lastError}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
