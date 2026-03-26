"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.isDbAvailable = isDbAvailable;
exports.query = query;
exports.withTransaction = withTransaction;
exports.closeDb = closeDb;
const pg_1 = require("pg");
const config_1 = require("../config");
const logger_1 = require("../logger");
let pool = null;
let available = false;
async function initDb() {
    try {
        pool = new pg_1.Pool(config_1.config.db);
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        available = true;
        logger_1.logger.info({ host: config_1.config.db.host, db: config_1.config.db.database }, 'PostgreSQL connected');
    }
    catch (err) {
        available = false;
        logger_1.logger.warn({ err: err.message }, 'PostgreSQL unavailable — running without persistence');
        pool = null;
    }
}
function isDbAvailable() {
    return available;
}
async function query(sql, params) {
    if (!pool || !available)
        return [];
    const res = await pool.query(sql, params);
    return res.rows;
}
async function withTransaction(fn) {
    if (!pool || !available)
        return null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function closeDb() {
    if (pool) {
        await pool.end();
        pool = null;
        available = false;
    }
}
//# sourceMappingURL=db.js.map