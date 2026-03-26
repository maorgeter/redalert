'use client'
import { useState } from 'react'
import { useAlertStore } from '@/store/alertStore'
import { useSystemStore } from '@/store/systemStore'
import {
  AlertStatus,
  AlertType,
  ALERT_TYPE_HE,
  CATEGORY_HE,
  SOURCE_HE,
} from '@/types'
import { BellOff, Wifi, WifiOff, Siren, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Alert type visual config ─────────────────────────────────────────────────

const TYPE_CONFIG = {
  [AlertType.RED_ALERT]: {
    label: ALERT_TYPE_HE[AlertType.RED_ALERT],
    borderClass: 'event-type-red-alert',
    dotClass: 'bg-red-500 animate-pulse',
    textClass: 'text-red-700',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    bgClass: 'bg-red-50/40',
    Icon: Siren,
    iconClass: 'text-red-500',
  },
  [AlertType.WARNING]: {
    label: ALERT_TYPE_HE[AlertType.WARNING],
    borderClass: 'event-type-warning',
    dotClass: 'bg-orange-500',
    textClass: 'text-orange-700',
    badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
    bgClass: 'bg-orange-50/30',
    Icon: AlertTriangle,
    iconClass: 'text-orange-500',
  },
  [AlertType.ALL_CLEAR]: {
    label: ALERT_TYPE_HE[AlertType.ALL_CLEAR],
    borderClass: 'event-type-all-clear',
    dotClass: 'bg-green-500',
    textClass: 'text-green-700',
    badgeClass: 'bg-green-100 text-green-700 border border-green-200',
    bgClass: 'bg-green-50/40',
    Icon: CheckCircle2,
    iconClass: 'text-green-500',
  },
} as const

type TypeFilter = 'all' | AlertType

interface FilterTab {
  id: TypeFilter
  label: string
  cls: string
}

const FILTER_TABS: FilterTab[] = [
  { id: 'all',                  label: 'הכל',              cls: 'filter-tab filter-tab-all' },
  { id: AlertType.RED_ALERT,    label: 'צבע אדום',         cls: 'filter-tab filter-tab-red' },
  { id: AlertType.WARNING,      label: 'התרעה',            cls: 'filter-tab filter-tab-warning' },
  { id: AlertType.ALL_CLEAR,    label: 'יציאה מהמקלט',    cls: 'filter-tab filter-tab-clear' },
]

// ─── Relative time display (Hebrew) ──────────────────────────────────────────

function hebrewRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `לפני ${secs} שניות`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `לפני ${mins} דקות`
  const hours = Math.floor(mins / 60)
  return `לפני ${hours} שעות`
}

interface Props { compact?: boolean }

export default function EventFeed({ compact }: Props) {
  const { events, activeEvents, wsConnected, lastEventReceivedAt, activeRedAlerts, activeWarnings } =
    useAlertStore()
  const { adapterStatuses } = useSystemStore()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [, forceRender] = useState(0)

  // Re-render every 10s so relative times stay fresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 10_000)
    return () => clearInterval(id)
  })

  // Determine primary sources
  const primarySources = new Set(
    adapterStatuses.filter((s) => s.isPrimary).map((s) => s.name)
  )

  // Filter and slice
  const filtered = typeFilter === 'all'
    ? events
    : events.filter((e) => (e.alertType ?? AlertType.WARNING) === typeFilter)

  const displayEvents = filtered.slice(0, compact ? 20 : 60)

  // Counts for badge tabs
  const activeCounts: Record<TypeFilter, number> = {
    all: activeEvents.length,
    [AlertType.RED_ALERT]: activeRedAlerts,
    [AlertType.WARNING]: activeWarnings,
    [AlertType.ALL_CLEAR]: 0,
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">

      {/* ── Connection status bar ─── */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {wsConnected
            ? <Wifi className="w-3 h-3 text-emerald-500" />
            : <WifiOff className="w-3 h-3 text-rose-500" />}
          <span className={cn(
            'text-[10px] font-semibold',
            wsConnected ? 'text-emerald-600' : 'text-rose-500'
          )}>
            {wsConnected ? 'מחובר' : 'מנותק'}
          </span>
        </div>
        {lastEventReceivedAt && (
          <span className="text-[10px] text-slate-400">
            {hebrewRelativeTime(lastEventReceivedAt)}
          </span>
        )}
        {activeEvents.length > 0 && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 tabular-nums">
            {activeEvents.length} פעיל
          </span>
        )}
      </div>

      {/* ── Type filter tabs ─── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 flex-shrink-0 flex-wrap bg-white">
        {FILTER_TABS.map(({ id, label, cls }) => {
          const count = activeCounts[id]
          return (
            <button
              key={id}
              onClick={() => setTypeFilter(id)}
              className={cn(cls, typeFilter === id ? 'active' : '')}
            >
              {label}
              {count > 0 && (
                <span className="mr-1 font-bold tabular-nums">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Event list ─── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-slate-300 gap-1">
            <BellOff className="w-4 h-4" />
            <span className="text-xs text-slate-400">אין התרעות</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {displayEvents.map((event) => {
              const alertType = event.alertType ?? AlertType.WARNING
              const cfg = TYPE_CONFIG[alertType]
              const TypeIcon = cfg.Icon
              const isActive = event.status === AlertStatus.ACTIVE
              const sourceLabel = SOURCE_HE[event.source] ?? event.source
              const isMultiSource = event.provenance && event.provenance.length > 1
              const isPrimary = primarySources.has(event.source)

              return (
                <div
                  key={event.id}
                  className={cn(
                    'px-3 py-2.5 transition-colors hover:bg-slate-50/80 event-new',
                    cfg.borderClass,
                    !isActive && 'opacity-50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Type icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <TypeIcon className={cn('w-3.5 h-3.5', cfg.iconClass)} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      {/* Area name + badges row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn('text-xs font-bold truncate', cfg.textClass)}>
                          {event.areaName}
                        </span>
                        {isActive && (
                          <span className="text-[9px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                            חי
                          </span>
                        )}
                        {isMultiSource && (
                          <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                            {event.provenance.length} מקורות
                          </span>
                        )}
                      </div>

                      {/* Alert type badge */}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', cfg.badgeClass)}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {CATEGORY_HE[event.category] ?? event.category}
                        </span>
                      </div>

                      {/* Source + time */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {event.source !== 'mock' && event.source !== 'simulation' && isPrimary && (
                          <>
                            <span className="text-[10px] text-slate-500 font-medium">{sourceLabel}</span>
                            <span className="text-slate-300">·</span>
                          </>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {hebrewRelativeTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
