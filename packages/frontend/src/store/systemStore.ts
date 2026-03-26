import { create } from 'zustand'
import { HealthStatus, AdapterStatus } from '@/types'

interface SystemStore {
  health: HealthStatus | null
  adapterStatuses: AdapterStatus[]
  setHealth: (health: HealthStatus) => void
  setAdapterStatuses: (statuses: AdapterStatus[]) => void
}

export const useSystemStore = create<SystemStore>((set) => ({
  health: null,
  adapterStatuses: [],
  setHealth: (health) => set({ health }),
  setAdapterStatuses: (adapterStatuses) => set({ adapterStatuses }),
}))
