import { useCallback, useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageLoader } from '@/components/page-loader'
import { LogView } from '@/components/ui/log-view'
import { SearchField } from '@/components/ui/search-field'
import {
  getActionStatus,
  getSkillHubSources,
  installSkillFromHub,
  previewSkillFromHub,
  scanSkillFromHub,
  searchSkillsHub,
  updateSkillsFromHub
} from '@/hermes'
import { useI18n } from '@/i18n'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  X
} from '@/lib/icons'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { SkillHubInstalledEntry, SkillHubPreview, SkillHubResult, SkillHubScan, SkillHubSource } from '@/types/hermes'

import { PAGE_INSET_X } from '../layout-constants'

interface HubLabels {
  actionDone: string
  actionRunning: string
  actionStarting: string
  connectedHubs: string
  connecting: string
  detailDescription: (name: string) => string
  details: string
  dismiss: string
  emptyLanding: string
  featuredHint: string
  featuredTitle: string
  files: string
  install: string
  installCompleteMessage: string
  installCompleteTitle: string
  installFailed: string
  installStarting: (identifier: string) => string
  installed: string
  loading: string
  loadingPreview: string
  noFindings: string
  noResults: string
  openSkill: (name: string) => string
  policyBlock: string
  previewEmpty: string
  previewFailed: string
  previewLoadFailed: string
  readSkillMd: string
  rescan: string
  scanFailed: string
  scanPrompt: string
  scanning: string
  search: string
  searchFailed: string
  searchMeta: (count: number, ms: number | null) => string
  searchPlaceholder: string
  searching: string
  securityScan: string
  sourcesFallback: string
  timedOut: (sources: string) => string
  trust: { builtin: string; community: string; trusted: string; unknown: string }
  updateAll: string
  updateFailed: string
  updateStarting: string
  verdict: (value: string) => string
}

interface SkillsHubPanelProps {
  onInstalled?: () => void
}

function trustBadgeVariant(level: string): 'default' | 'muted' | 'outline' | 'warn' {
  switch (level) {
    case 'trusted':
      return 'default'
    case 'builtin':
      return 'muted'
    case 'community':
      return 'warn'
    default:
      return 'outline'
  }
}

function trustLabel(level: string, labels: { trusted: string; builtin: string; community: string; unknown: string }) {
  switch (level) {
    case 'trusted':
      return labels.trusted
    case 'builtin':
      return labels.builtin
    case 'community':
      return labels.community
    default:
      return level || labels.unknown
  }
}

export function SkillsHubPanel({ onInstalled }: SkillsHubPanelProps) {
  const { t } = useI18n()
  const h = t.skills.hub

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SkillHubResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({})
  const [timedOut, setTimedOut] = useState<string[]>([])
  const [searchMs, setSearchMs] = useState<number | null>(null)

  const [sources, setSources] = useState<SkillHubSource[]>([])
  const [featured, setFeatured] = useState<SkillHubResult[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [installed, setInstalled] = useState<Record<string, SkillHubInstalledEntry>>({})

  const [action, setAction] = useState<string | null>(null)
  const [actionLog, setActionLog] = useState<string[]>([])
  const [actionRunning, setActionRunning] = useState(false)

  const [detail, setDetail] = useState<SkillHubResult | null>(null)

  const refreshSources = useCallback(async () => {
    try {
      const response = await getSkillHubSources()
      setSources(response.sources)
      setFeatured(response.featured)
      setInstalled(response.installed)
    } catch {
      /* landing stays minimal on failure */
    } finally {
      setSourcesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSources()
  }, [refreshSources])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) {
      return
    }

    setSearching(true)
    setSearched(true)
    const started = performance.now()

    try {
      const response = await searchSkillsHub(q)
      setResults(response.results)
      setSourceCounts(response.source_counts || {})
      setTimedOut(response.timed_out || [])
      setInstalled(prev => ({ ...prev, ...(response.installed || {}) }))
    } catch (err) {
      notifyError(err, h.searchFailed)
      setResults([])
      setSourceCounts({})
      setTimedOut([])
    } finally {
      setSearchMs(Math.round(performance.now() - started))
      setSearching(false)
    }
  }, [h.searchFailed, query])

  useEffect(() => {
    if (!action) {
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const status = await getActionStatus(action, 200)
        if (cancelled) {
          return
        }

        setActionLog(status.lines)
        setActionRunning(status.running)

        if (status.running) {
          timer = setTimeout(poll, 1200)
        } else {
          void refreshSources()
          onInstalled?.()
          if (status.exit_code === 0) {
            notify({ kind: 'success', title: h.installCompleteTitle, message: h.installCompleteMessage })
          }
        }
      } catch {
        if (!cancelled) {
          setActionRunning(false)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [action, h.installCompleteMessage, h.installCompleteTitle, onInstalled, refreshSources])

  const install = useCallback(
    async (identifier: string) => {
      try {
        const response = await installSkillFromHub(identifier)
        notify({ kind: 'info', title: h.installStarting(identifier), message: '' })
        setActionLog([])
        setActionRunning(true)
        setAction(response.name)
        setDetail(null)
      } catch (err) {
        notifyError(err, h.installFailed)
      }
    },
    [h.installFailed, h.installStarting]
  )

  const updateAll = useCallback(async () => {
    try {
      const response = await updateSkillsFromHub()
      notify({ kind: 'info', title: h.updateStarting, message: '' })
      setActionLog([])
      setActionRunning(true)
      setAction(response.name)
    } catch (err) {
      notifyError(err, h.updateFailed)
    }
  }, [h.updateFailed, h.updateStarting])

  const isInstalled = useCallback((identifier: string) => Boolean(installed[identifier]), [installed])
  const showLanding = !searched && !searching

  return (
    <div className={cn('h-full overflow-y-auto py-3', PAGE_INSET_X)}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            containerClassName="min-w-[12rem] flex-1"
            onChange={setQuery}
            onClear={() => {
              setQuery('')
              setSearched(false)
              setResults([])
            }}
            placeholder={h.searchPlaceholder}
            value={query}
          />
          <Button disabled={searching || !query.trim()} onClick={() => void runSearch()} size="sm" type="button">
            {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
            {h.search}
          </Button>
          <Button onClick={() => void updateAll()} size="sm" type="button" variant="outline">
            <RefreshCw className="size-3.5" />
            {h.updateAll}
          </Button>
        </div>

        <ConnectedHubs labels={h} loading={sourcesLoading} sources={sources} />

        {action ? (
          <div className="rounded-lg border border-(--ui-stroke-tertiary) px-3 py-2.5">
            <div className="mb-2 flex items-center gap-2">
              <Download className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-xs">{action}</span>
              <Badge variant={actionRunning ? 'warn' : 'default'}>{actionRunning ? h.actionRunning : h.actionDone}</Badge>
              {!actionRunning ? (
                <Button
                  aria-label={h.dismiss}
                  className="ml-auto text-muted-foreground"
                  onClick={() => setAction(null)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <LogView className="max-h-48">{actionLog.length ? actionLog.join('\n') : h.actionStarting}</LogView>
          </div>
        ) : null}

        {showLanding ? (
          sourcesLoading ? (
            <PageLoader className="min-h-48" label={h.loading} />
          ) : featured.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 px-0.5">
                <Sparkles className="size-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {h.featuredTitle}
                </span>
                <span className="text-xs text-muted-foreground">{h.featuredHint}</span>
              </div>
              {featured.map(result => (
                <HubResultCard
                  installed={isInstalled(result.identifier)}
                  key={result.identifier}
                  labels={h}
                  onInstall={() => void install(result.identifier)}
                  onOpen={() => setDetail(result)}
                  result={result}
                />
              ))}
            </div>
          ) : (
            <EmptyHint text={h.emptyLanding} />
          )
        ) : null}

        {searching ? <PageLoader className="min-h-40" label={h.searching} /> : null}

        {!searching && searched ? (
          <>
            <SearchMeta
              count={results.length}
              labels={h}
              ms={searchMs}
              sourceCounts={sourceCounts}
              timedOut={timedOut}
            />
            {results.length === 0 ? (
              <EmptyHint text={h.noResults} />
            ) : (
              results.map(result => (
                <HubResultCard
                  installed={isInstalled(result.identifier)}
                  key={result.identifier}
                  labels={h}
                  onInstall={() => void install(result.identifier)}
                  onOpen={() => setDetail(result)}
                  result={result}
                />
              ))
            )}
          </>
        ) : null}
      </div>

      {detail ? (
        <SkillDetailDialog
          installed={isInstalled(detail.identifier)}
          labels={h}
          onClose={() => setDetail(null)}
          onInstall={() => void install(detail.identifier)}
          result={detail}
        />
      ) : null}
    </div>
  )
}

function ConnectedHubs({
  labels,
  loading,
  sources
}: {
  labels: HubLabels
  loading: boolean
  sources: SkillHubSource[]
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground">{labels.connecting}</p>
  }

  if (sources.length === 0) {
    return <p className="text-xs text-muted-foreground">{labels.sourcesFallback}</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Globe className="size-3" />
        {labels.connectedHubs}
      </span>
      {sources.map(source => (
        <Badge key={source.id} variant={source.rate_limited === true ? 'warn' : 'outline'}>
          {source.label}
        </Badge>
      ))}
    </div>
  )
}

function SearchMeta({
  count,
  labels,
  ms,
  sourceCounts,
  timedOut
}: {
  count: number
  labels: HubLabels
  ms: number | null
  sourceCounts: Record<string, number>
  timedOut: string[]
}) {
  const breakdown = Object.entries(sourceCounts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')

  return (
    <div className="flex flex-wrap items-center gap-2 px-0.5 text-xs text-muted-foreground">
      <span>{labels.searchMeta(count, ms)}</span>
      {breakdown ? <span>{breakdown}</span> : null}
      {timedOut.length > 0 ? (
        <span className="flex items-center gap-1 text-amber-500">
          <AlertTriangle className="size-3" />
          {labels.timedOut(timedOut.join(', '))}
        </span>
      ) : null}
    </div>
  )
}

function HubResultCard({
  installed,
  labels,
  onInstall,
  onOpen,
  result
}: {
  installed: boolean
  labels: HubLabels
  onInstall: () => void
  onOpen: () => void
  result: SkillHubResult
}) {
  return (
    <div className="grid gap-3 border-b border-(--ui-stroke-tertiary) py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <button
        aria-label={labels.openSkill(result.name)}
        className="min-w-0 text-left"
        onClick={onOpen}
        type="button"
      >
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{result.name}</span>
          <Badge variant={trustBadgeVariant(result.trust_level)}>
            {trustLabel(result.trust_level, labels.trust)}
          </Badge>
          <Badge variant="outline">{result.source}</Badge>
          {installed ? <Badge variant="default">{labels.installed}</Badge> : null}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{result.description}</p>
        {result.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {result.tags.slice(0, 5).map(tag => (
              <span
                className="rounded-md bg-(--ui-bg-quinary) px-1.5 py-0.5 font-mono text-[0.65rem] text-(--ui-text-tertiary)"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-1 truncate font-mono text-[0.65rem] text-(--ui-text-tertiary)">{result.identifier}</p>
      </button>
      <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
        <Button onClick={onOpen} size="sm" type="button" variant="outline">
          <FileText className="size-3.5" />
          {labels.details}
        </Button>
        {installed ? (
          <Button disabled size="sm" type="button" variant="ghost">
            <CheckCircle2 className="size-3.5" />
            {labels.installed}
          </Button>
        ) : (
          <Button onClick={onInstall} size="sm" type="button">
            <Download className="size-3.5" />
            {labels.install}
          </Button>
        )}
      </div>
    </div>
  )
}

function SkillDetailDialog({
  installed,
  labels,
  onClose,
  onInstall,
  result
}: {
  installed: boolean
  labels: HubLabels
  onClose: () => void
  onInstall: () => void
  result: SkillHubResult
}) {
  const [tab, setTab] = useState<'readme' | 'scan'>('readme')
  const [preview, setPreview] = useState<SkillHubPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [scan, setScan] = useState<SkillHubScan | null>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)

    void previewSkillFromHub(result.identifier)
      .then(p => {
        if (!cancelled) {
          setPreview(p)
        }
      })
      .catch(err => notifyError(err, labels.previewFailed))
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [labels.previewFailed, result.identifier])

  const runScan = useCallback(async () => {
    setScanning(true)
    setTab('scan')

    try {
      const response = await scanSkillFromHub(result.identifier)
      setScan(response)
    } catch (err) {
      notifyError(err, labels.scanFailed)
    } finally {
      setScanning(false)
    }
  }, [labels.scanFailed, result.identifier])

  return (
    <Dialog onOpenChange={open => !open && onClose()} open>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Package className="size-4" />
            {result.name}
            <Badge variant={trustBadgeVariant(result.trust_level)}>
              {trustLabel(result.trust_level, labels.trust)}
            </Badge>
            <Badge variant="outline">{result.source}</Badge>
            {installed ? <Badge variant="default">{labels.installed}</Badge> : null}
          </DialogTitle>
          <DialogDescription className="sr-only">{labels.detailDescription(result.name)}</DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">{result.description}</p>
        <p className="truncate font-mono text-[0.65rem] text-(--ui-text-tertiary)">{result.identifier}</p>

        <div className="flex flex-wrap items-center gap-2 border-y border-(--ui-stroke-tertiary) py-2.5">
          <Button onClick={() => setTab('readme')} size="sm" type="button" variant={tab === 'readme' ? 'default' : 'outline'}>
            <FileText className="size-3.5" />
            {labels.readSkillMd}
          </Button>
          <Button disabled={scanning} onClick={() => void runScan()} size="sm" type="button" variant={tab === 'scan' ? 'default' : 'outline'}>
            {scanning ? <Loader2 className="size-3.5 animate-spin" /> : <AlertTriangle className="size-3.5" />}
            {scan ? labels.rescan : labels.securityScan}
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {result.repo ? (
              <a
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                href={`https://github.com/${result.repo}`}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink className="size-3.5" />
                {result.repo}
              </a>
            ) : null}
            {installed ? (
              <Button disabled size="sm" type="button" variant="ghost">
                <CheckCircle2 className="size-3.5" />
                {labels.installed}
              </Button>
            ) : (
              <Button onClick={onInstall} size="sm" type="button">
                <Download className="size-3.5" />
                {labels.install}
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[55vh] overflow-auto">
          {tab === 'readme' ? (
            previewLoading ? (
              <PageLoader className="min-h-40" label={labels.loadingPreview} />
            ) : preview ? (
              <div className="space-y-2">
                {preview.files.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{labels.files}: </span>
                    <span className="font-mono">{preview.files.join('  ')}</span>
                  </p>
                ) : null}
                <LogView className="max-h-[50vh] text-xs leading-relaxed text-(--ui-text-secondary)">
                  {(preview.skill_md || '').trim() || labels.previewEmpty}
                </LogView>
              </div>
            ) : (
              <EmptyHint text={labels.previewLoadFailed} />
            )
          ) : (
            <ScanPanel labels={labels} scan={scan} scanning={scanning} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScanPanel({
  labels,
  scan,
  scanning
}: {
  labels: HubLabels
  scan: SkillHubScan | null
  scanning: boolean
}) {
  if (scanning && !scan) {
    return <PageLoader className="min-h-40" label={labels.scanning} />
  }

  if (!scan) {
    return <EmptyHint text={labels.scanPrompt} />
  }

  const verdictVariant =
    scan.verdict === 'safe' ? 'default' : scan.verdict === 'dangerous' ? 'destructive' : 'warn'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={verdictVariant}>{labels.verdict(scan.verdict)}</Badge>
        {scan.policy === 'block' ? <Badge variant="destructive">{labels.policyBlock}</Badge> : null}
      </div>
      <p className="text-xs text-muted-foreground">{scan.summary}</p>
      {scan.policy_reason ? <p className="text-xs text-muted-foreground">{scan.policy_reason}</p> : null}
      {scan.findings.length > 0 ? (
        <div className="space-y-2">
          {scan.findings.map((finding, index) => (
            <div className="rounded-md border border-(--ui-stroke-tertiary) px-2.5 py-2 text-xs" key={`${finding.file}:${finding.line}:${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={finding.severity === 'critical' || finding.severity === 'high' ? 'destructive' : 'warn'}>
                  {finding.severity}
                </Badge>
                <span className="font-mono text-[0.65rem] text-muted-foreground">
                  {finding.file}:{finding.line}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{finding.description}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{labels.noFindings}</p>
      )}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
