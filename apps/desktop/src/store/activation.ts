import { atom } from 'nanostores'

import type { DesktopActivationError, DesktopActivationStatus } from '@/global'

export interface ActivationState {
  loading: boolean
  activated: boolean
  skipped?: boolean
  code?: string
  expiresAt?: string
  activatedAt?: string
  offline?: boolean
  reason?: DesktopActivationError
  error?: string
}

export const $activation = atom<ActivationState>({
  loading: true,
  activated: false
})

function applyStatus(status: DesktopActivationStatus | null | undefined): void {
  if (!status) {
    $activation.set({ loading: false, activated: false, error: 'unavailable' })
    return
  }

  $activation.set({
    loading: false,
    activated: Boolean(status.activated),
    skipped: status.skipped,
    code: status.code,
    expiresAt: status.expiresAt,
    activatedAt: status.activatedAt,
    offline: status.offline,
    reason: status.reason
  })
}

export async function refreshActivation(): Promise<void> {
  $activation.set({ ...$activation.get(), loading: true, error: undefined })

  try {
    const status = await window.hermesDesktop?.activation?.getStatus?.()
    applyStatus(status)
  } catch (error) {
    $activation.set({
      loading: false,
      activated: false,
      error: error instanceof Error ? error.message : 'network'
    })
  }
}

export async function submitActivationCode(
  code: string
): Promise<{ ok: boolean; error?: DesktopActivationError; message?: string }> {
  try {
    const result = await window.hermesDesktop?.activation?.redeem?.(code)

    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error,
        message: result?.message
      }
    }

    $activation.set({
      loading: false,
      activated: true,
      code: result.code,
      expiresAt: result.expiresAt,
      activatedAt: result.activatedAt
    })

    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}
