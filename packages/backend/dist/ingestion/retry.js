"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
exports.withExponentialBackoff = withExponentialBackoff;
const logger_1 = require("../logger");
async function withExponentialBackoff(fn, opts) {
    const { maxRetries, baseDelayMs, maxDelayMs = 30000, label = 'op' } = opts;
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        }
        catch (err) {
            attempt++;
            if (attempt > maxRetries)
                throw err;
            const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
            const jitter = Math.random() * delay * 0.2;
            const wait = Math.floor(delay + jitter);
            logger_1.logger.warn({ attempt, wait, label }, 'Retrying after error');
            await (0, exports.sleep)(wait);
        }
    }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;
//# sourceMappingURL=retry.js.map