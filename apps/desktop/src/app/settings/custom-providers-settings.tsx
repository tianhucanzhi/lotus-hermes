import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getHermesConfigRecord, saveHermesConfig, setModelAssignment, validateProviderCredential } from '@/hermes'
import { useI18n } from '@/i18n'
import { Globe, Loader2, Plus, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { HermesConfigRecord } from '@/types/hermes'

import { CONTROL_TEXT, EMPTY_SELECT_VALUE } from './constants'
import { ListRow, LoadingState, SettingsContent } from './primitives'

export interface CustomProviderEntry {
  api_key?: string
  api_mode?: string
  base_url: string
  model?: string
  name: string
}

interface CustomProviderDraft {
  api_key: string
  api_mode: string
  base_url: string
  hadApiKey: boolean
  model: string
  name: string
}

const API_MODES = ['', 'chat_completions', 'codex_responses', 'anthropic_messages'] as const

function emptyDraft(): CustomProviderDraft {
  return { api_key: '', api_mode: '', base_url: '', hadApiKey: false, model: '', name: '' }
}

function normalizeEntry(raw: unknown): CustomProviderEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const name = String(record.name ?? '').trim()
  const base_url = String(record.base_url ?? record.url ?? record.api ?? '').trim()

  if (!name || !base_url) {
    return null
  }

  return {
    name,
    base_url,
    api_key: typeof record.api_key === 'string' && record.api_key.trim() ? record.api_key : undefined,
    model: typeof record.model === 'string' ? record.model.trim() : undefined,
    api_mode: typeof record.api_mode === 'string' ? record.api_mode.trim() : undefined
  }
}

function draftFromEntry(entry: CustomProviderEntry): CustomProviderDraft {
  return {
    name: entry.name,
    base_url: entry.base_url,
    api_key: '',
    hadApiKey: Boolean(entry.api_key),
    model: entry.model ?? '',
    api_mode: entry.api_mode ?? ''
  }
}

function providerSlug(name: string): string {
  let display = name.trim()

  for (const sep of ['—', ' - ']) {
    if (display.includes(sep)) {
      display = display.split(sep)[0].trim()
      break
    }
  }

  return `custom:${(display || name).trim().toLowerCase().replace(/\s+/g, '-')}`
}

function serializeDraft(draft: CustomProviderDraft): CustomProviderEntry {
  const entry: CustomProviderEntry = {
    name: draft.name.trim(),
    base_url: draft.base_url.trim().replace(/\/+$/, '')
  }

  const apiKey = draft.api_key.trim()

  if (apiKey) {
    entry.api_key = apiKey
  } else if (!draft.hadApiKey) {
    entry.api_key = undefined
  }

  const model = draft.model.trim()

  if (model) {
    entry.model = model
  }

  const apiMode = draft.api_mode.trim()

  if (apiMode) {
    entry.api_mode = apiMode
  }

  return entry
}

interface CustomProvidersSettingsProps {
  onConfigSaved?: () => void
  onMainModelChanged?: (provider: string, model: string) => void
}

export function CustomProvidersSettings({ onConfigSaved, onMainModelChanged }: CustomProvidersSettingsProps) {
  const { t } = useI18n()
  const c = t.settings.customProviders
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [entries, setEntries] = useState<CustomProviderEntry[]>([])
  const [configSnapshot, setConfigSnapshot] = useState<HermesConfigRecord | null>(null)
  const [editingIndex, setEditingIndex] = useState<null | number>(null)
  const [draft, setDraft] = useState<CustomProviderDraft>(emptyDraft)
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const config = await getHermesConfigRecord()
      const raw = config.custom_providers
      const parsed = Array.isArray(raw)
        ? raw.map(normalizeEntry).filter((entry): entry is CustomProviderEntry => entry !== null)
        : []

      setConfigSnapshot(config)
      setEntries(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isEditing = editingIndex !== null
  const editorTitle = editingIndex === -1 ? c.addTitle : c.editTitle

  const apiModeLabels = useMemo(
    () =>
      ({
        '': c.apiModeAuto,
        chat_completions: c.apiModeChat,
        codex_responses: c.apiModeCodex,
        anthropic_messages: c.apiModeAnthropic
      }) as Record<string, string>,
    [c.apiModeAnthropic, c.apiModeAuto, c.apiModeChat, c.apiModeCodex]
  )

  const beginAdd = () => {
    setEditingIndex(-1)
    setDraft(emptyDraft())
    setDiscoveredModels([])
    setError('')
  }

  const beginEdit = (index: number) => {
    setEditingIndex(index)
    setDraft(draftFromEntry(entries[index]))
    setDiscoveredModels([])
    setError('')
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setDraft(emptyDraft())
    setDiscoveredModels([])
    setError('')
  }

  const persistEntries = async (nextEntries: CustomProviderEntry[]) => {
    if (!configSnapshot) {
      return
    }

    setSaving(true)
    setError('')

    try {
      const nextConfig: HermesConfigRecord = {
        ...configSnapshot,
        custom_providers: nextEntries.map(entry => {
          const serialized: Record<string, string> = {
            name: entry.name,
            base_url: entry.base_url
          }

          if (entry.model) {
            serialized.model = entry.model
          }

          if (entry.api_mode) {
            serialized.api_mode = entry.api_mode
          }

          if (entry.api_key) {
            serialized.api_key = entry.api_key
          }

          return serialized
        })
      }

      await saveHermesConfig(nextConfig)
      setConfigSnapshot(nextConfig)
      setEntries(nextEntries)
      notify({ kind: 'success', message: c.saved })
      onConfigSaved?.()
      cancelEdit()
    } catch (err) {
      notifyError(err, c.saveFailed)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = async () => {
    if (!draft.name.trim() || !draft.base_url.trim()) {
      setError(c.requiredFields)
      return
    }

    const serialized = serializeDraft(draft)

    if (editingIndex === -1) {
      await persistEntries([...entries, serialized])
      return
    }

    if (editingIndex === null) {
      return
    }

    const next = [...entries]
    const previous = entries[editingIndex]

    next[editingIndex] = {
      ...serialized,
      api_key: serialized.api_key ?? previous.api_key
    }

    await persistEntries(next)
  }

  const removeEntry = async (index: number) => {
    const entry = entries[index]

    if (!window.confirm(c.deleteConfirm(entry.name))) {
      return
    }

    const next = entries.filter((_, i) => i !== index)
    await persistEntries(next)
  }

  const probeEndpoint = async () => {
    const url = draft.base_url.trim()

    if (!url) {
      setError(c.baseUrlRequired)
      return
    }

    setProbing(true)
    setError('')
    setDiscoveredModels([])

    try {
      const probe = await validateProviderCredential('OPENAI_BASE_URL', url)

      if (!probe.reachable) {
        setError(probe.message || c.probeUnreachable)
        return
      }

      const models = (probe.models ?? []).filter(Boolean)

      setDiscoveredModels(models)

      if (models.length > 0 && !draft.model.trim()) {
        setDraft(current => ({ ...current, model: models[0] }))
      }

      notify({ kind: 'success', message: models.length > 0 ? c.probeFound(models.length) : c.probeOk })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setProbing(false)
    }
  }

  const applyAsMain = async (entry: CustomProviderEntry) => {
    const model = entry.model?.trim()

    if (!model) {
      setError(c.modelRequiredForMain)
      return
    }

    setApplying(true)
    setError('')

    try {
      const result = await setModelAssignment({
        scope: 'main',
        provider: providerSlug(entry.name),
        model,
        base_url: entry.base_url
      })

      onMainModelChanged?.(result.provider || providerSlug(entry.name), result.model || model)
      notify({ kind: 'success', message: c.appliedMain(entry.name) })
    } catch (err) {
      notifyError(err, c.applyFailed)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return <LoadingState label={c.loading} />
  }

  return (
    <SettingsContent>
      <div className="grid gap-4">
        <div>
          <p className="text-xs leading-relaxed text-muted-foreground">{c.intro}</p>
        </div>

        {!isEditing && (
          <div className="flex justify-end">
            <Button onClick={beginAdd} size="sm" variant="textStrong">
              <Plus className="size-3.5" />
              {c.addButton}
            </Button>
          </div>
        )}

        {isEditing ? (
          <div className="grid gap-3 rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{editorTitle}</h3>
              <Button onClick={cancelEdit} size="sm" variant="text">
                {t.common.cancel}
              </Button>
            </div>

            <ListRow
              action={
                <Input
                  className={cn('min-w-56', CONTROL_TEXT)}
                  onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                  placeholder={c.namePlaceholder}
                  value={draft.name}
                />
              }
              title={c.nameLabel}
              wide
            />

            <ListRow
              action={
                <Input
                  className={cn('min-w-56 font-mono', CONTROL_TEXT)}
                  onChange={event => setDraft(current => ({ ...current, base_url: event.target.value }))}
                  placeholder="https://api.example.com/v1"
                  value={draft.base_url}
                />
              }
              description={c.baseUrlHint}
              title={c.baseUrlLabel}
              wide
            />

            <ListRow
              action={
                <Input
                  autoComplete="off"
                  className={cn('min-w-56 font-mono', CONTROL_TEXT)}
                  onChange={event => setDraft(current => ({ ...current, api_key: event.target.value }))}
                  placeholder={draft.hadApiKey ? c.apiKeyKeepPlaceholder : c.apiKeyPlaceholder}
                  type="password"
                  value={draft.api_key}
                />
              }
              description={c.apiKeyHint}
              title={c.apiKeyLabel}
              wide
            />

            <ListRow
              action={
                <div className="flex min-w-56 flex-1 flex-wrap items-center gap-2">
                  <Input
                    className={cn('min-w-40 flex-1 font-mono', CONTROL_TEXT)}
                    onChange={event => setDraft(current => ({ ...current, model: event.target.value }))}
                    placeholder={c.modelPlaceholder}
                    value={draft.model}
                  />
                  <Button disabled={probing || !draft.base_url.trim()} onClick={() => void probeEndpoint()} size="sm" variant="text">
                    {probing && <Loader2 className="size-3.5 animate-spin" />}
                    {c.probeButton}
                  </Button>
                </div>
              }
              description={c.modelHint}
              title={c.modelLabel}
              wide
            />

            {discoveredModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-1">
                {discoveredModels.slice(0, 8).map(model => (
                  <Button
                    key={model}
                    onClick={() => setDraft(current => ({ ...current, model }))}
                    size="sm"
                    variant={draft.model === model ? 'default' : 'outline'}
                  >
                    {model}
                  </Button>
                ))}
              </div>
            )}

            <ListRow
              action={
                <Select
                  onValueChange={value => setDraft(current => ({ ...current, api_mode: value === EMPTY_SELECT_VALUE ? '' : value }))}
                  value={draft.api_mode || EMPTY_SELECT_VALUE}
                >
                  <SelectTrigger className={CONTROL_TEXT}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_MODES.map(mode => (
                      <SelectItem key={mode || EMPTY_SELECT_VALUE} value={mode || EMPTY_SELECT_VALUE}>
                        {apiModeLabels[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              description={c.apiModeHint}
              title={c.apiModeLabel}
              wide
            />

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button disabled={saving} onClick={() => void saveDraft()} size="sm">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? c.saving : t.common.save}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {entries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-xs text-muted-foreground">
                {c.empty}
              </div>
            ) : (
              entries.map((entry, index) => (
                <div className="rounded-lg border border-border/50 bg-card/30 p-3" key={`${entry.name}-${entry.base_url}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Globe className="size-4 shrink-0 text-muted-foreground" />
                        <p className="truncate text-sm font-medium">{entry.name}</p>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{entry.base_url}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.model ? `${c.modelLabel}: ${entry.model}` : c.noModelSet}
                        {entry.api_key ? ` · ${c.apiKeySet}` : ''}
                        {entry.api_mode ? ` · ${entry.api_mode}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button disabled={applying || !entry.model} onClick={() => void applyAsMain(entry)} size="sm" variant="textStrong">
                        {c.useAsMain}
                      </Button>
                      <Button onClick={() => beginEdit(index)} size="sm" variant="text">
                        {t.common.change}
                      </Button>
                      <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => void removeEntry(index)}
                        size="sm"
                        variant="text"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!isEditing && error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </SettingsContent>
  )
}
