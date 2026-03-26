import { PoolClient } from 'pg';
export declare function initDb(): Promise<void>;
export declare function isDbAvailable(): boolean;
export declare function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
export declare function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T | null>;
export declare function closeDb(): Promise<void>;
//# sourceMappingURL=db.d.ts.map