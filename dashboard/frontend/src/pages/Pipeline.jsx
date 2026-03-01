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
} from 'lucide-react'
import { fetchPipelines, triggerPipeline, fetchSetupStatus } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

/* =========================================================================
   CONFIG / CONSTANTS
   ========================================================================= */

const statusConfig = {
  queued: { color: 'bg-steel-600', accent: 'border-l-steel-400', glow: '', label: 'Queued', icon: Clock },
  running: { color: 'bg-violet-500', accent: 'border-l-violet-500', glow: 'shadow-glow-sm', label: 'Running', icon: Loader2, animate: true },
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
  running: { bg: 'bg-violet-500/5', border: 'border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-500' },
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
    <div className="flex items-center w-full overflow-x-auto py-3 px-1">
      {STAGE_ORDER.map((key, i) => {
        const rk = resolveStageKey(key, stages)
        const stage = stages[rk] || { name: key, status: 'pending' }
        const sc = stageColors[stage.status] || stageColors.pending
        const Icon = stageIcons[rk] || stageIcons[key] || Shield
        const isLast = i === STAGE_ORDER.length - 1

        return (
          <div key={key} className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => onStageClick?.(rk)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group cursor-pointer"
            >
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300',
                'group-hover:scale-110 group-hover:shadow-lg',
                sc.bg, sc.border,
                stage.status === 'running' && 'ring-2 ring-violet-500/40 shadow-glow-sm animate-pulse-slow',
                stage.status === 'success' && 'border-lime-500/40',
                stage.status === 'failed' && 'border-red-500/40',
              )}>
                {stage.status === 'running' ? (
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                ) : stage.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-lime-400" />
                ) : stage.status === 'failed' ? (
                  <XCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Icon className={cn('w-4 h-4', sc.text)} />
                )}
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className={cn('text-[10px] font-semibold text-center leading-tight whitespace-nowrap', sc.text)}>
                  {stageDisplayNames[rk] || stageDisplayNames[key] || (stage.name || key).replace(/_/g, ' ')}
                </span>
                {stage.duration_seconds && (
                  <span className="text-[9px] font-mono text-steel-600">{formatDuration(stage.duration_seconds)}</span>
                )}
              </div>
            </button>
            {!isLast && (
              <div className="flex-1 mx-2 min-w-6">
                <div className={cn(
                  'h-0.5 w-full rounded-full transition-all duration-500',
                  stage.status === 'success' ? 'bg-gradient-to-r from-lime-500/60 to-lime-500/20' : 'bg-white/[0.06]'
                )} />
              </div>
            )}
          </div>
        )
      })}
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
          stage.status === 'running' && 'bg-violet-500/10 text-violet-400 border-violet-500/20',
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

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-2xl border-l-[3px] transition-all duration-300 group',
        'bg-obsidian-50/60 backdrop-blur-xl border border-white/[0.06] shadow-card',
        cfg.accent,
        isSelected
          ? 'border-r-transparent border-t-transparent border-b-transparent bg-violet-500/[0.06] ring-1 ring-violet-500/20 shadow-glow-sm scale-[1.01]'
          : 'hover:bg-white/[0.03] hover:border-r-white/[0.1] hover:border-t-white/[0.1] hover:border-b-white/[0.1] hover:shadow-card-hover hover:scale-[1.005]'
      )}
    >
      <div className="p-4">
        {/* Top row — branch + status */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <GitBranch className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
            <span className="text-sm font-bold text-steel-50 truncate">{pipeline.branch}</span>
          </div>
          <StatusBadge status={pipeline.status} size="sm" />
        </div>

        {/* Commit message */}
        <p className="text-xs text-steel-400 truncate mb-3 pl-5.5">{pipeline.commit_message}</p>

        {/* Meta row */}
        <div className="flex items-center justify-between pl-5.5">
          <div className="flex items-center gap-3 text-[10px] text-steel-500">
            <span className="flex items-center gap-1 font-mono">
              <Hash className="w-3 h-3" />{pipeline.commit_sha?.substring(0, 7)}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />{pipeline.author}
            </span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />{timeAgo(pipeline.triggered_at)}
            </span>
          </div>

          {pipeline.security_score != null && (
            <div className={cn(
              'text-[11px] font-black font-mono flex items-center gap-1 px-2 py-0.5 rounded-lg border',
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
        </div>

        {/* Deploy decision strip */}
        {pipeline.status === 'success' && deployable != null && (
          <div className={cn(
            'mt-3 py-1.5 rounded-lg text-[10px] font-bold text-center uppercase tracking-wider border',
            deployable
              ? 'bg-lime-500/[0.06] text-lime-400 border-lime-500/15'
              : 'bg-red-500/[0.06] text-red-400 border-red-500/15'
          )}>
            {deployable ? '✅ Approved for Deploy' : '❌ Deployment Blocked'}
          </div>
        )}

        {/* Running progress bar */}
        {pipeline.status === 'running' && (
          <div className="mt-3 h-1 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full animate-shimmer" style={{ width: '60%', backgroundSize: '200% 100%' }} />
          </div>
        )}
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
        className="lg:hidden flex items-center gap-2 text-sm text-steel-400 hover:text-violet-400 transition-colors mb-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to list
      </button>

      {/* ── Header Card ────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
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
                  <GitBranch className="w-3.5 h-3.5 text-violet-400" />{pipeline.branch}
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
                { label: 'Low', value: summary.low, cls: 'bg-violet-500/[0.08] border-violet-500/15 text-violet-400', ring: 'ring-violet-500/10' },
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
                { icon: FileCode, label: 'SAST', value: summary.sast_issues || summary.bandit_issues || 0, color: 'text-violet-400' },
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
            <Scale className="w-4 h-4 text-violet-400" />
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
              className="flex items-center gap-1.5 text-[10px] font-semibold text-steel-500 hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.03]"
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
                {summary.sast_low > 0 && <span className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{summary.sast_low} low</span>}
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
                {summary.trivy_low > 0 && <span className="text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{summary.trivy_low} low</span>}
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
          <Info className="w-4 h-4 text-violet-400" />
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
  const { isAuthenticated, loading: authLoading } = useAuth()

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Mobile: show detail panel when pipeline selected
  const [showDetail, setShowDetail] = useState(false)

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
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  useEffect(() => {
    const hasRunning = pipelines.some(p => ['running', 'queued'].includes(p.status))
    if (hasRunning) {
      const interval = setInterval(loadPipelines, 3000)
      return () => clearInterval(interval)
    }
  }, [pipelines, loadPipelines])

  const handleTrigger = async () => {
    setTriggering(true)
    setError(null)
    try {
      const res = await triggerPipeline()
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
      setError('Failed to trigger pipeline')
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

  if (authLoading || loading || redirecting) return <PageLoader />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-glow-sm">
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
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            {triggering
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</>
              : <><Zap className="w-3.5 h-3.5" /> Run Scan</>
            }
          </button>
          <Link to="/dashboard/settings?tab=github" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Settings className="w-3.5 h-3.5" /> Configure
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error">{error}</Alert>
      )}

      {/* ── Requirements Info ─────────────────────────────────── */}
      <RequirementsBanner />

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar — Pipeline List */}
        <div className={cn(
          'lg:col-span-4 xl:col-span-4 space-y-4',
          showDetail && 'hidden lg:block'
        )}>
          {/* Search & Filter Bar */}
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-steel-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search branch, author, commit..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-steel-50 placeholder-steel-500 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all font-mono"
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

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.06]">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-200',
                    statusFilter === tab.key
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20 shadow-glow-sm'
                      : 'text-steel-500 hover:text-steel-300 hover:bg-white/[0.03] border border-transparent'
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    'ml-1 text-[9px] font-mono',
                    statusFilter === tab.key ? 'text-violet-400/60' : 'text-steel-600'
                  )}>
                    {statusCounts[tab.key] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline List Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-steel-500 uppercase tracking-[0.15em] font-mono flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Pipeline Runs
            </h2>
            <span className="text-[10px] text-steel-600 font-mono">
              {filteredPipelines.length}{filteredPipelines.length !== pipelines.length ? ` / ${pipelines.length}` : ''} total
            </span>
          </div>

          {/* Pipeline List */}
          {filteredPipelines.length === 0 ? (
            <div className="glass-card p-10 text-center">
              {pipelines.length === 0 ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/10 flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-violet-400/60" />
                  </div>
                  <p className="text-steel-300 font-semibold text-sm mb-1">No pipelines yet</p>
                  <p className="text-[11px] text-steel-600 mb-4">Trigger a scan or push code to get started</p>
                  <button onClick={handleTrigger} disabled={triggering} className="btn-primary text-sm inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Run Your First Scan
                  </button>
                </>
              ) : (
                <>
                  <Search className="w-10 h-10 mx-auto mb-3 text-steel-700" />
                  <p className="text-steel-400 font-medium text-sm">No matching pipelines</p>
                  <p className="text-[10px] text-steel-600 mt-1">Try adjusting your search or filter</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1 custom-scrollbar">
              {filteredPipelines.map(p => (
                <PipelineCard
                  key={p.id}
                  pipeline={p}
                  isSelected={selectedPipeline?.id === p.id}
                  onClick={() => handleSelectPipeline(p)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Main — Pipeline Details */}
        <div className={cn(
          'lg:col-span-8 xl:col-span-8',
          !showDetail && 'hidden lg:block'
        )}>
          <PipelineDetails
            pipeline={selectedPipeline}
            onBack={() => setShowDetail(false)}
          />
        </div>
      </div>
    </div>
  )
}
