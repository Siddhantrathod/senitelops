import { useState, useEffect, useCallback } from 'react'
import {
  Users, Shield, GitBranch, CheckCircle, XCircle, Gauge, RefreshCw,
  AlertTriangle, KeyRound, Activity, Clock, Wifi, Server,
  Container, FileCode, Globe, TrendingUp, Zap, Settings,
  MessageSquare, Send, X, ExternalLink, Info,
} from 'lucide-react'
import { cn } from '../../utils/helpers'
import { KpiCard, StatusBadge, SkeletonCard } from '../../components/admin'
import {
  fetchAdminStats,
  fetchAdminOverviewAnalytics,
  fetchAdminFeedbacks,
  replyAdminFeedback,
} from '../../services/api'
import { notyf } from '../../utils/notifications'

const ALL_NEWS = [
  { id: 1, title: 'New CVE-2024-3094 Backdoor in XZ Utils', source: 'CISA', time: '2h ago', type: 'critical', url: 'https://www.cisa.gov/news-events/alerts/2024/03/29/reported-supply-chain-compromise-affecting-xz-utils-data-compression' },
  { id: 2, title: 'GitHub rotating compromised SSH keys', source: 'GitHub Blog', time: '5h ago', type: 'high', url: 'https://github.blog/security/' },
  { id: 3, title: 'NPM registry flooded with crypto-stealing packages', source: 'The Hacker News', time: '12h ago', type: 'medium', url: 'https://thehackernews.com/search/label/npm' },
  { id: 4, title: 'AWS patching critical IAM vulnerability', source: 'AWS Security', time: '1d ago', type: 'high', url: 'https://aws.amazon.com/security/security-bulletins/' },
  { id: 5, title: 'Rust standard library path traversal flaw fixed', source: 'RustSec', time: '2d ago', type: 'medium', url: 'https://rustsec.org/advisories/' },
  { id: 6, title: 'Google Chrome zero-day actively exploited', source: 'Google Threat Intel', time: '3h ago', type: 'critical', url: 'https://chromereleases.googleblog.com/' },
  { id: 7, title: 'Docker warns of malicious images in Docker Hub', source: 'Docker Security', time: '8h ago', type: 'high', url: 'https://www.docker.com/blog/security/' },
  { id: 8, title: 'Node.js security updates released for 20.x, 22.x', source: 'Node.js', time: '14h ago', type: 'low', url: 'https://nodejs.org/en/blog/vulnerability' },
  { id: 9, title: 'OpenSSH critical RCE vulnerability CVE-2024-6387 (regreSSHion)', source: 'Qualys', time: '6h ago', type: 'critical', url: 'https://www.qualys.com/2024/07/01/cve-2024-6387/regresshion.txt' },
  { id: 10, title: 'Python 3.12 security patch closes injection flaw', source: 'Python Security', time: '1d ago', type: 'medium', url: 'https://python-security.readthedocs.io/vulnerabilities.html' },
  { id: 11, title: 'OWASP Top 10 2025 preview released', source: 'OWASP', time: '3d ago', type: 'low', url: 'https://owasp.org/www-project-top-ten/' },
  { id: 12, title: 'Kubernetes privilege escalation via node annotation', source: 'K8s Security', time: '18h ago', type: 'high', url: 'https://kubernetes.io/docs/reference/issues-security/official-cve-feed/' },
]

function getRandomNews() {
  const shuffled = [...ALL_NEWS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, 4)
}

function ScannerStatus({ name, icon: Icon, status }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', status === 'online' ? 'bg-lime-500/15 text-lime-400' : 'bg-red-500/15 text-red-400')}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-steel-200">{name}</span>
      </div>
      <StatusBadge status={status} dot />
    </div>
  )
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [news, setNews] = useState(getRandomNews())
  const [refreshingNews, setRefreshingNews] = useState(false)

  // Feedback state
  const [feedbacks, setFeedbacks] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null) // feedback being replied to
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const refreshNews = () => {
    setRefreshingNews(true)
    setTimeout(() => {
      setNews(getRandomNews())
      setRefreshingNews(false)
    }, 600)
  }

  const loadFeedbacks = useCallback(async () => {
    setFeedbackLoading(true)
    try {
      const data = await fetchAdminFeedbacks()
      setFeedbacks(data)
    } catch (err) {
      console.error('Failed to load feedbacks:', err)
    }
    setFeedbackLoading(false)
  }, [])

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !replyTarget) return
    setReplying(true)
    try {
      await replyAdminFeedback(replyTarget.id, replyText)
      notyf.success('Reply sent successfully!')
      setReplyTarget(null)
      setReplyText('')
      loadFeedbacks()
    } catch (err) {
      notyf.error(err.response?.data?.error || 'Failed to send reply')
    }
    setReplying(false)
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, analyticsData] = await Promise.all([
        fetchAdminStats(),
        fetchAdminOverviewAnalytics().catch(() => null),
      ])
      setStats(statsData)
      setAnalytics(analyticsData)
    } catch (err) {
      console.error('Failed to load overview:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { loadFeedbacks() }, [loadFeedbacks])

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-white/[0.06] rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-64 bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-64 bg-white/[0.02] border border-white/[0.04] rounded-2xl animate-pulse" />
          <div className="h-64 bg-white/[0.02] border border-white/[0.04] rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <p className="text-steel-400">Failed to load statistics</p>
        <button onClick={loadAll} className="btn-primary mt-4 text-sm">Retry</button>
      </div>
    )
  }

  const { users: uStats, pipelines: pStats, config, policy, reports } = stats
  const deployPassRate = pStats.total > 0 ? Math.round((pStats.deployable / pStats.total) * 100) : 0
  const failRate24h = pStats.total > 0 ? Math.round((pStats.failed / pStats.total) * 100) : 0

  const systemHealth = analytics?.systemHealth || {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-steel-50 mb-1">Admin Overview</h1>
          <p className="text-steel-400 text-sm">Platform health, security metrics & analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-steel-500 font-mono">Updated: {new Date().toLocaleTimeString()}</span>
          <button onClick={loadAll} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Platform Users" value={uStats.total} icon={Users} accent="blue"
          trend={{ value: 1, direction: 'up', label: 'vs last month' }} />
        <KpiCard label="Connected Repositories" value={config.repo_url ? 1 : 0} icon={GitBranch} accent="indigo" />
        <KpiCard label="Pipeline Executions" value={pStats.total} icon={Activity} accent="cyan" />
        <KpiCard label="Avg Security Score" value={pStats.avg_security_score} icon={Gauge}
          accent={pStats.avg_security_score >= 80 ? 'lime' : pStats.avg_security_score >= 60 ? 'amber' : 'red'} />
      </div>

      {/* News and Feedbacks */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Security News Widget */}
        <div className="glass-card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" /> Security News & Advisories
            </h3>
            <button 
              onClick={refreshNews} 
              disabled={refreshingNews}
              className="p-1.5 rounded-lg text-steel-400 hover:text-steel-100 hover:bg-white/[0.06] transition-all disabled:opacity-50"
              title="Refresh News"
            >
              <RefreshCw className={cn("w-4 h-4", refreshingNews && "animate-spin")} />
            </button>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {news.map(item => {
              const NewsIcon = item.type === 'critical' ? Shield : 
                               item.type === 'high' ? AlertTriangle : 
                               item.type === 'medium' ? Info : Info;
              const accentColor = item.type === 'critical' ? 'red' : 
                                  item.type === 'high' ? 'orange' : 
                                  item.type === 'medium' ? 'blue' : 'emerald';
              
              return (
                <div key={item.id} className="group relative p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-300">
                  <div className="flex gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:scale-110",
                      accentColor === 'red' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                      accentColor === 'orange' ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                      accentColor === 'blue' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                      "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      <NewsIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-steel-50 group-hover:text-blue-400 transition-colors line-clamp-2 leading-relaxed"
                        >
                          {item.title}
                        </a>
                        <StatusBadge 
                          status={item.type === 'critical' ? 'critical' : item.type === 'high' ? 'high' : 'info'} 
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-steel-500">
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.05]">{item.source}</span>
                        <div className="w-1 h-1 rounded-full bg-steel-700" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {item.time}
                        </span>
                        {item.type === 'critical' && (
                          <span className="relative flex h-2 w-2 ml-auto">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Subtle hover effect light */}
                  <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback & Management Component */}
        <div className="glass-card p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-400" /> Feedback & Management
            </h3>
            <button onClick={loadFeedbacks} className="p-1.5 rounded-lg text-steel-400 hover:text-steel-100 hover:bg-white/[0.06] transition-all" title="Refresh">
              <RefreshCw className={cn('w-4 h-4', feedbackLoading && 'animate-spin')} />
            </button>
          </div>

          {/* Admin Reply Dialog */}
          {replyTarget && (
            <div className="mb-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs text-blue-300 font-mono mb-1">Replying to: <span className="font-bold">{replyTarget.username || 'User'}</span></p>
              <p className="text-xs text-steel-300 italic mb-3 line-clamp-2">"{replyTarget.message}"</p>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                placeholder="Type your reply..."
                className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2 text-xs text-steel-100 placeholder:text-steel-600 focus:outline-none focus:border-blue-500/50 resize-none mb-2"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReplySubmit}
                  disabled={replying || !replyText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold text-xs rounded-lg transition-colors border border-blue-500/30 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" /> {replying ? 'Sending...' : 'Send Reply'}
                </button>
                <button
                  onClick={() => { setReplyTarget(null); setReplyText('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-steel-300 text-xs rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {feedbackLoading && (
              <div className="text-center text-xs text-steel-500 font-mono py-4">Loading feedback...</div>
            )}
            {!feedbackLoading && feedbacks.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-steel-600 mx-auto mb-2" />
                <p className="text-sm text-steel-500">No user feedback yet</p>
              </div>
            )}
            {feedbacks.map(fb => (
              <div key={fb.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.10] transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-steel-200">{fb.username || 'User'}</span>
                    <span className="text-[10px] text-steel-600 font-mono">{fb.email}</span>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    fb.status === 'reviewed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  )}>
                    {fb.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-steel-300 italic mb-3 line-clamp-2">"{fb.message}"</p>
                {fb.admin_reply && (
                  <div className="mb-3 p-2 bg-blue-500/5 border-l-2 border-blue-500/40 rounded-r text-xs text-blue-300">
                    <span className="font-bold not-italic block mb-0.5">Admin replied:</span>
                    {fb.admin_reply}
                  </div>
                )}
                {fb.status !== 'reviewed' && (
                  <button
                    onClick={() => { setReplyTarget(fb); setReplyText('') }}
                    className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors border border-blue-500/20"
                  >
                    Review & Reply
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
          <h3 className="text-lg font-semibold text-steel-50 flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" /> System Health
          </h3>
          <StatusBadge status={systemHealth.overallStatus || 'online'} dot size="sm">
            {(systemHealth.overallStatus || 'online') === 'online' ? 'All Systems Operational' : 'Degraded'}
          </StatusBadge>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Scanner Availability</h4>
            <div className="space-y-2">
              <ScannerStatus name="Bandit (Python SAST)" icon={FileCode} status={systemHealth.bandit || 'online'} />
              <ScannerStatus name="Semgrep (Multi-lang)" icon={FileCode} status={systemHealth.semgrep || 'online'} />
              <ScannerStatus name="Trivy (Container)" icon={Container} status={systemHealth.trivy || 'online'} />
              <ScannerStatus name="ZAP (DAST)" icon={Globe} status={systemHealth.zap || 'online'} />
              <ScannerStatus name="Gitleaks (Secrets)" icon={KeyRound} status={systemHealth.gitleaks || 'online'} />
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Infrastructure</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400"><Container className="w-4 h-4" /></div>
                  <span className="text-sm text-steel-200">Docker Daemon</span>
                </div>
                <StatusBadge status={systemHealth.docker || 'online'} dot />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400"><Wifi className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">Last Webhook</span>
                    <span className="text-xs text-steel-500 font-mono">{systemHealth.lastWebhook || 'No events received'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400"><Activity className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">API Latency</span>
                    <span className="text-xs text-steel-500 font-mono">{systemHealth.apiLatency || '< 100ms'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400"><Clock className="w-4 h-4" /></div>
                  <div>
                    <span className="text-sm text-steel-200 block">Job Queue</span>
                    <span className="text-xs text-steel-500 font-mono">{pStats.running} running • {systemHealth.queuedJobs || 0} queued</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-white/[0.06]">
          <h4 className="text-xs font-bold text-steel-400 uppercase tracking-wider mb-3 font-mono">Report Availability</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(reports).map(([key, available]) => (
              <StatusBadge key={key} status={available ? 'active' : 'offline'}>
                {available ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                {key}
              </StatusBadge>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Info Panels */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> User Distribution
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-5 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
              <p className="text-3xl font-black text-emerald-400 font-mono">{uStats.admins}</p>
              <p className="text-xs text-steel-400 mt-2 uppercase font-semibold tracking-wider">Admins</p>
            </div>
            <div className="text-center p-5 bg-cyan-500/5 rounded-xl border border-cyan-500/20">
              <p className="text-3xl font-black text-cyan-400 font-mono">{uStats.users}</p>
              <p className="text-xs text-steel-400 mt-2 uppercase font-semibold tracking-wider">Users</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-steel-400 uppercase tracking-wider mb-4 font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Critical Security Stats
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-md">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-sm text-steel-200">Critical Vulnerabilities</span>
              </div>
              <span className="text-xl font-bold font-mono text-red-400">{analytics?.criticalCount || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 text-orange-400 rounded-md">
                  <KeyRound className="w-4 h-4" />
                </div>
                <span className="text-sm text-steel-200">Exposed Secrets</span>
              </div>
              <span className="text-xl font-bold font-mono text-orange-400">{analytics?.totalSecrets || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
