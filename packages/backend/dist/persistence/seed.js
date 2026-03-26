"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pg_1 = require("pg");
const config_1 = require("../config");
const uuid_1 = require("uuid");
async function seed() {
    const pool = new pg_1.Pool(config_1.config.db);
    const mockPath = path.join(__dirname, '../../data/mock-events.json');
    if (!fs.existsSync(mockPath)) {
        console.log('No mock-events.json found, skipping seed');
        await pool.end();
        return;
    }
    const raw = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
    let inserted = 0;
    for (const r of raw) {
        const id = r.id ?? (0, uuid_1.v4)();
        const ts = r.timestamp ? new Date(r.timestamp) : new Date();
        await pool.query(`INSERT INTO alert_events
        (id, source, timestamp, area_name, area_type, city_names, geofence_id,
         raw_payload, received_at, updated_at, severity, confidence, status, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`, [
            id, 'seed', ts, r.areaName, 'ZONE', [r.areaName], r.geofenceId ?? null,
            JSON.stringify(r), ts, ts, 'HIGH', 0.9, 'EXPIRED', r.category ?? 'rockets',
        ]);
        inserted++;
    }
    console.log(`Seeded ${inserted} mock events`);
    await pool.end();
}
seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map