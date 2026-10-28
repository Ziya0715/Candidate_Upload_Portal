import 'server-only';
import mysql from 'mysql2/promise';
import { httpError } from '../http';

const POOL_KEY = Symbol.for('video-share.teamPool');

export function databaseUrl() {
  return String(process.env.DATABASE_URL || '').trim();
}

export function teamConfigured() {
  return Boolean(databaseUrl());
}

function unavailable(message) {
  const error = httpError(message, 503);
  error.publicMessage = message;
  return error;
}

export function teamPool() {
  const url = databaseUrl();
  if (!url) {
    throw unavailable('Team Management needs DATABASE_URL. The upload desk is unchanged.');
  }
  const current = globalThis[POOL_KEY];
  if (current?.pool && current.url === url) return current.pool;
  if (current?.pool) current.pool.end().catch(() => {});
  const pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 2,
    maxIdle: 1,
    idleTimeout: 10000,
    timezone: '+05:30',
    dateStrings: true,
    enableKeepAlive: false,
    connectTimeout: 10000,
  });
  globalThis[POOL_KEY] = { url, pool };
  return pool;
}

function dropped(error) {
  return error?.code === 'ECONNRESET' || error?.code === 'PROTOCOL_CONNECTION_LOST' || error?.fatal;
}

async function resetPool() {
  const current = globalThis[POOL_KEY];
  globalThis[POOL_KEY] = null;
  if (!current?.pool) return;
  try {
    await current.pool.end();
  } catch {
    // The remote server already closed this connection.
  }
}

export async function teamQuery(sql, params = []) {
  try {
    const [rows] = await teamPool().query(sql, params);
    return rows;
  } catch (error) {
    if (!dropped(error)) throw error;
    await resetPool();
    const [rows] = await teamPool().query(sql, params);
    return rows;
  }
}

export async function teamTransaction(work) {
  const connection = await teamPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The connection is already closed.
    }
    throw error;
  } finally {
    connection.release();
  }
}
