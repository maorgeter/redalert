'use client'
import { useState } from 'react'
import { useMapStore, MapLayer } from '@/store/mapStore'
import { Eye, EyeOff, Layers, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const TYPE_GUIDE = [
  { label: 'צבע אדום',      colorClass: 'bg-red-600' },
  { label: 'התרעה',         colorClass: 'bg-orange-500' },
  { label: 'יציאה מהמקלט', colorClass: 'bg-green-500' },
]

// ── Shared body rendered in both mobile panel and desktop panel ───────────────
function LegendBody({
  layerVisibility,
  toggleLayer,
}: {
  layerVisibility: Record<MapLayer, boolean>
  toggleLayer: (l: MapLayer) => void
}) {
  return (
    <>
      <div className="space-y-1.5 mb-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.layer} className="flex items-center gap-2">
            <span className={layerVisibility[item.layer] ? 'text-slate-700' : 'text-slate-300'}>
              {item.label}
            </span>
            <div
              className={cn(
                'w-4 h-4 rounded-sm flex-shrink-0',
                item.colorClass,
                item.borderStyle ?? '',
                !layerVisibility[item.layer] && 'opacity-30'
              )}
            />
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

      <div className="border-t border-slate-100 pt-2 mb-2">
        <div className="text-slate-500 font-semibold mb-1.5 text-[10px] uppercase tracking-wide">
          סוגי התרעה
        </div>
        <div className="space-y-1">
          {TYPE_GUIDE.map((t) => (
            <div key={t.label} className="flex items-center gap-2">
              <span className="text-slate-700">{t.label}</span>
              <div className={cn('w-3 h-3 rounded-full flex-shrink-0', t.colorClass)} />
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-2 text-slate-400 text-[9px] leading-snug">
        ⚠ אזורים משוערים הם ויזואליזציות בלבד
      </div>
    </>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapLegend() {
  const { layerVisibility, toggleLayer } = useMapStore()
  // Mobile: collapsed by default so it doesn't cover the map
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    // Extra bottom margin on mobile to stay clear of the bottom nav bar
    <div className="absolute bottom-14 md:bottom-8 right-3 z-10 text-xs" dir="rtl">

      {/* ── Mobile: floating icon button ↔ expanded panel ───────────────── */}
      <div className="md:hidden">
        {mobileOpen ? (
          <div className="bg-white/98 backdrop-blur-sm border border-slate-200 rounded-xl shadow-xl p-3 min-w-[190px]">
            {/* Title row with close button */}
            <div className="flex items-center justify-between mb-2.5">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="סגור מקרא"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">
                מקרא מפה
              </span>
            </div>
            <LegendBody layerVisibility={layerVisibility} toggleLayer={toggleLayer} />
          </div>
        ) : (
          // Small pill button — won't block map center
          <button
            onClick={() => setMobileOpen(true)}
            className="h-9 px-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-full shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
            aria-label="פתח מקרא מפה"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[10px] font-semibold text-slate-600 tracking-wide">מקרא</span>
          </button>
        )}
      </div>

      {/* ── Desktop: always-visible panel ───────────────────────────────── */}
      <div className="hidden md:block bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg p-3 min-w-[200px] shadow-md">
        <div className="text-slate-500 font-semibold mb-2 text-[10px] uppercase tracking-wide">
          מקרא מפה
        </div>
        <LegendBody layerVisibility={layerVisibility} toggleLayer={toggleLayer} />
      </div>
    </div>
  )
}
