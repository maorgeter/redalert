import { EventEmitter } from 'events';
import { NormalizedEvent } from '../normalization/schema';
export type ReplaySpeed = 1 | 5 | 20;
export interface ReplayState {
    sessionId: string;
    status: 'idle' | 'playing' | 'paused' | 'finished';
    currentIndex: number;
    totalEvents: number;
    speed: ReplaySpeed;
    startedAt: Date | null;
    currentEventTime: Date | null;
}
/**
 * Replays a sorted sequence of historical alert events, emitting them
 * with time-proportional delays adjusted by speed multiplier.
 */
export declare class ReplayEngine extends EventEmitter {
    private state;
    private events;
    private pausePromise;
    private pauseResolve;
    private aborted;
    getState(): ReplayState;
    start(sessionId: string, events: NormalizedEvent[], speed?: ReplaySpeed): Promise<void>;
    pause(): void;
    resume(): void;
    seek(index: number): void;
    setSpeed(speed: ReplaySpeed): void;
    stop(): Promise<void>;
    private run;
}
//# sourceMappingURL=engine.d.ts.map