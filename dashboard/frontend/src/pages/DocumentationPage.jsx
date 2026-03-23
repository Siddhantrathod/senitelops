import { useNavigate } from 'react-router-dom'
import {
  Shield,
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Search,
  Lock,
  Bell,
  Settings,
  CheckCircle,
} from 'lucide-react'

const coreFlow = [
  {
    icon: GitBranch,
    title: '1) Repository Setup',
    description: 'Configure your primary repository + branch on Pipeline page, and keep webhook setup in Settings.',
  },
  {
    icon: Search,
    title: '2) Security Scan Execution',
    description: 'A pipeline run executes SAST (Bandit/multi-language), Trivy, Gitleaks, and DAST.',
  },
  {
    icon: Lock,
    title: '3) Policy Gate Decision',
    description: 'SentinelOps computes security score and applies policy rules to allow/block deployment.',
  },
  {
    icon: Bell,
    title: '4) Action + Notification',
    description: 'User-scoped notifications and dashboard next-actions help prioritize remediation.',
  },
]

const scanners = [
  { name: 'SAST (Bandit + multi-language)', output: 'Code vulnerabilities by severity and file location' },
  { name: 'Trivy', output: 'Container/dependency vulnerabilities + CVSS context' },
  { name: 'Gitleaks', output: 'Hardcoded secrets and leaked credential findings' },
  { name: 'DAST (OWASP ZAP)', output: 'Runtime web security alerts (high/medium/low)' },
]

const importantNotes = [
  'All dashboard data is user-scoped (pipelines, reports, notifications, settings).',
  'Trend chart on Dashboard uses recent real pipeline runs (not mock data).',
  'Webhook management stays under Settings, while repository run target stays on Pipeline.',
  'Policy thresholds determine deployment readiness after scan completion.',
]

export default function DocumentationPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-theme bg-surface/85 backdrop-blur-2xl">
        <div className="container mx-auto px-6 h-18 py-4 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-steel-300 hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-glow-sm">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-steel-50">SentinelOps Documentation</span>
          </div>

          <button onClick={() => navigate('/login')} className="btn-primary inline-flex items-center gap-2">
            Open App <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 space-y-8">
        <section className="glass-card p-7">
          <h1 className="text-3xl md:text-4xl font-bold text-steel-50 mb-4">SentinelOps at a Glance</h1>
          <p className="text-steel-300 text-lg leading-relaxed">
            SentinelOps is a pipeline-first DevSecOps platform that scans code, containers, secrets, and runtime surface,
            then applies policy-based deployment decisions with user-scoped reporting.
          </p>
        </section>

        <section className="glass-card p-7">
          <h2 className="text-2xl font-semibold text-steel-50 mb-5">Core Working Flow</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {coreFlow.map((item) => (
              <div key={item.title} className="rounded-xl border border-theme bg-white/[0.02] p-4">
                <div className="inline-flex p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3">
                  <item.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-steel-50 font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-steel-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-7">
          <h2 className="text-2xl font-semibold text-steel-50 mb-5">Scanners and Outputs</h2>
          <div className="space-y-3">
            {scanners.map((scanner) => (
              <div key={scanner.name} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border border-theme bg-white/[0.02] px-4 py-3">
                <p className="text-steel-100 font-medium">{scanner.name}</p>
                <p className="text-sm text-steel-400">{scanner.output}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-7">
          <h2 className="text-2xl font-semibold text-steel-50 mb-5">Important Notes</h2>
          <div className="space-y-3">
            {importantNotes.map((note) => (
              <div key={note} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-lime-400 mt-0.5" />
                <p className="text-steel-300">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-7">
          <h2 className="text-2xl font-semibold text-steel-50 mb-4">Quick Start</h2>
          <ol className="space-y-2 text-steel-300 list-decimal list-inside">
            <li>Create account and complete setup.</li>
            <li>Set repository + branch in Pipeline page.</li>
            <li>Configure webhook in Settings → Git Integration.</li>
            <li>Run scan and review Dashboard, Pipeline, and report pages.</li>
            <li>Fix findings and re-run until policy gate passes.</li>
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => navigate('/login')} className="btn-primary inline-flex items-center gap-2">
              Open SentinelOps <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('/')} className="btn-secondary inline-flex items-center gap-2">
              <Settings className="w-4 h-4" /> Back to Landing
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
