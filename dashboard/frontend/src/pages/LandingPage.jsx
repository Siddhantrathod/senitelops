import { useNavigate } from 'react-router-dom'
import {
  Shield, CheckCircle, Zap, Lock, ArrowRight, LayoutDashboard,
  GitBranch, Code, Search, BarChart3, ChevronRight,
} from 'lucide-react'

const stats = [
  { value: '10K+', label: 'Repositories Scanned' },
  { value: '500K+', label: 'Vulnerabilities Found' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '50+', label: 'Integrations' },
]

const steps = [
  { number: '01', icon: GitBranch, title: 'Connect Your Repository', description: 'Link your GitHub, GitLab, or Bitbucket repository in seconds with our seamless integration.' },
  { number: '02', icon: Search, title: 'Automated Security Scans', description: 'Bandit and Trivy run automatically on every commit, scanning for vulnerabilities and misconfigurations.' },
  { number: '03', icon: Shield, title: 'Secure Deployments', description: 'Policy-based deployment gates ensure only secure code makes it to production.' },
]

const features = [
  { icon: GitBranch, title: 'Pipeline Integration', description: 'Seamlessly integrate with GitHub Actions, Jenkins, and GitLab CI/CD pipelines.', color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20' },
  { icon: Zap, title: 'Real-time Scanning', description: 'Automated Bandit and Trivy scans run on every commit to catch vulnerabilities early.', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  { icon: Lock, title: 'Compliance Ready', description: 'Generate audit-ready reports and maintain compliance with industry standards.', color: 'text-lime-400', bgColor: 'bg-lime-500/10', borderColor: 'border-lime-500/20' },
  { icon: BarChart3, title: 'Security Scoring', description: 'Get a comprehensive security score for every build with detailed breakdowns.', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
  { icon: Code, title: 'SAST Analysis', description: 'Static Application Security Testing to find vulnerabilities in your source code.', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/20' },
  { icon: LayoutDashboard, title: 'Unified Dashboard', description: 'Monitor all your security metrics from a single, intuitive dashboard.', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-surface/80 backdrop-blur-2xl border-b border-theme">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-glow-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-steel-50">SentinelOps</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-steel-400 hover:text-violet-400 font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-steel-400 hover:text-violet-400 font-medium transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/login')} className="text-steel-300 hover:text-violet-400 font-medium transition-colors">
              Sign In
            </button>
            <button onClick={() => navigate('/login')} className="btn-primary">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 grid-bg opacity-30" />
        </div>

        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="text-sm font-medium text-steel-300 font-mono">v1.0 is now live</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-steel-50 mb-6 tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Secure Your{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">DevOps Pipeline</span>
          </h1>
          <p className="text-xl text-steel-400 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            SentinelOps provides real-time security scanning, vulnerability assessments, and automated compliance for your CI/CD pipelines.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <button onClick={() => navigate('/login')} className="btn-primary px-8 py-4 text-lg flex items-center gap-2">
              Start Securing Now <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 text-lg bg-white/[0.04] border border-white/[0.08] rounded-xl text-steel-200 font-semibold hover:bg-white/[0.06] hover:border-white/[0.12] transition-all">
              View Documentation
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-theme">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${0.1 * index}s` }}>
                <div className="text-4xl md:text-5xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-2">
                  {stat.value}
                </div>
                <div className="text-steel-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-violet-500/10 text-violet-400 text-sm font-semibold border border-violet-500/20 mb-4">Features</span>
            <h2 className="text-4xl font-bold text-steel-50 mb-4">Enterprise-Grade Security Features</h2>
            <p className="text-steel-500 max-w-2xl mx-auto text-lg">Everything you need to secure your applications from code to deployment.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-card p-8 group hover:shadow-glow-sm transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className={`w-14 h-14 rounded-xl ${feature.bgColor} border ${feature.borderColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={`w-7 h-7 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-steel-50 mb-3">{feature.title}</h3>
                <p className="text-steel-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 border-t border-theme">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full bg-lime-500/10 text-lime-400 text-sm font-semibold border border-lime-500/20 mb-4">How It Works</span>
            <h2 className="text-4xl font-bold text-steel-50 mb-4">Secure in Three Simple Steps</h2>
            <p className="text-steel-500 max-w-2xl mx-auto text-lg">Get started in minutes and protect your codebase from vulnerabilities.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-px bg-gradient-to-r from-violet-500/30 via-violet-500/60 to-violet-500/30" />

            {steps.map((step, index) => (
              <div key={index} className="relative text-center animate-fade-in" style={{ animationDelay: `${0.2 * index}s` }}>
                <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-glow mb-6">
                  <step.icon className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 md:right-1/3 bg-surface border-2 border-violet-500 rounded-full px-3 py-1 text-sm font-bold font-mono text-violet-400">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-steel-50 mb-3">{step.title}</h3>
                <p className="text-steel-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-purple-600/20" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 grid-bg opacity-20" />
        </div>

        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Secure Your Pipeline?</h2>
          <p className="text-xl text-steel-400 max-w-2xl mx-auto mb-10">
            Join thousands of developers who trust SentinelOps to keep their code secure.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/login')}
              className="btn-primary px-8 py-4 text-lg shadow-glow flex items-center gap-2">
              Get Started Free <ArrowRight className="w-5 h-5" />
            </button>
            <button className="px-8 py-4 bg-transparent border-2 border-white/[0.15] text-white rounded-xl font-semibold text-lg hover:bg-white/[0.04] transition-all">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 border-t border-theme">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-steel-600 font-medium uppercase tracking-[0.15em] text-xs font-mono">Trusted by developers worldwide</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-30">
            {['GitHub', 'GitLab', 'Docker', 'Kubernetes', 'AWS'].map((company) => (
              <div key={company} className="text-2xl font-bold text-steel-500">{company}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-surface-secondary/50 border-t border-theme mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
                <Shield className="w-6 h-6 text-violet-400" />
              </div>
              <span className="font-bold text-steel-50 text-lg">SentinelOps</span>
            </div>
            <div className="text-steel-600 text-sm font-mono">© 2026 SentinelOps. All rights reserved.</div>
            <div className="flex gap-6">
              <a href="#" className="text-steel-500 hover:text-violet-400 transition-colors">Privacy</a>
              <a href="#" className="text-steel-500 hover:text-violet-400 transition-colors">Terms</a>
              <a href="#" className="text-steel-500 hover:text-violet-400 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
