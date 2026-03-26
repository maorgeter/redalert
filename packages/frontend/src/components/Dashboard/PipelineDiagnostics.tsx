'use client'
import { useState, useEffect } from 'react'
import { useAlertStore } from '@/store/alertStore'
import { useSystemStore } from '@/store/systemStore'
import type { GeofenceFC } from '@/types'
import { AlertType } from '@/types'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertCircle, GitBranch } from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasGeofenceMatch(
  areaName: string,
  geofenceId: string | undefined,
  geofences: GeofenceFC | null
): boolean {
  if (!geofences) return false
  const lower = areaName.toLowerCase()
  const prefix = lower.split(/\s*[-–]\s+/)[0].trim()
  return geofences.features.some((f) => {
    if (geofenceId && f.properties?.id === geofenceId) return true
    if ((f.properties as Record<string, unknown>)?.nameHe === areaName) return true
    if (f.properties?.name?.toLowerCase() === lower) return true
    // Prefix match
    if (prefix && prefix.length >= 3) {
      const nameHe = (f.properties as Record<string, string>)?.nameHe ?? ''
      const nameHePrefix = nameHe.split(/\s*[-–]\s+/)[0].trim()
      if (prefix === nameHePrefix) return true
    }
    return false
  })
}

function hebrewRelativeTime(isoString: string | null): string {
  if (!isoString) return '—'
  const diffMs = Date.now() - new Date(isoString).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 5) return 'עכשיו'
  if (secs < 60) return `לפני ${secs} שניות`
  const mins = Math.floor(secs / 60)
  return `לפני ${mins} דקות`
}

// ─── Stage row ─────────────────────────────────────────────────────────────────

function StageRow({
  label,
  value,
  sub,
  ok,
}: {
  label: string
  value: string | number
  sub?: string
  ok: boolean | null
}) {
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 border-b border-slate-50 last:border-0">
      {ok === null ? (
        <AlertCircle className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
      ) : ok ? (
        <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] text-slate-500 leading-tight">{label}</span>
          <span
            className={cn(
              'text-[11px] font-bold tabular-nums flex-shrink-0',
              ok === null ? 'text-slate-600' : ok ? 'text-emerald-700' : 'text-red-600'
            )}
          >
            {value}
          </span>
        </div>
        {sub && <div className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Type count row ────────────────────────────────────────────────────────────

function TypeCountRow({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between px-3 py-1">
      <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', color)}>
        {label}
      </span>
      <span className="text-[11px] font-bold tabular-nums text-slate-700">{count}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PipelineDiagnostics() {
  const {
    events,
    activeEvents,
    geofences,
    wsConnected,
    lastEventReceivedAt,
    lastInitAt,
    activeRedAlerts,
    activeWarnings,
    activeCleareds,
  } = useAlertStore()
  const { adapterStatuses, health } = useSystemStore()
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 2000)
    return () => clearInterval(id)
  }, [])

  const totalEvents = events.length
  const activeCount = activeEvents.length
  const geofenceCount = geofences?.features.length ?? 0

  const mappedCount = activeEvents.filter((e) =>
    hasGeofenceMatch(e.areaName, e.geofenceId, geofences)
  ).length

  const unmappedEvents = activeEvents.filter(
    (e) => !hasGeofenceMatch(e.areaName, e.geofenceId, geofences)
  )

  const orefAdapter = adapterStatuses.find((a) => a.name === 'oref')
  const lastBackendPush = health?.adapterStatuses?.[0]?.lastSuccess ?? null

  return (
    <div className="flex flex-col text-xs" dir="rtl">

      {/* ── Header ── */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <GitBranch className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-700 text-xs font-semibold flex-1">אבחון צינור נתונים</span>
        <span className={cn(
          'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
          wsConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        )}>
          {wsConnected ? 'מחובר' : 'מנותק'}
        </span>
      </div>

      {/* ── Pipeline stages ── */}
      <StageRow
        label="A. מקור OREF"
        value={orefAdapter ? (orefAdapter.healthy ? 'תקין' : 'שגיאה') : 'לא פעיל'}
        sub={orefAdapter?.lastError ?? undefined}
        ok={orefAdapter ? orefAdapter.healthy : false}
      />
      <StageRow
        label="B. חיבור WebSocket"
        value={wsConnected ? 'פעיל' : 'מנותק'}
        ok={wsConnected}
      />
      <StageRow
        label="C. גאופנסים טעונים"
        value={geofenceCount}
        sub={geofenceCount === 0 ? 'לא נטענו — אין פוליגונים למיפוי' : undefined}
        ok={geofenceCount > 0}
      />
      <StageRow
        label="D. אירועים שהתקבלו"
        value={totalEvents}
        ok={totalEvents > 0 ? true : null}
      />
      <StageRow
        label="E. התרעות פעילות"
        value={activeCount}
        ok={activeCount > 0 ? true : null}
      />
      <StageRow
        label="F. מוצג על מפה"
        value={`${mappedCount} / ${activeCount}`}
        sub={
          activeCount > 0 && mappedCount === 0
            ? 'שגיאת מיפוי שמות'
            : undefined
        }
        ok={activeCount === 0 ? null : mappedCount === activeCount}
      />

      {/* ── Time tracking ── */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-100 space-y-1">
        <div className="diag-row">
          <span className="diag-label">עדכון אחרון מהשרת</span>
          <span className="diag-value">{hebrewRelativeTime(lastBackendPush)}</span>
        </div>
        <div className="diag-row">
          <span className="diag-label">אירוע אחרון שהתקבל</span>
          <span className="diag-value">{hebrewRelativeTime(lastEventReceivedAt)}</span>
        </div>
        <div className="diag-row">
          <span className="diag-label">אתחול WebSocket</span>
          <span className="diag-value">{hebrewRelativeTime(lastInitAt)}</span>
        </div>
        {orefAdapter?.updateIntervalMs && (
          <div className="diag-row">
            <span className="diag-label">מרווח סקר</span>
            <span className="diag-value">{orefAdapter.updateIntervalMs / 1000}ש׳</span>
          </div>
        )}
      </div>

      {/* ── Active by type ── */}
      {activeCount > 0 && (
        <div className="border-t border-slate-100 pt-1.5 pb-1">
          <div className="px-3 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            פירוט לפי סוג
          </div>
          <TypeCountRow
            label="צבע אדום"
            count={activeRedAlerts}
            color="bg-red-100 text-red-700"
          />
          <TypeCountRow
            label="התרעה"
            count={activeWarnings}
            color="bg-orange-100 text-orange-700"
          />
          <TypeCountRow
            label="יציאה מהמקלט"
            count={activeCleareds}
            color="bg-green-100 text-green-700"
          />
        </div>
      )}

      {/* ── Unmatched area names ── */}
      {unmappedEvents.length > 0 && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100">
          <div className="text-[9px] font-bold text-red-600 uppercase tracking-wide mb-1">
            אזורים ללא מיפוי גאופנס ({unmappedEvents.length})
          </div>
          <div className="space-y-0.5">
            {unmappedEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="text-[10px] text-red-700 font-mono truncate">
                {e.areaName}
              </div>
            ))}
            {unmappedEvents.length > 8 && (
              <div className="text-[9px] text-red-400">
                ועוד {unmappedEvents.length - 8}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── All good ── */}
      {activeCount > 0 && mappedCount === activeCount && (
        <div className="px-3 py-2 bg-emerald-50 border-t border-emerald-100 text-[10px] text-emerald-700">
          ✓ כל ההתרעות מוצגות על המפה
        </div>
      )}
    </div>
  )
}
