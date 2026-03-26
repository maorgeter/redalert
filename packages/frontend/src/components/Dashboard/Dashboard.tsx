'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAlertStore } from '@/store/alertStore'
import { useMapStore } from '@/store/mapStore'
import DisclaimerBanner from '@/components/common/DisclaimerBanner'
import EventFeed from './EventFeed'
import SystemHealth from './SystemHealth'
import SourceStatus from './SourceStatus'
import SourcePanel from './SourcePanel'
import DebugInspector from './DebugInspector'
import PipelineDiagnostics from './PipelineDiagnostics'
import MapLegend from '@/components/Map/MapLegend'
import { WifiOff, Map, Bell, Activity, ChevronDown, Radio, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const MapContainer = dynamic(() => import('@/components/Map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
        <div className="text-[11px] text-slate-400 tracking-wide">טוען מפה...</div>
      </div>
    </div>
  ),
})

type MobileSheet = 'none' | 'alerts' | 'status' | 'sources'

// ── Collapsible section ──────────────────────────────────────────────────────
function SideSection({
  label,
  defaultOpen = true,
  badge,
  children,
}: {
  label: string
  defaultOpen?: boolean
  badge?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100 group"
      >
        <span className="section-label flex-1 text-right">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="text-[9px] font-bold bg-red-100 text-red-600 border border-red-200 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {badge}
          </span>
        )}
        {/* ChevronDown: rotate -90° when closed (points left = RTL "expand" direction) */}
        <ChevronDown
          className={cn(
            'w-3 h-3 text-slate-400 transition-transform duration-200 group-hover:text-slate-600',
            open ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      <div
        className="section-body"
        style={{ maxHeight: open ? '600px' : '0', opacity: open ? 1 : 0 }}
      >
        {children}
      </div>
    </div>
  )
}

// ── Live clock ───────────────────────────────────────────────────────────────
function useClock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    setT(fmt())
    const id = setInterval(() => setT(fmt()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  useWebSocket()

  const { wsConnected, activeEvents } = useAlertStore()
  const { inspectorOpen } = useMapStore()
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>('none')
  const [alertFlash, setAlertFlash] = useState(false)
  const prevCountRef = useRef(0)
  const clock = useClock()

  // Flash count badge on change
  useEffect(() => {
    if (activeEvents.length !== prevCountRef.current && prevCountRef.current !== 0) {
      setAlertFlash(true)
      const t = setTimeout(() => setAlertFlash(false), 800)
      return () => clearTimeout(t)
    }
    prevCountRef.current = activeEvents.length
  }, [activeEvents.length])

  const toggleSheet = (sheet: MobileSheet) =>
    setMobileSheet(prev => (prev === sheet ? 'none' : sheet))

  const hasAlerts = activeEvents.length > 0
  const sheetTitle: Record<MobileSheet, string> = {
    none: '', alerts: 'התרעות', status: 'מצב מערכת', sources: 'ניהול מקורות',
  }

  return (
    <div className="h-[100dvh] bg-slate-50 text-slate-900 flex flex-col overflow-hidden">

      {/* ── Broadcast top bar ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 bg-white z-20 flex flex-col">
        {/* Accent line — red when active alerts, slate otherwise */}
        <div
          className={cn(
            'h-0.5 w-full transition-colors duration-700',
            hasAlerts ? 'bg-red-600' : wsConnected ? 'bg-slate-700' : 'bg-amber-400'
          )}
        />

        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
          {/* Left — live indicator */}
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="relative flex-shrink-0">
              <div className={cn(
                'w-2 h-2 rounded-full',
                wsConnected ? 'bg-red-500 live-dot' : 'bg-amber-400 status-connecting'
              )} />
            </div>
            <span className={cn(
              'text-[10px] font-bold tracking-widest uppercase select-none',
              wsConnected ? 'text-red-600' : 'text-amber-500 status-connecting'
            )}>
              {wsConnected ? 'חי' : 'מתחבר'}
            </span>
          </div>

          {/* Center — title + alert count */}
          <div className="flex items-center gap-2.5">
            {hasAlerts && (
              <div className={cn(
                'flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 transition-all',
                alertFlash && 'count-flash'
              )}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-700 text-[11px] font-bold tabular-nums">
                  {activeEvents.length}
                </span>
                <span className="text-red-600 text-[10px] font-medium hidden xs:inline">
                  התרעות
                </span>
              </div>
            )}
            <h1 className="text-[13px] font-bold text-slate-800 tracking-tight leading-none">
              מפת התרעות דינאמית
            </h1>
          </div>

          {/* Right — alerts list shortcut (mobile) + clock (desktop) */}
          <div className="flex items-center gap-2 min-w-[80px] justify-end">
            {!wsConnected && (
              <WifiOff className="w-3.5 h-3.5 text-slate-400 status-connecting" />
            )}
            {/* Mobile-only list button for quick access to the alerts drawer */}
            <button
              className="md:hidden relative p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => toggleSheet('alerts')}
              aria-label="פתח רשימת התרעות"
            >
              <List className="w-4.5 h-4.5 text-slate-600" />
              {activeEvents.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 tabular-nums">
                  {activeEvents.length}
                </span>
              )}
            </button>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums hidden md:block">
              {clock}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Desktop sidebar (RTL: right side) */}
        <aside className="hidden md:flex w-72 flex-col border-l border-slate-200 bg-white overflow-hidden flex-shrink-0">
          <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin divide-y divide-slate-100">
            <SideSection label="התרעות" defaultOpen badge={activeEvents.length}>
              <EventFeed />
            </SideSection>
            <SideSection label="מצב מערכת" defaultOpen={false}>
              <SystemHealth />
            </SideSection>
            <SideSection label="מקורות" defaultOpen={false}>
              <SourceStatus />
            </SideSection>
            <SideSection label="ניהול מקורות" defaultOpen={false}>
              <SourcePanel />
            </SideSection>
            <SideSection label="אבחון צינור" defaultOpen={false}>
              <PipelineDiagnostics />
            </SideSection>
          </div>
        </aside>

        {/* Map area */}
        <div className="flex-1 relative">
          <DisclaimerBanner />
          <MapContainer />
          <MapLegend />
          <DebugInspector />

          {/* Backdrop — dims the map, tap to dismiss */}
          <div
            className={cn(
              'md:hidden absolute inset-0 z-10 bg-black/30 transition-opacity duration-300',
              mobileSheet !== 'none' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={() => setMobileSheet('none')}
            aria-hidden="true"
          />

          {/* Bottom drawer — slides up from below, covers ~68 % of screen */}
          <div
            className={cn(
              'md:hidden absolute bottom-0 inset-x-0 z-20 bg-white flex flex-col rounded-t-2xl shadow-2xl overflow-hidden',
              'h-[68vh]',
              'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
              mobileSheet !== 'none' ? 'translate-y-0' : 'translate-y-full'
            )}
          >
            {/* Drag handle */}
            <div className="flex-shrink-0 pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Sheet title row */}
            <div className="flex-shrink-0 flex justify-between items-center px-4 pb-3 border-b border-slate-100">
              <div className="w-16" />
              <span className="text-sm font-semibold text-slate-700">
                {sheetTitle[mobileSheet]}
              </span>
              <button
                onClick={() => setMobileSheet('none')}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <span className="text-sm">סגור</span>
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {mobileSheet === 'alerts' && <EventFeed compact />}
              {mobileSheet === 'status' && (
                <div className="divide-y divide-slate-100">
                  <SystemHealth />
                  <SourceStatus />
                </div>
              )}
              {mobileSheet === 'sources' && <SourcePanel />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden flex-shrink-0 flex bg-white border-t border-slate-200 safe-bottom">
        <NavBtn icon={Map}      label="מפה"     active={mobileSheet === 'none'}    onClick={() => setMobileSheet('none')} />
        <NavBtn icon={Bell}     label="התרעות"  active={mobileSheet === 'alerts'}  badge={activeEvents.length || undefined} onClick={() => toggleSheet('alerts')} />
        <NavBtn icon={Activity} label="מצב"     active={mobileSheet === 'status'}  onClick={() => toggleSheet('status')} />
        <NavBtn icon={Radio}    label="מקורות"  active={mobileSheet === 'sources'} onClick={() => toggleSheet('sources')} />
      </nav>
    </div>
  )
}

function NavBtn({
  icon: Icon, label, active, badge, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string; active: boolean; badge?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'mobile-nav-btn flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-colors relative',
        active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
      )}
    >
      <div className="relative">
        <Icon className="w-5 h-5" />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      {active && (
        <div className="absolute top-0 right-0 left-0 h-0.5 bg-blue-500 rounded-b" />
      )}
    </button>
  )
}
