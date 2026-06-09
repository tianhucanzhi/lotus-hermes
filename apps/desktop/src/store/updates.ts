/**
 * Desktop version display helpers.
 *
 * Self-update checks, toasts, and the updates overlay are intentionally
 * disabled for this fork — only the running app version is surfaced (About).
 */

import { atom } from 'nanostores'

import type {
  DesktopUpdateApplyOptions,
  DesktopUpdateApplyResult,
  DesktopUpdateProgress,
  DesktopUpdateStage,
  DesktopUpdateStatus,
  DesktopVersionInfo
} from '@/global'

export interface UpdateApplyState {
  applying: boolean
  stage: DesktopUpdateStage
  message: string
  percent: number | null
  error: string | null
  command: string | null
  log: readonly { stage: DesktopUpdateStage; message: string; at: number }[]
}

const IDLE: UpdateApplyState = {
  applying: false,
  stage: 'idle',
  message: '',
  percent: null,
  error: null,
  command: null,
  log: []
}

export const $desktopVersion = atom<DesktopVersionInfo | null>(null)
export const $updateApply = atom<UpdateApplyState>(IDLE)
export const $updateChecking = atom<boolean>(false)
export const $updateOverlayOpen = atom<boolean>(false)
export const $updateStatus = atom<DesktopUpdateStatus | null>(null)

export const setUpdateOverlayOpen = (_open: boolean) => undefined
export const resetUpdateApplyState = () => $updateApply.set(IDLE)

export function reportBackendContract(_contract: number | undefined): void {
  // Self-update UI disabled — no backend-skew toast.
}

export function maybeNotifyUpdateAvailable(_status: DesktopUpdateStatus | null): void {
  // Self-update UI disabled.
}

export function openUpdatesWindow(): void {
  // Self-update UI disabled.
}

export async function refreshDesktopVersion(): Promise<DesktopVersionInfo | null> {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const next = await window.hermesDesktop?.getVersion?.()

    if (next) {
      $desktopVersion.set(next)
    }

    return next ?? null
  } catch {
    return null
  }
}

export async function checkUpdates(): Promise<DesktopUpdateStatus | null> {
  return null
}

export async function applyUpdates(_opts: DesktopUpdateApplyOptions = {}): Promise<DesktopUpdateApplyResult> {
  return { ok: false, error: 'disabled', message: 'Desktop self-update is disabled.' }
}

export function startUpdatePoller(): void {
  void refreshDesktopVersion()
}

export function stopUpdatePoller(): void {
  // no-op
}

export function ingestUpdateProgress(_payload: DesktopUpdateProgress): void {
  // no-op
}
