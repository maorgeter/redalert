import 'dotenv/config';
export declare const config: {
    readonly port: number;
    readonly db: {
        readonly host: string;
        readonly port: number;
        readonly database: string;
        readonly user: string;
        readonly password: string;
        readonly max: number;
    };
    readonly ingestion: {
        readonly mockEnabled: boolean;
        readonly orefEnabled: boolean;
        readonly pollIntervalMs: number;
        readonly mockEventIntervalMs: number;
    };
    readonly estimation: {
        readonly bufferKm: number;
        readonly decayMs: number;
        readonly recomputeIntervalMs: number;
        readonly maxTrendEvents: 10;
        readonly minTrendEvents: 3;
        readonly uncertaintyMultiplier: 1.8;
    };
    readonly cors: {
        readonly origin: string;
    };
    readonly geofencesPath: string;
};
//# sourceMappingURL=index.d.ts.map