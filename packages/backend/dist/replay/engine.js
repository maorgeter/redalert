"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayEngine = void 0;
const events_1 = require("events");
const schema_1 = require("../normalization/schema");
const logger_1 = require("../logger");
const retry_1 = require("../ingestion/retry");
/**
 * Replays a sorted sequence of historical alert events, emitting them
 * with time-proportional delays adjusted by speed multiplier.
 */
class ReplayEngine extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.state = {
            sessionId: '',
            status: 'idle',
            currentIndex: 0,
            totalEvents: 0,
            speed: 1,
            startedAt: null,
            currentEventTime: null,
        };
        this.events = [];
        this.pausePromise = null;
        this.pauseResolve = null;
        this.aborted = false;
    }
    getState() {
        return { ...this.state };
    }
    async start(sessionId, events, speed = 1) {
        if (this.state.status === 'playing')
            await this.stop();
        this.events = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        this.aborted = false;
        this.state = {
            sessionId,
            status: 'playing',
            currentIndex: 0,
            totalEvents: this.events.length,
            speed,
            startedAt: new Date(),
            currentEventTime: this.events[0]?.timestamp ?? null,
        };
        logger_1.logger.info({ sessionId, count: this.events.length, speed }, 'Replay started');
        this.emit('state', this.getState());
        this.run();
    }
    pause() {
        if (this.state.status !== 'playing')
            return;
        this.state.status = 'paused';
        this.pausePromise = new Promise((resolve) => {
            this.pauseResolve = resolve;
        });
        this.emit('state', this.getState());
    }
    resume() {
        if (this.state.status !== 'paused')
            return;
        this.state.status = 'playing';
        this.pauseResolve?.();
        this.pauseResolve = null;
        this.pausePromise = null;
        this.emit('state', this.getState());
    }
    seek(index) {
        this.state.currentIndex = Math.max(0, Math.min(index, this.events.length - 1));
        this.state.currentEventTime = this.events[this.state.currentIndex]?.timestamp ?? null;
        this.emit('state', this.getState());
    }
    setSpeed(speed) {
        this.state.speed = speed;
        this.emit('state', this.getState());
    }
    async stop() {
        this.aborted = true;
        this.pauseResolve?.();
        this.state.status = 'idle';
        this.emit('state', this.getState());
    }
    async run() {
        const events = this.events;
        while (this.state.currentIndex < events.length && !this.aborted) {
            if (this.state.status === 'paused' && this.pausePromise) {
                await this.pausePromise;
            }
            if (this.aborted)
                break;
            const current = events[this.state.currentIndex];
            const next = events[this.state.currentIndex + 1];
            // Emit event as active
            const replayEvent = {
                ...current,
                source: `replay:${current.source}`,
                status: schema_1.AlertStatus.ACTIVE,
                receivedAt: new Date(),
            };
            this.emit('event', replayEvent);
            this.state.currentIndex++;
            this.state.currentEventTime = current.timestamp;
            // Wait proportional time until next event
            if (next) {
                const realGapMs = next.timestamp.getTime() - current.timestamp.getTime();
                const scaledGap = Math.min(realGapMs / this.state.speed, 5000);
                if (scaledGap > 50)
                    await (0, retry_1.sleep)(scaledGap);
            }
        }
        if (!this.aborted) {
            this.state.status = 'finished';
            this.emit('state', this.getState());
            this.emit('finished');
            logger_1.logger.info({ sessionId: this.state.sessionId }, 'Replay finished');
        }
    }
}
exports.ReplayEngine = ReplayEngine;
//# sourceMappingURL=engine.js.map