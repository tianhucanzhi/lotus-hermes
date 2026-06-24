#!/usr/bin/env node
/**
 * Render apps/desktop/assets/lotus-icon.svg into platform icon assets.
 *
 * Usage (from apps/desktop):
 *   node scripts/generate-icons.cjs
 */

const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const ROOT = path.resolve(__dirname, '..')
const SVG_PATH = path.join(ROOT, 'assets', 'lotus-icon.svg')
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256, 512]

function fileExists(target) {
  try {
    fs.accessSync(target)
    return true
  } catch {
    return false
  }
}

function renderSvg(size, target) {
  execFileSync(
    'npx',
    ['--yes', '@resvg/resvg-js-cli', SVG_PATH, target, '--fit-width', String(size), '--fit-height', String(size)],
    { cwd: ROOT, stdio: 'inherit', shell: true }
  )
  const png = fs.readFileSync(target)
  if (!png.length) {
    throw new Error(`empty png at ${size}px`)
  }
  return png
}

function writeBinaryIfChanged(target, buffer) {
  if (fileExists(target)) {
    const existing = fs.readFileSync(target)
    if (existing.equals(buffer)) {
      console.log(`[generate-icons] unchanged ${path.relative(ROOT, target)}`)
      return
    }
  }
  fs.writeFileSync(target, buffer)
  console.log(`[generate-icons] wrote ${path.relative(ROOT, target)} (${buffer.length} bytes)`)
}

function writeIco(pngPaths, target) {
  const ico = execFileSync('npx', ['--yes', 'png-to-ico', ...pngPaths], {
    cwd: ROOT,
    shell: true,
    stdio: ['ignore', 'pipe', 'inherit']
  })
  writeBinaryIfChanged(target, ico)
}

function main() {
  if (!fileExists(SVG_PATH)) {
    throw new Error(`missing source svg: ${SVG_PATH}`)
  }

  const tmpDir = path.join(ROOT, 'assets', '.icon-tmp')
  fs.mkdirSync(tmpDir, { recursive: true })

  const masterPath = path.join(tmpDir, '1024.png')
  renderSvg(1024, masterPath)
  const master = fs.readFileSync(masterPath)
  writeBinaryIfChanged(path.join(ROOT, 'assets', 'icon.png'), master)

  const touchPath = path.join(tmpDir, '512.png')
  renderSvg(512, touchPath)
  const touch = fs.readFileSync(touchPath)
  writeBinaryIfChanged(path.join(ROOT, 'public', 'apple-touch-icon.png'), touch)

  const distDir = path.join(ROOT, 'dist')
  if (fileExists(distDir)) {
    writeBinaryIfChanged(path.join(distDir, 'apple-touch-icon.png'), touch)
  }

  const pngPaths = ICO_SIZES.map(size => {
    const target = path.join(tmpDir, `${size}.png`)
    renderSvg(size, target)
    return target
  })

  writeIco(pngPaths, path.join(ROOT, 'assets', 'icon.ico'))
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.rmSync(path.join(ROOT, 'assets', 'icon-test.png'), { force: true })

  console.log('[generate-icons] done')
}

try {
  main()
} catch (err) {
  console.error(`[generate-icons] ${err.message}`)
  process.exit(1)
}
