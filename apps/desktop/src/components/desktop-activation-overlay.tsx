import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { LotusLogo } from '@/components/lotus-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader } from '@/components/ui/loader'
import type { DesktopActivationError } from '@/global'
import { useI18n } from '@/i18n'
import { KeyRound, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activation, refreshActivation, submitActivationCode } from '@/store/activation'

function formatExpiry(value?: string): string | null {
  if (!value) {
    return null
  }

  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export function DesktopActivationOverlay() {
  const activation = useStore($activation)
  const { t } = useI18n()
  const copy = t.activation
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<DesktopActivationError | 'network' | null>(null)
  const [submitDetail, setSubmitDetail] = useState<string | null>(null)

  useEffect(() => {
    void refreshActivation()
  }, [])

  const visible = !activation.loading && !activation.activated

  if (!visible && activation.loading) {
    return (
      <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-(--ui-chat-surface-background)">
        <Loader className="size-8" />
      </div>
    )
  }

  if (!visible) {
    return null
  }

  const resolveError = (error?: DesktopActivationError | 'network' | null) => {
    if (!error || error === 'network') {
      return error === 'network' ? copy.networkError : null
    }

    return copy.errors[error]
  }

  const errorMessage = resolveError(submitError) || resolveError(activation.reason)

  const handleSubmit = async () => {
    const trimmed = code.trim()

    if (!trimmed) {
      setSubmitError('invalid_code')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    setSubmitDetail(null)

    const result = await submitActivationCode(trimmed)

    setSubmitting(false)

    if (!result.ok) {
      setSubmitError(result.error || 'network')
      setSubmitDetail(result.message || null)
    }
  }

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-(--ui-chat-surface-background) p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card p-8 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <LotusLogo className="mb-4 size-20" />
          <h1 className="text-xl font-semibold tracking-wide text-foreground">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
        </div>

        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-foreground" htmlFor="activation-code">
            {copy.codeLabel}
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoCapitalize="characters"
              autoComplete="off"
              className="pl-9 uppercase tracking-widest"
              disabled={submitting}
              id="activation-code"
              onChange={event => setCode(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  void handleSubmit()
                }
              }}
              placeholder={copy.codePlaceholder}
              spellCheck={false}
              value={code}
            />
          </div>

          {errorMessage ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{errorMessage}</p>
              {submitDetail ? <p className="text-xs text-destructive/80">{submitDetail}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{copy.hint}</p>
          )}

          <Button
            className={cn('w-full')}
            disabled={submitting || !code.trim()}
            onClick={() => void handleSubmit()}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {copy.activating}
              </>
            ) : (
              copy.activate
            )}
          </Button>

          {activation.expiresAt ? (
            <p className="text-center text-xs text-muted-foreground">
              {copy.expiresAt(formatExpiry(activation.expiresAt) || '')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
