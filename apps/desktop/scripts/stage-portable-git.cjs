'use strict'

/**
 * Download PortableGit / MinGit archives at desktop pack time so first-launch
 * bootstrap can extract Git locally instead of hitting github.com.
 *
 * Cached under apps/desktop/build/bundled-git/ and shipped via extraResources.
 */

const fs = require('node:fs')
const https = require('node:https')
const path = require('node:path')

const DESKTOP_ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(DESKTOP_ROOT, 'build', 'bundled-git')

// Keep in sync with scripts/install.ps1 Install-Git pinned release.
const GIT_TAG = 'v2.54.0.windows.1'
const ASSETS = [
  'PortableGit-2.54.0-64-bit.7z.exe',
  'PortableGit-2.54.0-arm64.7z.exe',
  'MinGit-2.54.0-32-bit.zip'
]

function followRedirects(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            res.resume()
            reject(new Error(`too many redirects for ${url}`))
            return
          }
          res.resume()
          resolve(followRedirects(res.headers.location, redirectsLeft - 1))
          return
        }

        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }

        resolve(res)
      })
      .on('error', reject)
  })
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = `${dest}.tmp`
    fs.mkdirSync(path.dirname(dest), { recursive: true })

    followRedirects(url)
      .then(response => {
        const file = fs.createWriteStream(tmp)
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          fs.renameSync(tmp, dest)
          resolve(dest)
        })
        file.on('error', err => {
          fs.unlink(tmp, () => {})
          reject(err)
        })
        response.on('error', err => {
          fs.unlink(tmp, () => {})
          reject(err)
        })
      })
      .catch(reject)
  })
}

async function stageOne(assetName) {
  const dest = path.join(OUT_DIR, assetName)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1)
    console.log(`[stage-portable-git] cached ${assetName} (${sizeMb} MB)`)
    return
  }

  const url = `https://github.com/git-for-windows/git/releases/download/${GIT_TAG}/${assetName}`
  console.log(`[stage-portable-git] downloading ${assetName} ...`)
  await downloadFile(url, dest)
  const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1)
  console.log(`[stage-portable-git] wrote ${path.relative(DESKTOP_ROOT, dest)} (${sizeMb} MB)`)
}

async function main() {
  if (process.env.HERMES_DESKTOP_SKIP_BUNDLED_GIT === '1') {
    console.log('[stage-portable-git] skipped (HERMES_DESKTOP_SKIP_BUNDLED_GIT=1)')
    return
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  for (const asset of ASSETS) {
    await stageOne(asset)
  }
  console.log('[stage-portable-git] done')
}

main().catch(err => {
  console.error(`[stage-portable-git] ${err.message}`)
  process.exit(1)
})
