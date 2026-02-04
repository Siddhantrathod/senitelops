import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
import { fetchPipelines, fetchPipelineById, triggerPipeline } from '../services/api'
import { formatDate, cn } from '../utils/helpers'
import { PageLoader } from '../components/LoadingSpinner'
import Alert from '../components/Alert'
import { useAuth } from '../context/AuthContext'

const statusConfig = {
  queued: { color: 'bg-gray-500', icon: Clock, text: 'Queued' },
  running: { color: 'bg-blue-500', icon: Loader2, text: 'Running', animate: true },
  success: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
  failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
  cancelled: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Cancelled' },
}

const stageStatusConfig = {
  pending: { color: 'bg-gray-400', icon: Clock, text: 'Pending' },
  running: { color: 'bg-blue-500', icon: Loader2, text: 'Running', animate: true },
  success: { color: 'bg-green-500', icon: CheckCircle, text: 'Success' },
  failed: { color: 'bg-red-500', icon: XCircle, text: 'Failed' },
  skipped: { color: 'bg-gray-300', icon: ChevronRight, text: 'Skipped' },
}

function StatusBadge({ status, size = 'md' }) {
  const config = statusConfig[status] || statusConfig.queued
  const Icon = config.icon
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full font-medium text-white',
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
        'w-10 h-10 rounded-full flex items-center justify-center text-white',
        config.color
      )}>
        <Icon className={cn('w-5 h-5', config.animate && 'animate-spin')} />
      </div>
      <span className="text-xs mt-1 text-gray-600 text-center max-w-20 truncate">
        {stage.name}
      </span>
    </div>
  )
}

function PipelineStages({ stages }) {
  const stageOrder = ['clone', 'build', 'bandit_scan', 'trivy_scan', 'policy_check', 'decision']
  
  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
      {stageOrder.map((key, index) => (
        <div key={key} className="flex items-center">
          <StageIndicator stage={stages[key] || { name: key, status: 'pending' }} />
          {index < stageOrder.length - 1 && (
            <div className={cn(
              'w-8 h-0.5 mx-1',
              stages[key]?.status === 'success' ? 'bg-green-400' : 'bg-gray-300'
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
        'bg-white rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md',
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-gray-600">
            <GitBranch className="w-4 h-4" />
            <span className="font-medium">{pipeline.branch}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 text-sm">
            <GitCommit className="w-4 h-4" />
            <span className="font-mono">{pipeline.commit_sha}</span>
          </div>
        </div>
        <StatusBadge status={pipeline.status} size="sm" />
      </div>
      
      <p className="text-sm text-gray-700 truncate mb-2">
        {pipeline.commit_message}
      </p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {pipeline.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(pipeline.triggered_at)}
          </span>
        </div>
        
        {pipeline.security_score !== null && (
          <div className={cn(
            'flex items-center gap-1 font-medium',
            pipeline.security_score >= 70 ? 'text-green-600' : 'text-red-600'
          )}>
            <Shield className="w-3.5 h-3.5" />
            {pipeline.security_score}/100
          </div>
        )}
      </div>
      
      {pipeline.status === 'success' && deployable !== null && (
        <div className={cn(
          'mt-3 py-1.5 px-3 rounded text-sm font-medium text-center',
          deployable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        <Rocket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p>Select a pipeline to view details</p>
      </div>
    )
  }
  
  const summary = pipeline.vulnerability_summary || {}
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Pipeline #{pipeline.id}</h3>
          <StatusBadge status={pipeline.status} />
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Pipeline Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Repository</span>
            <p className="font-medium">{pipeline.repo_name}</p>
          </div>
          <div>
            <span className="text-gray-500">Branch</span>
            <p className="font-medium">{pipeline.branch}</p>
          </div>
          <div>
            <span className="text-gray-500">Commit</span>
            <p className="font-mono text-xs">{pipeline.commit_sha}</p>
          </div>
          <div>
            <span className="text-gray-500">Author</span>
            <p className="font-medium">{pipeline.author}</p>
          </div>
          <div>
            <span className="text-gray-500">Triggered</span>
            <p className="font-medium">{formatDate(pipeline.triggered_at)}</p>
          </div>
          <div>
            <span className="text-gray-500">Duration</span>
            <p className="font-medium">
              {pipeline.duration_seconds 
                ? `${Math.round(pipeline.duration_seconds)}s` 
                : 'In progress...'}
            </p>
          </div>
        </div>
        
        {/* Stages */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pipeline Stages</h4>
          <PipelineStages stages={pipeline.stages || {}} />
        </div>
        
        {/* Stage Details */}
        <div className="space-y-2">
          {Object.entries(pipeline.stages || {}).map(([key, stage]) => (
            <div key={key} className="bg-gray-50 rounded p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{stage.name}</span>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  stage.status === 'success' && 'bg-green-100 text-green-700',
                  stage.status === 'failed' && 'bg-red-100 text-red-700',
                  stage.status === 'running' && 'bg-blue-100 text-blue-700',
                  stage.status === 'skipped' && 'bg-gray-100 text-gray-600',
                  stage.status === 'pending' && 'bg-gray-100 text-gray-500'
                )}>
                  {stage.status}
                </span>
              </div>
              {stage.logs && (
                <p className="text-xs text-gray-600 mt-1">{stage.logs}</p>
              )}
              {stage.error && (
                <p className="text-xs text-red-600 mt-1">{stage.error}</p>
              )}
            </div>
          ))}
        </div>
        
        {/* Security Summary */}
        {pipeline.status === 'success' && pipeline.security_score !== null && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Security Summary</h4>
            
            <div className="text-center mb-4">
              <div className={cn(
                'text-4xl font-bold',
                pipeline.security_score >= 70 ? 'text-green-600' : 'text-red-600'
              )}>
                {pipeline.security_score}
              </div>
              <div className="text-sm text-gray-500">Security Score</div>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div className="bg-red-50 rounded p-2">
                <div className="text-lg font-semibold text-red-600">{summary.critical || 0}</div>
                <div className="text-xs text-red-700">Critical</div>
              </div>
              <div className="bg-orange-50 rounded p-2">
                <div className="text-lg font-semibold text-orange-600">{summary.high || 0}</div>
                <div className="text-xs text-orange-700">High</div>
              </div>
              <div className="bg-yellow-50 rounded p-2">
                <div className="text-lg font-semibold text-yellow-600">{summary.medium || 0}</div>
                <div className="text-xs text-yellow-700">Medium</div>
              </div>
              <div className="bg-blue-50 rounded p-2">
                <div className="text-lg font-semibold text-blue-600">{summary.low || 0}</div>
                <div className="text-xs text-blue-700">Low</div>
              </div>
            </div>
            
            <div className={cn(
              'text-center py-3 rounded-lg font-medium',
              pipeline.is_deployable 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            )}>
              {pipeline.is_deployable 
                ? '✅ Approved for Deployment' 
                : '❌ Deployment Blocked'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Pipeline() {
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [error, setError] = useState(null)
  const { isAuthenticated } = useAuth()
  
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
    } finally {
      setLoading(false)
    }
  }, [selectedPipeline])
  
  useEffect(() => {
    if (isAuthenticated) {
      loadPipelines()
    }
  }, [isAuthenticated])
  
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
  
  if (loading) return <PageLoader />
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CI/CD Pipeline</h1>
          <p className="text-gray-600">Security scanning pipeline status and history</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPipelines}
            className="btn-secondary flex items-center gap-2"
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
          <Link to="/settings" className="btn-secondary flex items-center gap-2">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="font-semibold text-gray-700">Recent Pipelines</h2>
          
          {pipelines.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Rocket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No pipelines yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Push code to GitHub or trigger a scan manually
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
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
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-gray-700 mb-3">Pipeline Details</h2>
          <PipelineDetails pipeline={selectedPipeline} />
        </div>
      </div>
    </div>
  )
}
