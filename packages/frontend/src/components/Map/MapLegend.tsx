'use client'
import { useMapStore, MapLayer } from '@/store/mapStore'
import { Eye, EyeOff } from 'lucide-react'

interface LegendItem {
  layer: MapLayer
  label: string
  colorClass: string
  borderStyle?: string
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    layer: 'activeAlerts',
    label: 'אזור התרעה רשמי',
    colorClass: 'bg-red-500',
  },
  {
    layer: 'estimatedZones',
    label: 'אזור דינאמי משוער',
    colorClass: 'bg-amber-400/70',
    borderStyle: 'border-2 border-dashed border-amber-500',
  },
  {
    layer: 'uncertainty',
    label: 'מעטפת אי-ודאות',
    colorClass: 'bg-amber-200/50',
    borderStyle: 'border border-amber-300',
  },
  {
    layer: 'geofences',
    label: 'גבולות אזורים',
    colorClass: 'bg-blue-100',
    borderStyle: 'border border-slate-300',
  },
]

// Alert type colour guide (not interactive, just informational)
const TYPE_GUIDE = [
  { label: 'צבע אדום', colorClass: 'bg-red-600' },
  { label: 'התרעה',   colorClass: 'bg-orange-500' },
  { label: 'יציאה מהמקלט', colorClass: 'bg-green-500' },
]

export default function MapLegend() {
  const { layerVisibility, toggleLayer } = useMapStore()

  return (
    // Position bottom-right so it does not overlap scale control (bottom-left)
    <div
      className="absolute bottom-8 right-3 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg p-3 min-w-[200px] text-xs shadow-md"
      dir="rtl"
    >
      {/* Layer visibility section */}
      <div className="text-slate-500 font-semibold mb-2 text-[10px] uppercase tracking-wide">
        מקרא מפה
      </div>
      <div className="space-y-1.5 mb-3">
        {LEGEND_ITEMS.map((item) => (
          // RTL flex: label (first DOM) → RIGHT; swatch → middle; eye icon (last DOM) → LEFT
          <div key={item.layer} className="flex items-center gap-2">
            <span className={layerVisibility[item.layer] ? 'text-slate-700' : 'text-slate-300'}>
              {item.label}
            </span>
            <div className={`w-4 h-4 rounded-sm flex-shrink-0 ${item.colorClass} ${item.borderStyle ?? ''} ${
              !layerVisibility[item.layer] ? 'opacity-30' : ''
            }`} />
            <button
              onClick={() => toggleLayer(item.layer)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              title={layerVisibility[item.layer] ? 'הסתר שכבה' : 'הצג שכבה'}
            >
              {layerVisibility[item.layer]
                ? <Eye className="w-3 h-3 text-slate-500" />
                : <EyeOff className="w-3 h-3 text-slate-300" />}
            </button>
          </div>
        ))}
      </div>

      {/* Alert type guide */}
      <div className="border-t border-slate-100 pt-2 mb-2">
        <div className="text-slate-500 font-semibold mb-1.5 text-[10px] uppercase tracking-wide">
          סוגי התרעה
        </div>
        <div className="space-y-1">
          {TYPE_GUIDE.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className="text-slate-700">{t.label}</span>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${t.colorClass}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-slate-100 pt-2 text-slate-400 text-[9px] leading-snug">
        ⚠ אזורים משוערים הם ויזואליזציות בלבד
      </div>
    </div>
  )
}
