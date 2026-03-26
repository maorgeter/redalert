interface BackoffOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs?: number;
    label?: string;
}
export declare function withExponentialBackoff<T>(fn: () => Promise<T>, opts: BackoffOptions): Promise<T>;
export declare const sleep: (ms: number) => Promise<void>;
export {};
//# sourceMappingURL=retry.d.ts.map