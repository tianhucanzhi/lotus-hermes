/**
 * activation.cjs
 *
 * Desktop activation: validate codes against a remote MySQL database and
 * cache the result locally. Kept electron-free for unit testing.
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const Module = require('node:module')
const os = require('node:os')
const path = require('node:path')

const DEFAULT_DB_CONFIG = {
  host: process.env.LOTUS_ACTIVATION_DB_HOST || '106.15.250.152',
  port: Number(process.env.LOTUS_ACTIVATION_DB_PORT || 3306),
  user: process.env.LOTUS_ACTIVATION_DB_USER || 'root',
  password: process.env.LOTUS_ACTIVATION_DB_PASSWORD || 'root.2025',
  database: process.env.LOTUS_ACTIVATION_DB_NAME || 'lotus_hermes'
}

function skipActivation() {
  return process.env.HERMES_DESKTOP_SKIP_ACTIVATION === '1'
}

function normalizeCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function getMachineId() {
  const raw = [os.hostname(), os.platform(), os.arch(), os.userInfo().username].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function getMachineName() {
  return os.hostname()
}

function readLocalActivation(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

    if (!data?.code || !data?.expiresAt) {
      return null
    }

    return data
  } catch {
    return null
  }
}

function writeLocalActivation(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
}

function resolveMysql2Promise() {
  try {
    return require('mysql2/promise')
  } catch {
    const resourcesPath = process.resourcesPath

    if (!resourcesPath) {
      throw new Error('mysql2 is not available in this runtime')
    }

    const bundlePkg = path.join(resourcesPath, 'native-deps', 'mysql2-bundle', 'node_modules', 'mysql2', 'package.json')

    if (!fs.existsSync(bundlePkg)) {
      throw new Error(`mysql2 bundle missing at ${bundlePkg}`)
    }

    return Module.createRequire(bundlePkg)('mysql2/promise')
  }
}

async function withDb(fn) {
  const mysql = resolveMysql2Promise()
  const conn = await mysql.createConnection({
    ...DEFAULT_DB_CONFIG,
    connectTimeout: 10000
  })

  try {
    return await fn(conn)
  } finally {
    await conn.end()
  }
}

async function validateCodeInDb(code, machineId, machineName, appVersion) {
  const normalized = normalizeCode(code)

  if (!normalized) {
    return { ok: false, error: 'invalid_code' }
  }

  return withDb(async conn => {
    const [rows] = await conn.execute(
      `SELECT id, code, expires_at, max_activations, activation_count, status
       FROM activation_codes
       WHERE code = ?
       LIMIT 1`,
      [normalized]
    )

    if (!rows.length) {
      return { ok: false, error: 'not_found' }
    }

    const row = rows[0]

    if (row.status !== 'active') {
      return { ok: false, error: 'disabled' }
    }

    const expiresAt = new Date(row.expires_at)

    if (expiresAt.getTime() <= Date.now()) {
      return { ok: false, error: 'expired' }
    }

    const [existing] = await conn.execute(
      `SELECT id
       FROM activation_records
       WHERE code_id = ? AND machine_id = ?
       LIMIT 1`,
      [row.id, machineId]
    )

    if (!existing.length && row.activation_count >= row.max_activations) {
      return { ok: false, error: 'max_devices' }
    }

    await conn.beginTransaction()

    try {
      if (existing.length) {
        await conn.execute(
          `UPDATE activation_records
           SET last_seen_at = NOW(), machine_name = ?, app_version = ?
           WHERE id = ?`,
          [machineName, appVersion || null, existing[0].id]
        )
      } else {
        await conn.execute(
          `INSERT INTO activation_records (code_id, machine_id, machine_name, app_version)
           VALUES (?, ?, ?, ?)`,
          [row.id, machineId, machineName, appVersion || null]
        )
        await conn.execute(
          `UPDATE activation_codes
           SET activation_count = activation_count + 1
           WHERE id = ?`,
          [row.id]
        )
      }

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    }

    return {
      ok: true,
      code: row.code,
      expiresAt: expiresAt.toISOString()
    }
  })
}

async function getActivationStatus({ localPath, appVersion, skipRemote = false }) {
  if (skipActivation()) {
    return { activated: true, skipped: true }
  }

  const machineId = getMachineId()
  const machineName = getMachineName()
  const local = readLocalActivation(localPath)

  if (!local) {
    return { activated: false, reason: 'not_activated', machineId }
  }

  if (new Date(local.expiresAt).getTime() <= Date.now()) {
    return { activated: false, reason: 'expired', machineId }
  }

  if (skipRemote) {
    return {
      activated: true,
      code: local.code,
      expiresAt: local.expiresAt,
      activatedAt: local.activatedAt,
      machineId
    }
  }

  try {
    const remote = await validateCodeInDb(local.code, machineId, machineName, appVersion)

    if (!remote.ok) {
      return { activated: false, reason: remote.error, machineId }
    }

    const updated = {
      code: remote.code,
      expiresAt: remote.expiresAt,
      activatedAt: local.activatedAt || new Date().toISOString(),
      machineId
    }

    writeLocalActivation(localPath, updated)

    return {
      activated: true,
      code: updated.code,
      expiresAt: updated.expiresAt,
      activatedAt: updated.activatedAt,
      machineId
    }
  } catch {
    return {
      activated: true,
      code: local.code,
      expiresAt: local.expiresAt,
      activatedAt: local.activatedAt,
      machineId,
      offline: true
    }
  }
}

async function redeemActivationCode({ localPath, code, appVersion }) {
  if (skipActivation()) {
    return { ok: true, skipped: true }
  }

  const machineId = getMachineId()
  const machineName = getMachineName()

  let result

  try {
    result = await validateCodeInDb(code, machineId, machineName, appVersion)
  } catch (error) {
    return {
      ok: false,
      error: 'network',
      message: error instanceof Error ? error.message : String(error)
    }
  }

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const payload = {
    code: result.code,
    expiresAt: result.expiresAt,
    activatedAt: new Date().toISOString(),
    machineId
  }

  writeLocalActivation(localPath, payload)

  return {
    ok: true,
    code: payload.code,
    expiresAt: payload.expiresAt,
    activatedAt: payload.activatedAt,
    machineId
  }
}

function clearLocalActivation(localPath) {
  try {
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath)
    }
  } catch {
    void 0
  }

  return { ok: true }
}

module.exports = {
  clearLocalActivation,
  DEFAULT_DB_CONFIG,
  getActivationStatus,
  getMachineId,
  normalizeCode,
  redeemActivationCode
}
