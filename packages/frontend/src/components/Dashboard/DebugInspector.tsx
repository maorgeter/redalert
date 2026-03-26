'use client'
import { useMapStore } from '@/store/mapStore'
import { useAlertStore } from '@/store/alertStore'
import { X, Search } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { he } from 'date-fns/locale'
import { SEVERITY_HE, CATEGORY_HE, ALERT_TYPE_HE, AlertType } from '@/types'
import { cn } from '@/lib/utils'

// In RTL: first DOM element appears on the RIGHT, last on the LEFT.
// So label (right side) comes first in DOM, value (left side) comes second.
function Row({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-gray-100 last:border-0" dir="rtl">
      <span className="text-[10px] text-gray-400 flex-shrink-0">{label}</span>
      <span className={cn('text-[10px]', mono ? 'font-mono text-green-700' : 'text-gray-600')}>
        {value}
      </span>
    </div>
  )
}

export default function DebugInspector() {
  const { selectedGeofenceId, selectedZoneId, inspectorOpen, setInspectorOpen, selectGeofence, selectZone } =
    useMapStore()
  const { events, estimatedZones } = useAlertStore()

  if (!inspectorOpen) return null

  const selectedEvent = events.find((e) => e.id === selectedGeofenceId)
  const selectedZone = estimatedZones.find((z) => z.id === selectedZoneId)

  return (
    <div className="absolute bottom-0 left-0 w-72 max-h-[60vh] bg-white/96 backdrop-blur border border-gray-200 rounded-t-lg overflow-hidden flex flex-col z-20 shadow-lg" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
        <button
          onClick={() => {
            setInspectorOpen(false)
            selectGeofence(null)
            selectZone(null)
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-700 text-xs font-semibold">בדיקת פוליגון</span>
          <Search className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {selectedEvent && (
          <div>
            <div className="text-gray-500 text-[10px] uppercase tracking-wide mb-2 font-bold text-right">
              אירוע התרעה
            </div>
            <Row label="מזהה" value={selectedEvent.id.slice(0, 16) + '…'} mono />
            <Row label="אזור" value={selectedEvent.areaName} />
            <Row label="מקור" value={selectedEvent.source} />
            {selectedEvent.provenance && selectedEvent.provenance.length > 0 && (
              <Row label="מקורות" value={selectedEvent.provenance.join(', ')} />
            )}
            <Row label="סוג התרעה" value={ALERT_TYPE_HE[selectedEvent.alertType ?? AlertType.WARNING]} />
            <Row label="חומרה" value={SEVERITY_HE[selectedEvent.severity] ?? selectedEvent.severity} />
            <Row label="קטגוריה" value={CATEGORY_HE[selectedEvent.category] ?? selectedEvent.category} />
            <Row label="מצב" value={selectedEvent.status === 'ACTIVE' ? 'פעיל' : 'פג תוקף'} />
            <Row label="ביטחון" value={`${(selectedEvent.confidence * 100).toFixed(0)}%`} />
            <Row label="שעה" value={format(new Date(selectedEvent.timestamp), 'HH:mm:ss')} />
            <Row label="גיל" value={formatDistanceToNow(new Date(selectedEvent.timestamp), { locale: he })} />
          </div>
        )}

        {selectedZone && (
          <div>
            <div className="text-amber-600 text-[10px] uppercase tracking-wide mb-2 font-bold text-right">
              אזור משוער — ויזואליזציה בלבד
            </div>
            <Row label="מזהה" value={selectedZone.id.slice(0, 16) + '…'} mono />
            <Row label="ביטחון" value={`${(selectedZone.confidence * 100).toFixed(0)}%`} />
            <Row label="שיטה" value={selectedZone.explanation.method} />
            <Row label="אירועים" value={selectedZone.explanation.activeEventCount} />
            <Row label="חיץ (ק״מ)" value={selectedZone.explanation.bufferKm} />
            <Row label="אזורים" value={selectedZone.affectedAreas.join('، ')} />
            <Row label="אירוע אחרון" value={formatDistanceToNow(new Date(selectedZone.lastEventAt), { addSuffix: true, locale: he })} />
            {selectedZone.trend && (
              <>
                <Row label="כיוון תנועה" value={`${selectedZone.trend.bearing.toFixed(0)}°`} />
                <Row label="מהירות" value={`${selectedZone.trend.speedKmPerMin.toFixed(1)} ק״מ/דק׳`} />
              </>
            )}
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 leading-relaxed text-right">
              {selectedZone.explanation.notes[0]}
            </div>
          </div>
        )}

        {!selectedEvent && !selectedZone && (
          <div className="text-gray-400 text-xs text-center py-4">
            לחץ על פוליגון במפה לבדיקה
          </div>
        )}
      </div>
    </div>
  )
}
