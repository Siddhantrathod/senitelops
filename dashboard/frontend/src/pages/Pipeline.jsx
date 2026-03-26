import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GitBranch,
  GitCommit,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Settings,
  Rocket,
  Shield,
  User,
  Calendar,
  Terminal,
  Box,
  FileCode,
  Container,
  Scale,
  Gauge,
  Info,
  Timer,
  Layers,
  Activity,
  Search,
  Filter,
  ArrowLeft,
  ChevronUp,
  Zap,
  Eye,
  Hash,
  KeyRound,
  Globe,
  Save,
} from 'lucide-react'
import { fetchPipelines, triggerPipeline, fetchSetupStatus } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import { getAutoRefreshInterval } from '../utils/appearance'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { fetchProfile, updateProfile } from './settings/services/settingsApi'
import { Notyf } from 'notyf'

const notyf = new Notyf({ duration: 4500, position: { x: 'right', y: 'bottom' } })

/* =========================================================================
   CONFIG / CONSTANTS
   ========================================================================= */

const statusConfig = {
  queued: { color: 'bg-steel-600', accent: 'border-l-steel-400', glow: '', label: 'Queued', icon: Clock },
  running: { color: 'bg-emerald-500', accent: 'border-l-emerald-500', glow: 'shadow-glow-sm', label: 'Running', icon: Loader2, animate: true },
  success: { color: 'bg-lime-500', accent: 'border-l-lime-500', glow: '', label: 'Success', icon: CheckCircle },
  failed: { color: 'bg-red-500', accent: 'border-l-red-500', glow: 'shadow-[0_0_15px_rgba(255,59,92,0.15)]', label: 'Failed', icon: XCircle },
  cancelled: { color: 'bg-amber-500', accent: 'border-l-amber-500', glow: '', label: 'Cancelled', icon: AlertTriangle },
}

const stageIcons = {
  clone: GitBranch,
  build: Box,
  sast_scan: FileCode,
  bandit_scan: FileCode,
  gitleaks_scan: KeyRound,
  trivy_scan: Container,
  dast_scan: Globe,
  policy_check: Scale,
  decision: Gauge,
}

const stageDisplayNames = {
  clone: 'Clone Repo',
  build: 'Build Image',
  sast_scan: 'SAST Scan',
  bandit_scan: 'SAST Scan',
  gitleaks_scan: 'Secret Scan',
  trivy_scan: 'Trivy Scan',
  dast_scan: 'DAST Scan',
  policy_check: 'Policy Check',
  decision: 'Decision',
}

const stageColors = {
  pending: { bg: 'bg-white/[0.03]', border: 'border-white/[0.06]', text: 'text-steel-500', dot: 'bg-steel-600' },
  running: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  success: { bg: 'bg-lime-500/5', border: 'border-lime-500/20', text: 'text-lime-400', dot: 'bg-lime-500' },
  failed: { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
  skipped: { bg: 'bg-white/[0.02]', border: 'border-white/[0.04]', text: 'text-steel-600', dot: 'bg-steel-700' },
}

const STAGE_ORDER = ['clone', 'build', 'sast_scan', 'gitleaks_scan', 'trivy_scan', 'dast_scan', 'policy_check', 'decision']

const resolveStageKey = (key, stages) =>
  key === 'sast_scan' && !stages[key] && stages['bandit_scan'] ? 'bandit_scan' : key

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'success', label: 'Passed' },
  { key: 'failed', label: 'Failed' },
]

/* =========================================================================
   HELPERS
   ========================================================================= */

function formatDuration(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

function buildStageLogText(stage) {
  if (!stage) return 'No stage data available.'
  const lines = []
  lines.push(`Status: ${(stage.status || 'pending').toUpperCase()}`)
  lines.push(`Started: ${formatTimestamp(stage.started_at)}`)
  lines.push(`Finished: ${formatTimestamp(stage.finished_at)}`)
  lines.push(`Duration: ${formatDuration(stage.duration_seconds)}`)
  if (stage.logs) lines.push('', stage.logs)
  if (stage.error) lines.push('', `Error: ${stage.error}`)
  return lines.join('\n')
}

/* =========================================================================
   STATUS BADGE
   ========================================================================= */

function StatusBadge({ status, size = 'md' }) {
  const cfg = statusConfig[status] || statusConfig.queued
  const Icon = cfg.icon
  const sz = size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-1' : 'px-3 py-1 text-xs gap-1.5'
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-bold text-white uppercase tracking-wider',
      cfg.color, sz
    )}>
      <Icon className={cn('w-3 h-3', cfg.animate && 'animate-spin')} />
      {cfg.label}
    </span>
  )
}

/* =========================================================================
   ANIMATED CIRCULAR SCORE GAUGE
   ========================================================================= */

function ScoreGauge({ score, size = 120 }) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (animatedScore / 100) * circumference

  useEffect(() => {
    let frame
    const start = performance.now()
    const duration = 1200
    const animate = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setAnimatedScore(Math.round(score * eased))
      if (t < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [score])

  const color = score >= 70 ? '#5ce60a' : score >= 40 ? '#ffb800' : '#ff3b5c'
  const bgColor = score >= 70 ? 'rgba(92,230,10,0.08)' : score >= 40 ? 'rgba(255,184,0,0.08)' : 'rgba(255,59,92,0.08)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-200"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black font-mono" style={{ color }}>
          {animatedScore}
        </span>
        <span className="text-[9px] font-bold text-steel-500 uppercase tracking-[0.15em] mt-0.5">Score</span>
      </div>
    </div>
  )
}

/* =========================================================================
   PIPELINE STEPPER (horizontal)
   ========================================================================= */

function PipelineStepper({ stages, onStageClick }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 py-1">
      {STAGE_ORDER.map((key) => {
        const rk = resolveStageKey(key, stages)
        const stage = stages[rk] || { name: key, status: 'pending' }
        const sc = stageColors[stage.status] || stageColors.pending
        const Icon = stageIcons[rk] || stageIcons[key] || Shield

        return (
          <div
            key={key}
            className={cn(
              'rounded-xl border px-2 py-2 transition-all',
              sc.bg,
              sc.border,
              stage.status === 'running' && 'ring-1 ring-emerald-500/30',
              stage.status === 'failed' && 'ring-1 ring-red-500/30'
            )}
          >
            <button
              onClick={() => onStageClick?.(rk)}
              className="w-full flex items-center gap-2 text-left group cursor-pointer"
            >
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 flex-shrink-0',
                sc.bg, sc.border,
                stage.status === 'running' && 'ring-2 ring-emerald-500/40 shadow-glow-sm',
                stage.status === 'success' && 'border-lime-500/40',
                stage.status === 'failed' && 'border-red-500/40',
              )}>
                {stage.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : stage.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-lime-400" />
                ) : stage.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Icon className={cn('w-4 h-4', sc.text)} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn('block text-[10px] font-semibold leading-tight truncate', sc.text)}>
                  {stageDisplayNames[rk] || stageDisplayNames[key] || (stage.name || key).replace(/_/g, ' ')}
                </span>
                {stage.duration_seconds && (
                  <span className="block text-[9px] font-mono text-steel-600">{formatDuration(stage.duration_seconds)}</span>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}

function StageLogRail({ stages }) {
  const [hoveredKey, setHoveredKey] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)

  const resolvedStages = STAGE_ORDER.map((key) => {
    const rk = resolveStageKey(key, stages)
    return {
      key: rk,
      data: stages?.[rk] || { name: stageDisplayNames[key] || key, status: 'pending' },
    }
  })

  const activeKey = hoveredKey || selectedKey
  const activeStage = activeKey ? resolvedStages.find((s) => s.key === activeKey) : null

  const handleSelect = (stageKey) => {
    setSelectedKey((prev) => (prev === stageKey ? null : stageKey))
  }

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        setHoveredKey(null)
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {resolvedStages.map(({ key, data }) => {
          const sc = stageColors[data.status] || stageColors.pending
          const Icon = stageIcons[key] || Shield
          const isActive = activeKey === key
          return (
            <button
              key={key}
              onMouseEnter={() => setHoveredKey(key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => handleSelect(key)}
              className={cn(
                'rounded-xl border p-2 text-left transition-all bg-white/[0.01] border-white/[0.08]',
                isActive && 'ring-1 ring-emerald-500/25',
                'hover:bg-white/[0.03]'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    'w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0',
                    sc.bg,
                    sc.border
                  )}>
                    {data.status === 'running' ? (
                      <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                    ) : data.status === 'success' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-lime-400" />
                    ) : data.status === 'failed' ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Icon className={cn('w-3.5 h-3.5', sc.text)} />
                    )}
                  </span>
                  <span className="text-[10px] font-semibold text-steel-100 truncate">
                    {stageDisplayNames[key] || (data.name || key).replace(/_/g, ' ')}
                  </span>
                </div>
                <span className={cn(
                  'text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold',
                  data.status === 'success' && 'bg-lime-500/10 text-lime-400 border-lime-500/20',
                  data.status === 'failed' && 'bg-red-500/10 text-red-400 border-red-500/20',
                  data.status === 'running' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  data.status === 'pending' && 'bg-white/[0.02] text-steel-500 border-white/[0.06]',
                  data.status === 'skipped' && 'bg-white/[0.02] text-steel-500 border-white/[0.06]'
                )}>
                  {data.status}
                </span>
              </div>

              <div className="mt-1 text-[9px] text-steel-600 font-mono">
                {data.duration_seconds ? formatDuration(data.duration_seconds) : formatTimestamp(data.started_at)}
              </div>
            </button>
          )
        })}
      </div>

      {activeStage && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-[min(760px,95vw)] rounded-xl bg-surface-code border border-white/[0.16] p-3 shadow-card-hover">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-steel-200">
              {stageDisplayNames[activeStage.key] || (activeStage.data?.name || activeStage.key).replace(/_/g, ' ')} logs
            </span>
            <span className="text-[10px] text-steel-500 font-mono">hover/click stage • click same stage to close</span>
          </div>
          <pre className={cn(
            'text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-all max-h-56 overflow-y-auto custom-scrollbar',
            activeStage.data?.error ? 'text-red-400' : 'text-steel-300'
          )}>
            {buildStageLogText(activeStage.data)}
          </pre>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   STAGE LOG CARD (collapsible with smooth animation)
   ========================================================================= */

function StageLogCard({ stageKey, stage, isOpen, onToggle }) {
  const sc = stageColors[stage.status] || stageColors.pending
  const Icon = stageIcons[stageKey] || Shield
  const hasContent = stage.logs || stage.error
  const contentRef = useRef(null)

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all duration-300',
      sc.bg, sc.border,
      stage.status === 'failed' && 'ring-1 ring-red-500/20 shadow-[0_0_20px_rgba(255,59,92,0.06)]',
      isOpen && 'ring-1 ring-white/[0.08]'
    )}>
      <button
        onClick={() => hasContent && onToggle?.()}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
          hasContent && 'hover:bg-white/[0.03] cursor-pointer',
          !hasContent && 'cursor-default'
        )}
      >
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', sc.dot)} />
        <Icon className={cn('w-4 h-4 flex-shrink-0', sc.text)} />
        <span className="text-sm font-semibold text-steel-50 flex-1 truncate">
          {stageDisplayNames[stageKey] || (stage.name || stageKey).replace(/_/g, ' ')}
        </span>
        {stage.duration_seconds && (
          <span className="text-[10px] font-mono text-steel-600 flex items-center gap-1 tabular-nums">
            <Timer className="w-3 h-3" />
            {formatDuration(stage.duration_seconds)}
          </span>
        )}
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border',
          stage.status === 'success' && 'bg-lime-500/10 text-lime-400 border-lime-500/20',
          stage.status === 'failed' && 'bg-red-500/10 text-red-400 border-red-500/20',
          stage.status === 'running' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          stage.status === 'skipped' && 'bg-white/[0.04] text-steel-500 border-white/[0.06]',
          stage.status === 'pending' && 'bg-white/[0.02] text-steel-600 border-white/[0.04]',
        )}>
          {stage.status}
        </span>
        {hasContent && (
          <div className={cn('transition-transform duration-300', isOpen && 'rotate-180')}>
            <ChevronDown className="w-4 h-4 text-steel-500" />
          </div>
        )}
      </button>

      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {hasContent && (
          <div className="border-t border-white/[0.04] bg-surface-code px-4 py-3">
            {stage.error && (
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                <pre className="text-red-400 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed">{stage.error}</pre>
              </div>
            )}
            {stage.logs && (
              <pre className="text-steel-300 font-mono text-xs whitespace-pre-wrap break-all leading-relaxed max-h-80 overflow-y-auto custom-scrollbar">{stage.logs}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   PIPELINE CARD (list item with accent border)
   ========================================================================= */

function PipelineCard({ pipeline, isSelected, onClick }) {
  const cfg = statusConfig[pipeline.status] || statusConfig.queued
  const deployable = pipeline.is_deployable
  const stages = pipeline.stages || {}

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border transition-all duration-300',
        'bg-obsidian-50/60 backdrop-blur-xl border-white/[0.06] shadow-card px-4 py-3',
        isSelected
          ? 'ring-1 ring-emerald-500/20 bg-emerald-500/[0.05]'
          : 'hover:bg-white/[0.03] hover:border-white/[0.1]'
      )}
    >
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-steel-50">
              <GitBranch className="w-3.5 h-3.5 text-emerald-400" />{pipeline.branch}
            </span>
            <StatusBadge status={pipeline.status} size="sm" />
            <span className="text-xs text-steel-400 font-mono inline-flex items-center gap-1">
              <Hash className="w-3 h-3" />{pipeline.commit_sha?.substring(0, 7)}
            </span>
            <span className="text-xs text-steel-400 inline-flex items-center gap-1">
              <User className="w-3 h-3" />{pipeline.author}
            </span>
            <span className="text-xs text-steel-500 font-mono inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />{timeAgo(pipeline.triggered_at)}
            </span>
          </div>
          <p className="text-sm text-steel-300 truncate mb-2">{pipeline.commit_message}</p>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {STAGE_ORDER.map((key) => {
              const rk = resolveStageKey(key, stages)
              const st = stages[rk] || { status: 'pending' }
              const dot = stageColors[st.status]?.dot || 'bg-steel-600'
              return (
                <span key={`${pipeline.id}-${key}`} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[10px] text-steel-400 whitespace-nowrap">
                  <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
                  {stageDisplayNames[rk] || stageDisplayNames[key] || key}
                </span>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 xl:flex-col xl:items-end xl:min-w-[120px]">
          {pipeline.security_score != null && (
            <div className={cn(
              'text-[11px] font-black font-mono flex items-center gap-1 px-2 py-1 rounded-lg border',
              pipeline.security_score >= 70
                ? 'bg-lime-500/10 text-lime-400 border-lime-500/20'
                : pipeline.security_score >= 40
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border-red-500/20'
            )}>
              <Shield className="w-3 h-3" />
              {pipeline.security_score}
            </div>
          )}
          {pipeline.status === 'success' && deployable != null && (
            <span className={cn(
              'text-[10px] px-2 py-1 rounded-lg border font-semibold',
              deployable
                ? 'bg-lime-500/[0.06] text-lime-400 border-lime-500/15'
                : 'bg-red-500/[0.06] text-red-400 border-red-500/15'
            )}>
              {deployable ? 'Approved' : 'Blocked'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* =========================================================================
   PIPELINE DETAIL PANEL
   ========================================================================= */

function PipelineDetails({ pipeline, onBack }) {
  const [openStages, setOpenStages] = useState({})
  const [expandAll, setExpandAll] = useState(false)

  // Auto-open failed stages
  useEffect(() => {
    if (pipeline?.stages) {
      const auto = {}
      Object.entries(pipeline.stages).forEach(([k, v]) => {
        if (v.status === 'failed') auto[k] = true
      })
      setOpenStages(auto)
    }
  }, [pipeline?.id])

  const toggleStage = (key) => {
    setOpenStages(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleExpandAll = () => {
    const stages = pipeline?.stages || {}
    if (expandAll) {
      setOpenStages({})
    } else {
      const all = {}
      Object.keys(stages).forEach(k => { if (stages[k].logs || stages[k].error) all[k] = true })
      setOpenStages(all)
    }
    setExpandAll(!expandAll)
  }

  const handleStageClick = (stageKey) => {
    const stage = pipeline?.stages?.[stageKey]
    if (stage && (stage.logs || stage.error)) {
      setOpenStages(prev => ({ ...prev, [stageKey]: true }))
      // scroll to stage after a brief delay
      setTimeout(() => {
        document.getElementById(`stage-${stageKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  if (!pipeline) {
    return (
      <div className="glass-card flex flex-col items-center justify-center py-28 px-8">
        <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
          <Layers className="w-10 h-10 text-steel-700" />
        </div>
        <h3 className="text-lg font-bold text-steel-50 mb-2">Select a Pipeline</h3>
        <p className="text-steel-500 text-sm text-center max-w-xs leading-relaxed">
          Choose a pipeline run from the list to inspect its stages, execution logs, and security results.
        </p>
      </div>
    )
  }

  const summary = pipeline.vulnerability_summary || {}
  const stages = pipeline.stages || {}
  const score = pipeline.security_score
  const isDeployable = pipeline.is_deployable
  const maxCvssScore = pipeline.max_cvss_score?.toFixed(1) || summary.max_cvss_score?.toFixed(1) || 'N/A'

  const resolvedStages = STAGE_ORDER.map(k => {
    const rk = resolveStageKey(k, stages)
    return { key: rk, data: stages[rk] }
  }).filter(s => s.data)

  const extraStages = Object.entries(stages)
    .filter(([k]) => !STAGE_ORDER.includes(k) && k !== 'bandit_scan')
    .map(([key, data]) => ({ key, data }))
  const allStages = [...resolvedStages, ...extraStages]

  const policySnapshot = pipeline.policy_snapshot

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Back Button (mobile) ──────────────────────────────── */}
      <button
        onClick={onBack}
        className="lg:hidden flex items-center gap-2 text-sm text-steel-400 hover:text-emerald-400 transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to list
      </button>

      {/* ── Header Card ────────────────────────────────────────── */}
      <div className="glass-card overflow-visible">
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.01] to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold text-steel-50 truncate">
                  {pipeline.repo_name || 'Pipeline Run'}
                </h3>
                <StatusBadge status={pipeline.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-steel-400 font-mono flex-wrap">
                <span className="flex items-center gap-1.5 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/[0.06]">
                  <GitBranch className="w-3.5 h-3.5 text-emerald-400" />{pipeline.branch}
                </span>
                <span className="flex items-center gap-1.5 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/[0.06]">
                  <GitCommit className="w-3.5 h-3.5 text-steel-500" />{pipeline.commit_sha?.substring(0, 7)}
                </span>
                <span className="flex items-center gap-1"><User className="w-3 h-3" />{pipeline.author}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(pipeline.triggered_at)}</span>
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(pipeline.duration_seconds)}</span>
              </div>
              {pipeline.commit_message && (
                <p className="text-xs text-steel-400 italic mt-2.5 flex items-start gap-1.5">
                  <GitCommit className="w-3 h-3 text-steel-600 mt-0.5 flex-shrink-0" />
                  &ldquo;{pipeline.commit_message}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-5 py-4 bg-white/[0.005]">
          <PipelineStepper stages={stages} onStageClick={handleStageClick} />
        </div>
      </div>

      {/* ── Security Score + Decision ─────────────────────────── */}
      {pipeline.status === 'success' && score != null && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Score Gauge */}
          <div className="md:col-span-3 glass-card p-6 flex flex-col items-center justify-center">
            <ScoreGauge score={score} size={130} />
            <span className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono mt-2">Security Score</span>
            
            <div className="mt-4 pt-4 border-t border-white/[0.06] w-full text-center">
              <span className={cn(
                "text-2xl font-black font-mono",
                maxCvssScore >= 9.0 ? "text-red-400" : maxCvssScore >= 7.0 ? "text-orange-400" : "text-emerald-400"
              )}>{maxCvssScore}</span>
              <span className="block text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono mt-1">CVSS Max</span>
            </div>
          </div>

          {/* Severity breakdown */}
          <div className="md:col-span-5 glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-steel-500" />
              <span className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono">Vulnerability Summary</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Critical', value: summary.critical, cls: 'bg-red-500/[0.08] border-red-500/15 text-red-400', ring: 'ring-red-500/10' },
                { label: 'High', value: summary.high, cls: 'bg-orange-500/[0.08] border-orange-500/15 text-orange-400', ring: 'ring-orange-500/10' },
                { label: 'Medium', value: summary.medium, cls: 'bg-amber-500/[0.08] border-amber-500/15 text-amber-400', ring: 'ring-amber-500/10' },
                { label: 'Low', value: summary.low, cls: 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-400', ring: 'ring-emerald-500/10' },
              ].map(s => (
                <div key={s.label} className={cn('rounded-xl p-3 text-center border flex flex-col justify-center ring-1', s.cls, s.ring)}>
                  <div className="text-2xl font-black font-mono mb-0.5">{s.value || 0}</div>
                  <div className="text-[9px] font-bold uppercase tracking-wider opacity-60">{s.label}</div>
                </div>
              ))}
            </div>
            {/* Per-scanner breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { icon: FileCode, label: 'SAST', value: summary.sast_issues || summary.bandit_issues || 0, color: 'text-emerald-400' },
                { icon: KeyRound, label: 'Secrets', value: summary.secrets_found || 0, color: summary.secrets_found > 0 ? 'text-red-400' : 'text-steel-500' },
                { icon: Container, label: 'Trivy', value: summary.trivy_vulns || 0, color: 'text-sky-400' },
                { icon: Globe, label: 'DAST', value: summary.dast_alerts || 0, color: summary.dast_alerts > 0 ? 'text-orange-400' : 'text-steel-500' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-[10px] font-mono">
                  <s.icon className={cn('w-3 h-3', s.color)} />
                  <span className="text-steel-400">{s.label}:</span>
                  <span className={cn('font-bold', s.color)}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision */}
          <div className={cn(
            'md:col-span-4 glass-card p-6 flex flex-col items-center justify-center text-center border-2 transition-all',
            isDeployable
              ? 'bg-lime-500/[0.03] border-lime-500/15'
              : 'bg-red-500/[0.03] border-red-500/15'
          )}>
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-3 border',
              isDeployable ? 'bg-lime-500/10 border-lime-500/20' : 'bg-red-500/10 border-red-500/20'
            )}>
              {isDeployable
                ? <Rocket className="w-8 h-8 text-lime-400" />
                : <Shield className="w-8 h-8 text-red-400" />
              }
            </div>
            <span className={cn('text-lg font-bold', isDeployable ? 'text-lime-400' : 'text-red-400')}>
              {isDeployable ? 'Approved' : 'Blocked'}
            </span>
            <span className={cn('text-[11px] font-mono mt-1', isDeployable ? 'text-lime-400/60' : 'text-red-400/60')}>
              {isDeployable ? 'Ready for deployment' : 'Security requirements not met'}
            </span>
          </div>
        </div>
      )}

      {/* Policy snapshot */}
      {policySnapshot && pipeline.status === 'success' && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono">Policy Applied</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-steel-400">
            {[
              { label: 'Min Score', value: policySnapshot.minScore, highlight: 'text-steel-50' },
              { label: 'Block Critical', value: policySnapshot.blockCritical ? 'Yes' : 'No', highlight: policySnapshot.blockCritical ? 'text-red-400' : 'text-steel-500' },
              { label: 'Block High', value: policySnapshot.blockHigh ? 'Yes' : 'No', highlight: policySnapshot.blockHigh ? 'text-orange-400' : 'text-steel-500' },
              { label: 'Max Critical', value: policySnapshot.maxCriticalVulns, highlight: 'text-steel-50' },
              { label: 'Max High', value: policySnapshot.maxHighVulns, highlight: 'text-steel-50' },
              { label: 'Block Secrets', value: policySnapshot.blockOnSecrets !== false ? 'Yes' : 'No', highlight: policySnapshot.blockOnSecrets !== false ? 'text-red-400' : 'text-steel-500' },
              { label: 'Block DAST High', value: policySnapshot.blockOnDastHigh ? 'Yes' : 'No', highlight: policySnapshot.blockOnDastHigh ? 'text-orange-400' : 'text-steel-500' },
            ].map(p => (
              <span key={p.label} className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]">
                {p.label}: <strong className={p.highlight}>{p.value}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Stage Logs ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-steel-500" />
            <span className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono">Stage Execution Logs</span>
          </div>
          {allStages.some(s => s.data.logs || s.data.error) && (
            <button
              onClick={handleExpandAll}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-steel-500 hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.03]"
            >
              {expandAll ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expandAll ? 'Collapse All' : 'Expand All'}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {allStages.map(({ key, data }) => (
            <div key={key} id={`stage-${key}`}>
              <StageLogCard
                stageKey={key}
                stage={data}
                isOpen={!!openStages[key]}
                onToggle={() => toggleStage(key)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Vulnerability Breakdown ───────────────────────────── */}
      {pipeline.status === 'success' && (summary.sast_issues > 0 || summary.trivy_vulns > 0) && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-steel-500" />
            <span className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono">Vulnerability Breakdown</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <FileCode className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-steel-50">Code Analysis (SAST)</span>
              </div>
              <div className="text-2xl font-black font-mono text-steel-50 mb-1">{summary.sast_issues || 0}</div>
              <div className="flex gap-2 text-[10px] font-mono flex-wrap">
                {summary.sast_high > 0 && <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">{summary.sast_high} high</span>}
                {summary.sast_medium > 0 && <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{summary.sast_medium} med</span>}
                {summary.sast_low > 0 && <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{summary.sast_low} low</span>}
                {(summary.sast_issues || 0) === 0 && <span className="text-lime-400">No issues found</span>}
              </div>
              {summary.languages_detected?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {summary.languages_detected.map(l => (
                    <span key={l} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/15">
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Container className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-steel-50">Container / Dependencies (Trivy)</span>
              </div>
              <div className="text-2xl font-black font-mono text-steel-50 mb-1">{summary.trivy_vulns || 0}</div>
              <div className="flex gap-2 text-[10px] font-mono flex-wrap">
                {summary.trivy_critical > 0 && <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">{summary.trivy_critical} crit</span>}
                {summary.trivy_high > 0 && <span className="text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">{summary.trivy_high} high</span>}
                {summary.trivy_medium > 0 && <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{summary.trivy_medium} med</span>}
                {summary.trivy_low > 0 && <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{summary.trivy_low} low</span>}
                {(summary.trivy_vulns || 0) === 0 && <span className="text-lime-400">No vulnerabilities</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================================
   REQUIREMENTS BANNER
   ========================================================================= */

function RequirementsBanner() {
  const [show, setShow] = useState(false)

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-steel-300">Repository Scan Requirements</span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-steel-600 transition-transform duration-300', show && 'rotate-180')} />
      </button>
      <div className={cn(
        'overflow-hidden transition-all duration-300 ease-in-out',
        show ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-lime-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs text-steel-50 font-medium">Public GitHub repo</span>
              <p className="text-[10px] text-steel-600">Must be accessible without authentication</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-lime-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-xs text-steel-50 font-medium">Source code files</span>
              <p className="text-[10px] text-steel-600">JS, Python, Go, Java, etc. for SAST analysis</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3.5 h-3.5 rounded-full border border-steel-500 flex items-center justify-center mt-0.5 flex-shrink-0">
              <span className="text-[7px] text-steel-500 font-bold">?</span>
            </div>
            <div>
              <span className="text-xs text-steel-50 font-medium">Dockerfile <span className="text-steel-500 font-normal">(optional)</span></span>
              <p className="text-[10px] text-steel-600">Enables Docker image build &amp; container scan</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3.5 h-3.5 rounded-full border border-steel-500 flex items-center justify-center mt-0.5 flex-shrink-0">
              <span className="text-[7px] text-steel-500 font-bold">?</span>
            </div>
            <div>
              <span className="text-xs text-steel-50 font-medium">Manifest files <span className="text-steel-500 font-normal">(optional)</span></span>
              <p className="text-[10px] text-steel-600">package.json, requirements.txt, go.mod improve dependency detection</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================================
   MAIN PAGE
   ========================================================================= */

export default function Pipeline() {
  const navigate = useNavigate()
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const [refreshSeconds, setRefreshSeconds] = useState(getAutoRefreshInterval(30))
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [repoUrl, setRepoUrl] = useState('')
  const [repoBranch, setRepoBranch] = useState('main')
  const [savingRepo, setSavingRepo] = useState(false)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Mobile: show detail panel when pipeline selected
  const [showDetail, setShowDetail] = useState(false)

  const loadRepoConfig = useCallback(async () => {
    try {
      const profile = await fetchProfile()
      setRepoUrl(profile?.defaultRepoUrl || '')
      setRepoBranch(profile?.defaultBranch || 'main')
    } catch (err) {
      console.error('Failed to load repository configuration', err)
    }
  }, [])

  const loadPipelines = useCallback(async () => {
    try {
      const result = await fetchPipelines()
      const list = result.pipelines || []
      setPipelines(list)

      if (list.length > 0 && !selectedPipeline) {
        setSelectedPipeline(list[0])
      }

      if (selectedPipeline && ['running', 'queued'].includes(selectedPipeline.status)) {
        const updated = list.find(p => p.id === selectedPipeline.id)
        if (updated) setSelectedPipeline(updated)
      }
    } catch (err) {
      setError('Failed to load pipelines')
      console.error(err)
    }
  }, [selectedPipeline])

  useEffect(() => {
    if (!authLoading && isAuthenticated) checkSetupAndLoad()
  }, [isAuthenticated, authLoading])

  const checkSetupAndLoad = async () => {
    try {
      setLoading(true)
      const status = await fetchSetupStatus()
      if (!status.setup_completed) {
        setRedirecting(true)
        window.location.href = '/setup'
        return
      }
      await loadPipelines()
      await loadRepoConfig()
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  // Toaster logic when an active pipeline completes
  useEffect(() => {
    if (activePipeline) {
      if (activePipeline.status === 'success') {
        notyf.success('Scan Complete. Check Dashboard for Score and Reports.')
      } else if (activePipeline.status === 'failed') {
        notyf.error('Scan completed with failure. Check execution logs.')
      }
    }
  }, [activePipeline?.status])

  const handleSaveRepoConfig = async () => {
    const trimmedRepo = repoUrl.trim()
    const trimmedBranch = (repoBranch || 'main').trim() || 'main'
    if (!trimmedRepo) {
      setError('Repository URL is required before saving.')
      return
    }

    setSavingRepo(true)
    setError(null)
    try {
      await updateProfile({ defaultRepoUrl: trimmedRepo, defaultBranch: trimmedBranch })
      setRepoUrl(trimmedRepo)
      setRepoBranch(trimmedBranch)
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save repository configuration'
      setError(msg)
    } finally {
      setSavingRepo(false)
    }
  }

  useEffect(() => {
    const handler = () => setRefreshSeconds(getAutoRefreshInterval(30))
    window.addEventListener('sentinelops:appearance-updated', handler)
    return () => window.removeEventListener('sentinelops:appearance-updated', handler)
  }, [])

  useEffect(() => {
    const hasRunning = pipelines.some(p => ['running', 'queued'].includes(p.status))
    if (hasRunning && refreshSeconds > 0) {
      const interval = setInterval(loadPipelines, refreshSeconds * 1000)
      return () => clearInterval(interval)
    }
  }, [pipelines, loadPipelines, refreshSeconds])

  const handleTrigger = async () => {
    setTriggering(true)
    setError(null)
    try {
      const payloadRepoUrl = repoUrl.trim()
      const payloadBranch = (repoBranch || 'main').trim() || 'main'

      if (!payloadRepoUrl) {
        const profile = await fetchProfile().catch(() => null)
        const fallbackRepoUrl = profile?.defaultRepoUrl?.trim()
        if (!fallbackRepoUrl) {
          notyf.error('Please provide a valid repository URL to scan.')
          setError('No repository configured. Add your repository URL and branch at the top of this page.')
          setTriggering(false)
          return
        }
        setRepoUrl(fallbackRepoUrl)
        setRepoBranch(profile?.defaultBranch?.trim() || 'main')
      }

      const res = await triggerPipeline({
        repo_url: payloadRepoUrl || repoUrl.trim(),
        branch: payloadBranch,
      })

      await loadPipelines()
      if (res.pipeline_id) {
        const list = (await fetchPipelines()).pipelines || []
        const created = list.find(p => p.id === res.pipeline_id)
        if (created) {
          setSelectedPipeline(created)
          setShowDetail(true)
        }
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to trigger pipeline'
      if (err.response?.status === 400 || msg.toLowerCase().includes('exist')) {
        notyf.error('Repo does not exist or access denied')
      } else {
        notyf.error(msg)
      }
      setError(msg)
      console.error(err)
    } finally {
      setTriggering(false)
    }
  }

  const handleSelectPipeline = (p) => {
    setSelectedPipeline(p)
    setShowDetail(true)
  }

  // Filtered pipelines
  const filteredPipelines = useMemo(() => {
    return pipelines.filter(p => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          p.branch?.toLowerCase().includes(q) ||
          p.author?.toLowerCase().includes(q) ||
          p.commit_sha?.toLowerCase().includes(q) ||
          p.commit_message?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [pipelines, statusFilter, searchQuery])

  // Counts per status
  const statusCounts = useMemo(() => {
    const c = { all: pipelines.length, running: 0, success: 0, failed: 0 }
    pipelines.forEach(p => { if (c[p.status] !== undefined) c[p.status]++ })
    return c
  }, [pipelines])

  const activePipeline = useMemo(() => {
    if (!filteredPipelines.length) return null
    return (
      filteredPipelines.find(p => p.status === 'running') ||
      filteredPipelines.find(p => p.status === 'queued') ||
      filteredPipelines[0]
    )
  }, [filteredPipelines])

  const historyPipelines = useMemo(() => {
    if (!activePipeline) return filteredPipelines
    return filteredPipelines.filter(p => p.id !== activePipeline.id)
  }, [filteredPipelines, activePipeline])

  if (authLoading || loading || redirecting) return <PageLoader />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-400 flex items-center justify-center shadow-glow-sm">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-steel-50">Security Pipeline</h1>
              <p className="text-steel-500 text-sm">Automated vulnerability scanning & deployment gating</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPipelines} className="btn-secondary flex items-center gap-1.5 text-sm group">
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" /> Refresh
          </button>
          <Link to="/dashboard/settings?tab=github" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Settings className="w-3.5 h-3.5" /> Webhook Settings
          </Link>
        </div>
      </div>

      <div className="glass-card border border-emerald-500/30 shadow-[0_0_25px_rgba(250,129,18,0.14)]">
        <div className="p-5 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.15em] font-mono">Primary Scan Target</p>
          <h2 className="text-lg font-bold text-steel-50 mt-1">Repository Configuration</h2>
          <p className="text-sm text-steel-400 mt-1">Set the repository and branch used when starting a scan from this page.</p>
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-7">
            <label className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2 block">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/your-org/your-repository"
              className="w-full px-4 py-2.5 bg-theme-input text-steel-50 border border-theme rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2 block">Branch</label>
            <input
              type="text"
              value={repoBranch}
              onChange={(e) => setRepoBranch(e.target.value)}
              placeholder="main"
              className="w-full px-4 py-2.5 bg-theme-input text-steel-50 border border-theme rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30"
            />
          </div>
          <div className="lg:col-span-3 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2">
            <button
              onClick={handleSaveRepoConfig}
              disabled={savingRepo}
              className="btn-secondary w-full flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              {savingRepo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {savingRepo ? 'Saving...' : 'Save Repo'}
            </button>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              className="btn-primary w-full flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
            >
              {triggering
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</>
                : <><Zap className="w-3.5 h-3.5" /> Run Scan</>
              }
            </button>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {/* ── Requirements Info ─────────────────────────────────── */}
      <RequirementsBanner />

      {/* ── Search & Filter ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative w-full sm:w-[300px] lg:w-[360px]">
          <Search className="w-4 h-4 text-steel-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search branch, author, commit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-steel-50 placeholder-steel-500 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-600 hover:text-steel-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200 whitespace-nowrap',
                statusFilter === tab.key
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-glow-sm'
                  : 'text-steel-500 hover:text-steel-300 hover:bg-white/[0.03] border border-transparent'
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1 text-[9px] font-mono',
                statusFilter === tab.key ? 'text-emerald-400/60' : 'text-steel-600'
              )}>
                {statusCounts[tab.key] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Current Pipeline (Top) ─────────────────────────── */}
      <div className="glass-card overflow-visible relative z-10">
        <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.01] to-transparent flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono">Current Pipeline</p>
            <h2 className="text-lg font-bold text-steel-50 mt-1">{activePipeline?.repo_name || 'No active pipeline'}</h2>
          </div>
          {activePipeline ? <StatusBadge status={activePipeline.status} /> : null}
        </div>

        {activePipeline ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-steel-400 font-mono">
              <span className="inline-flex items-center gap-1.5 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/[0.06]">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />{activePipeline.branch}
              </span>
              <span className="inline-flex items-center gap-1"><GitCommit className="w-3 h-3" />{activePipeline.commit_sha?.substring(0, 7)}</span>
              <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{activePipeline.author}</span>
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(activePipeline.triggered_at)}</span>
            </div>

            <div>
              <p className="text-[10px] font-bold text-steel-500 uppercase tracking-[0.15em] font-mono mb-2">Stages</p>
              <StageLogRail stages={activePipeline.stages || {}} />
            </div>
          </div>
        ) : (
          <div className="p-10 text-center">
            <Rocket className="w-8 h-8 text-steel-700 mx-auto mb-2" />
            <p className="text-sm text-steel-400">No pipeline available for selected filter.</p>
          </div>
        )}
      </div>

      {/* ── Older Pipelines (Landscape) ─────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-steel-500 uppercase tracking-[0.15em] font-mono flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> Older Pipelines
          </h2>
          <span className="text-[10px] text-steel-600 font-mono">{historyPipelines.length} total</span>
        </div>

        {historyPipelines.length === 0 ? (
          <div className="glass-card p-6 text-center text-steel-500 text-sm">No older pipelines yet.</div>
        ) : (
          <div className="space-y-2">
            {historyPipelines.map(p => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                isSelected={selectedPipeline?.id === p.id}
                onClick={() => setSelectedPipeline(p)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
