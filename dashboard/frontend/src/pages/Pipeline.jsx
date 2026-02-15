import { useState, useEffect, useCallback } from 'react'
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
  ChevronRight,
  Settings,
  Rocket,
  Shield,
  User,
  Calendar,
} from 'lucide-react'
import { fetchPipelines, fetchPipelineById, triggerPipeline, fetchSetupStatus } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

const statusConfig = {
  queued: { color: 'bg-slate-500', icon: Clock, text: 'Queued' },
  running: { color: 'bg-blue-500', icon: Loader2, text: 'Running', animate: true },
  success: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
  failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
  cancelled: { color: 'bg-amber-500', icon: AlertTriangle, text: 'Cancelled' },
}

const stageStatusConfig = {
  pending: { color: 'bg-slate-300', icon: Clock, text: 'Pending' },
  running: { color: 'bg-blue-500', icon: Loader2, text: 'Running', animate: true },
  success: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
  failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
  skipped: { color: 'bg-slate-200', icon: ChevronRight, text: 'Skipped' },
}

function StatusBadge({ status, size = 'md' }) {
  const config = statusConfig[status] || statusConfig.queued
  const Icon = config.icon
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium text-white shadow-sm',
      config.color,
      sizeClasses
    )}>
      <Icon className={cn('w-3.5 h-3.5', config.animate && 'animate-spin')} />
      {config.text}
    </span>
  )
}

function StageIndicator({ stage }) {
  const config = stageStatusConfig[stage.status] || stageStatusConfig.pending
  const Icon = config.icon

  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-all',
        config.color
      )}>
        <Icon className={cn('w-5 h-5', config.animate && 'animate-spin')} />
      </div>
      <span className="text-xs mt-2 text-slate-500 font-medium text-center max-w-20 truncate">
        {stage.name}
      </span>
    </div>
  )
}

function PipelineStages({ stages }) {
  const stageOrder = ['clone', 'build', 'bandit_scan', 'trivy_scan', 'policy_check', 'decision']

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto py-4 px-2">
      {stageOrder.map((key, index) => (
        <div key={key} className="flex items-center">
          <StageIndicator stage={stages[key] || { name: key, status: 'pending' }} />
          {index < stageOrder.length - 1 && (
            <div className={cn(
              'w-8 h-0.5 mx-2 rounded-full',
              stages[key]?.status === 'success' && stages[stageOrder[index + 1]]?.status !== 'pending' ? 'bg-green-400' : 'bg-slate-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

function PipelineCard({ pipeline, isSelected, onClick }) {
  const deployable = pipeline.is_deployable

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary-200',
        isSelected ? 'border-primary-500 shadow-md ring-1 ring-primary-100' : 'border-slate-200'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <GitBranch className="w-4 h-4 text-slate-400" />
            <span>{pipeline.branch}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-sm font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            <GitCommit className="w-3.5 h-3.5" />
            <span>{pipeline.commit_sha?.substring(0, 7)}</span>
          </div>
        </div>
        <StatusBadge status={pipeline.status} size="sm" />
      </div>

      <p className="text-sm text-slate-600 truncate mb-3 font-medium">
        {pipeline.commit_message}
      </p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            {pipeline.author}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formatDate(pipeline.triggered_at)}
          </span>
        </div>

        {pipeline.security_score !== null && (
          <div className={cn(
            'flex items-center gap-1.5 font-bold px-2 py-0.5 rounded',
            pipeline.security_score >= 70 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}>
            <Shield className="w-3.5 h-3.5" />
            {pipeline.security_score}/100
          </div>
        )}
      </div>

      {pipeline.status === 'success' && deployable !== null && (
        <div className={cn(
          'mt-3 py-1.5 px-3 rounded-lg text-xs font-semibold text-center border',
          deployable ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
        )}>
          {deployable ? '✅ Approved for Deployment' : '❌ Deployment Blocked'}
        </div>
      )}
    </div>
  )
}

function PipelineDetails({ pipeline }) {
  if (!pipeline) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
          <Rocket className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a Pipeline</h3>
        <p className="text-slate-500">Choose a pipeline from the list to view detailed logs and status.</p>
      </div>
    )
  }

  const summary = pipeline.vulnerability_summary || {}

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
      <div className="p-6 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xl text-slate-900">Pipeline #{pipeline.id}</h3>
            <p className="text-slate-500 text-sm mt-1">Detailed execution log</p>
          </div>
          <StatusBadge status={pipeline.status} />
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Pipeline Info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Repository</span>
            <p className="font-semibold text-slate-900">{pipeline.repo_name}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Branch</span>
            <p className="font-semibold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5" />
              {pipeline.branch}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Commit</span>
            <p className="font-mono text-slate-900 flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5" />
              {pipeline.commit_sha?.substring(0, 7)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Author</span>
            <p className="font-semibold text-slate-900">{pipeline.author}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Triggered</span>
            <p className="font-semibold text-slate-900">{formatDate(pipeline.triggered_at)}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 text-xs uppercase tracking-wider block mb-1">Duration</span>
            <p className="font-semibold text-slate-900">
              {pipeline.duration_seconds
                ? `${Math.round(pipeline.duration_seconds)}s`
                : 'In progress...'}
            </p>
          </div>
        </div>

        {/* Stages */}
        <div>
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Pipeline Visualization</h4>
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-x-auto">
            <PipelineStages stages={pipeline.stages || {}} />
          </div>
        </div>

        {/* Stage Details */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">Stage Logs</h4>
          {Object.entries(pipeline.stages || {}).map(([key, stage]) => (
            <div key={key} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
              <div className="p-4 flex items-center justify-between bg-slate-50/50 border-b border-slate-100">
                <span className="font-semibold text-slate-900 text-sm capitalize">{stage.name.replace(/_/g, ' ')}</span>
                <span className={cn(
                  'text-xs px-2.5 py-0.5 rounded-full font-medium border',
                  stage.status === 'success' && 'bg-green-50 text-green-700 border-green-100',
                  stage.status === 'failed' && 'bg-red-50 text-red-700 border-red-100',
                  stage.status === 'running' && 'bg-blue-50 text-blue-700 border-blue-100',
                  stage.status === 'skipped' && 'bg-slate-100 text-slate-600 border-slate-200',
                  stage.status === 'pending' && 'bg-slate-50 text-slate-500 border-slate-100'
                )}>
                  {stage.status}
                </span>
              </div>
              {(stage.logs || stage.error) && (
                <div className="p-4 bg-slate-900 overflow-x-auto">
                  {stage.error && (
                    <p className="text-red-400 font-mono text-xs mb-2 whitespace-pre-wrap flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      {stage.error}
                    </p>
                  )}
                  {stage.logs && (
                    <p className="text-slate-300 font-mono text-xs whitespace-pre-wrap">{stage.logs}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Security Summary */}
        {pipeline.status === 'success' && pipeline.security_score !== null && (
          <div className="border-t border-slate-200 pt-8">
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 text-center">Security Assessment</h4>

            <div className="flex flex-col items-center mb-8">
              <div className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center border-4 text-4xl font-bold mb-3 shadow-sm',
                pipeline.security_score >= 70 ? 'border-green-100 bg-green-50 text-green-600' : 'border-red-100 bg-red-50 text-red-600'
              )}>
                {pipeline.security_score}
              </div>
              <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Security Score</div>
            </div>

            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
              <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <div className="text-2xl font-bold text-red-600 mb-1">{summary.critical || 0}</div>
                <div className="text-xs font-semibold text-red-700 uppercase">Critical</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-100">
                <div className="text-2xl font-bold text-orange-600 mb-1">{summary.high || 0}</div>
                <div className="text-xs font-semibold text-orange-700 uppercase">High</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-4 text-center border border-yellow-100">
                <div className="text-2xl font-bold text-yellow-600 mb-1">{summary.medium || 0}</div>
                <div className="text-xs font-semibold text-yellow-700 uppercase">Medium</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
                <div className="text-2xl font-bold text-blue-600 mb-1">{summary.low || 0}</div>
                <div className="text-xs font-semibold text-blue-700 uppercase">Low</div>
              </div>
            </div>

            <div className={cn(
              'text-center py-4 rounded-xl font-bold text-lg border max-w-2xl mx-auto flex items-center justify-center gap-3',
              pipeline.is_deployable
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-red-50 text-red-700 border-red-200'
            )}>
              {pipeline.is_deployable
                ? <><CheckCircle className="w-6 h-6" /> Approved for Deployment</>
                : <><XCircle className="w-6 h-6" /> Deployment Blocked</>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const navigate = useNavigate()
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState(null)
  const [redirecting, setRedirecting] = useState(false)
  const { isAuthenticated, loading: authLoading } = useAuth()

  const loadPipelines = useCallback(async () => {
    try {
      const result = await fetchPipelines()
      setPipelines(result.pipelines || [])

      // Auto-select first pipeline if none selected
      if (result.pipelines?.length > 0 && !selectedPipeline) {
        setSelectedPipeline(result.pipelines[0])
      }

      // Update selected pipeline if it's running
      if (selectedPipeline && ['running', 'queued'].includes(selectedPipeline.status)) {
        const updated = result.pipelines.find(p => p.id === selectedPipeline.id)
        if (updated) {
          setSelectedPipeline(updated)
        }
      }
    } catch (err) {
      setError('Failed to load pipelines')
      console.error(err)
    }
  }, [selectedPipeline])

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      checkSetupAndLoad()
    }
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

  // Auto-refresh for running pipelines
  useEffect(() => {
    const hasRunning = pipelines.some(p => ['running', 'queued'].includes(p.status))
    if (hasRunning) {
      const interval = setInterval(loadPipelines, 3000)
      return () => clearInterval(interval)
    }
  }, [pipelines, loadPipelines])

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await triggerPipeline()
      await loadPipelines()
    } catch (err) {
      setError('Failed to trigger pipeline')
      console.error(err)
    } finally {
      setTriggering(false)
    }
  }

  // Show loader while loading, auth loading, or redirecting
  if (authLoading || loading || redirecting) return <PageLoader />

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">CI/CD Pipeline</h1>
          <p className="text-slate-500 mt-1">Real-time security scanning and deployment status</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPipelines}
            className="btn-secondary flex items-center gap-2 bg-white"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="btn-primary flex items-center gap-2"
          >
            {triggering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Trigger Scan
          </button>
          <Link to="/dashboard/settings?tab=github" className="btn-secondary flex items-center gap-2 bg-white">
            <Settings className="w-4 h-4" />
            Configure
          </Link>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Error">
          {error}
        </Alert>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Recent Pipelines
          </h2>

          {pipelines.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <Rocket className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 font-medium">No pipelines yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Push code to GitHub or trigger a scan manually
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
              {pipelines.map((pipeline) => (
                <PipelineCard
                  key={pipeline.id}
                  pipeline={pipeline}
                  isSelected={selectedPipeline?.id === pipeline.id}
                  onClick={() => setSelectedPipeline(pipeline)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pipeline Details */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-400" />
            Pipeline Status
          </h2>
          <PipelineDetails pipeline={selectedPipeline} />
        </div>
      </div>
    </div>
  )
}
