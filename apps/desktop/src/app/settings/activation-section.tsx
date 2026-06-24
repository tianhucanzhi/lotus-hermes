import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DesktopActivationError } from '@/global'
import { useI18n } from '@/i18n'
import { KeyRound, Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $activation, refreshActivation, submitActivationCode } from '@/store/activation'
import { notify } from '@/store/notifications'

import { ListRow, LoadingState, Pill, SectionHeading } from './primitives'

function formatDateTime(value?: string): string | null {
  if (!value) {
    return null
  }

  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) {
    return false
  }

  return new Date(expiresAt).getTime() <= Date.now()
}

export function ActivationSection() {
  const activation = useStore($activation)
  const { t } = useI18n()
  const copy = t.settings.about.activation
  const activationCopy = t.activation
  const [changing, setChanging] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<DesktopActivationError | 'network' | null>(null)
  const [submitDetail, setSubmitDetail] = useState<string | null>(null)

  useEffect(() => {
    void refreshActivation()
  }, [])

  if (!window.hermesDesktop?.activation) {
    return null
  }

  if (activation.skipped) {
    return null
  }

  if (activation.loading) {
    return <LoadingState label={copy.loading} />
  }

  const resolveError = (error?: DesktopActivationError | 'network' | null) => {
    if (!error || error === 'network') {
      return error === 'network' ? activationCopy.networkError : null
    }

    return activationCopy.errors[error]
  }

  const expiryLabel = formatDateTime(activation.expiresAt)
  const expired = isExpired(activation.expiresAt)
  const statusLabel = expired ? copy.statusExpired : activation.activated ? copy.statusActive : copy.statusInactive

  const handleSubmit = async () => {
    const trimmed = newCode.trim()

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
      return
    }

    notify({ kind: 'success', message: copy.changeSuccess })
    setChanging(false)
    setNewCode('')
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl">
      <SectionHeading icon={KeyRound} meta={statusLabel} title={copy.title} />

      <div className="rounded-xl border border-border/60 bg-card/40 px-4">
        <ListRow
          description={copy.currentCodeDesc}
          title={copy.currentCode}
          wide
          below={
            activation.code ? (
              <p className="mt-2 font-mono text-sm tracking-widest text-foreground">{activation.code}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{copy.notActivated}</p>
            )
          }
        />

        {expiryLabel ? (
          <>
            <div className="h-px bg-border/30" />
            <ListRow
              description={expired ? copy.expiredDesc : copy.expiresAtDesc}
              title={copy.expiresAt}
              wide
              below={
                <p className={cn('mt-2 text-sm', expired ? 'text-destructive' : 'text-foreground')}>{expiryLabel}</p>
              }
            />
          </>
        ) : null}

        {activation.offline ? (
          <>
            <div className="h-px bg-border/30" />
            <div className="py-3">
              <Pill tone="muted">{copy.offline}</Pill>
            </div>
          </>
        ) : null}

        <div className="h-px bg-border/30" />

        {changing ? (
          <div className="py-4">
            <p className="text-sm font-medium text-foreground">{copy.changePrompt}</p>
            <div className="relative mt-3">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoCapitalize="characters"
                autoComplete="off"
                className="pl-9 uppercase tracking-widest"
                disabled={submitting}
                onChange={event => setNewCode(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    void handleSubmit()
                  }
                }}
                placeholder={activationCopy.codePlaceholder}
                spellCheck={false}
                value={newCode}
              />
            </div>

            {resolveError(submitError) ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-destructive">{resolveError(submitError)}</p>
                {submitDetail ? <p className="text-xs text-destructive/80">{submitDetail}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{activationCopy.hint}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button disabled={submitting || !newCode.trim()} onClick={() => void handleSubmit()} size="sm">
                {submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {copy.changing}
                  </>
                ) : (
                  copy.save
                )}
              </Button>
              <Button
                disabled={submitting}
                onClick={() => {
                  setChanging(false)
                  setNewCode('')
                  setSubmitError(null)
                  setSubmitDetail(null)
                }}
                size="sm"
                variant="text"
              >
                {copy.cancel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end py-3">
            <Button
              onClick={() => {
                setChanging(true)
                setSubmitError(null)
                setSubmitDetail(null)
              }}
              size="sm"
              variant="outline"
            >
              {copy.change}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
