'use client'
import { useSystemStore } from '@/store/systemStore'
import { useAlertStore } from '@/store/alertStore'
import { Activity, Database, Clock, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

function Stat({
  icon: Icon,
  label,
  value,
  valueClass = 'text-gray-700',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 text-[11px] flex-1">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', valueClass)}>{value}</span>
    </div>
  )
}

export default function SystemHealth() {
  const { health } = useSystemStore()
  const { activeEvents, estimatedZones } = useAlertStore()

  const statusConfig = {
    ok: { label: 'תקין', color: 'text-green-600' },
    degraded: { label: 'מוגבל', color: 'text-yellow-600' },
  }
  const current = health?.status ? statusConfig[health.status] : null
  const lastZone = estimatedZones[0]?.computedAt
    ? `לפני ${Math.floor((Date.now() - new Date(estimatedZones[0].computedAt).getTime()) / 1000)}ש׳`
    : 'אין'

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
        <Activity className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-700 text-xs font-semibold flex-1">מצב מערכת</span>
        {current && (
          <span className={cn('text-[10px] font-semibold', current.color)}>
            {current.label}
          </span>
        )}
      </div>

      <Stat
        icon={Activity}
        label="התרעות פעילות"
        value={activeEvents.length}
        valueClass={activeEvents.length > 0 ? 'text-red-600' : 'text-green-600'}
      />
      <Stat
        icon={Database}
        label="אזורים משוערים"
        value={estimatedZones.length}
        valueClass={estimatedZones.length > 0 ? 'text-amber-600' : 'text-gray-500'}
      />
      <Stat icon={Users} label="לקוחות מחוברים" value={health?.clientCount ?? '—'} />
      <Stat
        icon={Clock}
        label="זמן פעולה"
        value={health?.uptime ? `${Math.floor(health.uptime / 60)} דק׳` : '—'}
      />
      <Stat icon={Clock} label="עדכון אזור אחרון" value={lastZone} valueClass="text-gray-500" />
    </div>
  )
}
