'use strict'

/**
 * Pack the desktop app to a directory electron-builder can always write.
 *
 * On Windows, IDEs (Cursor/VS Code) often keep a handle on
 * apps/desktop/release/win-unpacked/resources/app.asar while indexing the
 * workspace, which makes `electron-builder --dir` fail with EBUSY. Default the
 * pack output to %LOCALAPPDATA%/Lotus/desktop-pack instead.
 *
 * Override with HERMES_DESKTOP_PACK_OUTPUT (absolute path).
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const APP_ROOT = path.resolve(__dirname, '..')
const IN_TREE_RELEASE = path.join(APP_ROOT, 'release')

function resolvePackOutput() {
  const override = process.env.HERMES_DESKTOP_PACK_OUTPUT

  if (override && String(override).trim()) {
    return path.resolve(String(override).trim())
  }

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return path.join(local, 'Lotus', 'desktop-pack')
  }

  return IN_TREE_RELEASE
}

function isReleaseLocked(releaseDir) {
  const asar = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar')

  if (!fs.existsSync(asar)) {
    return false
  }

  const probe = `${asar}.pack-probe`

  try {
    fs.renameSync(asar, probe)
    fs.renameSync(probe, asar)
    return false
  } catch {
    return true
  }
}

function resolveUnlockedPackOutput(preferred) {
  if (process.platform !== 'win32' || !isReleaseLocked(preferred)) {
    return preferred
  }

  console.warn(
    `[pack-desktop] ${preferred} is locked by another process ` +
      '(close Lotus Desktop, then delete that folder if the lock persists).'
  )

  const parent = path.dirname(preferred)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const alternate = path.join(parent, `desktop-pack-${stamp}`)
  console.log(`[pack-desktop] using alternate output: ${alternate}`)

  return alternate
}

function main() {
  let output = resolvePackOutput()

  if (output === IN_TREE_RELEASE && process.platform === 'win32' && isReleaseLocked(output)) {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    output = path.join(local, 'Lotus', 'desktop-pack')
    console.log(`[pack-desktop] release/ is locked by another process; using ${output}`)
  }

  output = resolveUnlockedPackOutput(output)

  fs.mkdirSync(output, { recursive: true })
  console.log(`[pack-desktop] output directory: ${output}`)

  const args = [
    'cross-env',
    'NODE_OPTIONS=--max-old-space-size=16384',
    'electron-builder',
    '--dir',
    `--config.directories.output=${output}`
  ]

  const result = spawnSync('npx', args, {
    cwd: APP_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })

  process.exit(result.status ?? 1)
}

main()
