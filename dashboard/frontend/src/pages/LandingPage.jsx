import { useNavigate } from 'react-router-dom'
import {
    Shield,
    CheckCircle,
    Zap,
    Lock,
    ArrowRight,
    LayoutDashboard,
    GitBranch,
    Code,
    Search,
    BarChart3,
    Users,
    Star,
    ChevronRight,
} from 'lucide-react'

const stats = [
    { value: '10K+', label: 'Repositories Scanned' },
    { value: '500K+', label: 'Vulnerabilities Found' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '50+', label: 'Integrations' },
]

const steps = [
    {
        number: '01',
        icon: GitBranch,
        title: 'Connect Your Repository',
        description: 'Link your GitHub, GitLab, or Bitbucket repository in seconds with our seamless integration.'
    },
    {
        number: '02',
        icon: Search,
        title: 'Automated Security Scans',
        description: 'Bandit and Trivy run automatically on every commit, scanning for vulnerabilities and misconfigurations.'
    },
    {
        number: '03',
        icon: Shield,
        title: 'Secure Deployments',
        description: 'Policy-based deployment gates ensure only secure code makes it to production.'
    },
]

const features = [
    {
        icon: GitBranch,
        title: 'Pipeline Integration',
        description: 'Seamlessly integrate with GitHub Actions, Jenkins, and GitLab CI/CD pipelines.',
        color: 'text-primary-500',
        bgColor: 'bg-primary-50',
    },
    {
        icon: Zap,
        title: 'Real-time Scanning',
        description: 'Automated Bandit and Trivy scans run on every commit to catch vulnerabilities early.',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
    },
    {
        icon: Lock,
        title: 'Compliance Ready',
        description: 'Generate audit-ready reports and maintain compliance with industry standards.',
        color: 'text-green-500',
        bgColor: 'bg-green-50',
    },
    {
        icon: BarChart3,
        title: 'Security Scoring',
        description: 'Get a comprehensive security score for every build with detailed breakdowns.',
        color: 'text-purple-500',
        bgColor: 'bg-purple-50',
    },
    {
        icon: Code,
        title: 'SAST Analysis',
        description: 'Static Application Security Testing to find vulnerabilities in your source code.',
        color: 'text-orange-500',
        bgColor: 'bg-orange-50',
    },
    {
        icon: LayoutDashboard,
        title: 'Unified Dashboard',
        description: 'Monitor all your security metrics from a single, intuitive dashboard.',
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-50',
    },
]

export default function LandingPage() {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-primary-500 shadow-lg shadow-primary-500/20">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">SentinelOps</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#features" className="text-slate-600 hover:text-primary-600 font-medium transition-colors">Features</a>
                        <a href="#how-it-works" className="text-slate-600 hover:text-primary-600 font-medium transition-colors">How It Works</a>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-slate-600 hover:text-primary-600 font-medium transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn-primary"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 -z-10" />
                <div className="absolute inset-0 overflow-hidden -z-10">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-50" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50" />
                </div>

                <div className="container mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8 animate-fade-in">
                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-sm font-medium text-slate-600">v1.0 is now live</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 tracking-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        Secure Your <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600">DevOps Pipeline</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        SentinelOps provides real-time security scanning, vulnerability assessments, and automated compliance for your CI/CD pipelines.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn-primary px-8 py-4 text-lg flex items-center gap-2"
                        >
                            Start Securing Now
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button className="btn-secondary px-8 py-4 text-lg bg-white">
                            View Documentation
                        </button>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-y border-slate-100">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center animate-fade-in" style={{ animationDelay: `${0.1 * index}s` }}>
                                <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600 mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-slate-500 font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1 rounded-full bg-primary-50 text-primary-600 text-sm font-semibold mb-4">Features</span>
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">
                            Enterprise-Grade Security Features
                        </h2>
                        <p className="text-slate-500 max-w-2xl mx-auto text-lg">
                            Everything you need to secure your applications from code to deployment.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="p-8 rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-200/80 transition-all duration-300 group animate-fade-in"
                                style={{ animationDelay: `${0.1 * index}s` }}
                            >
                                <div className={`w-14 h-14 rounded-xl ${feature.bgColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon className={`w-7 h-7 ${feature.color}`} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-500 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-24 bg-white">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1 rounded-full bg-green-50 text-green-600 text-sm font-semibold mb-4">How It Works</span>
                        <h2 className="text-4xl font-bold text-slate-900 mb-4">
                            Secure in Three Simple Steps
                        </h2>
                        <p className="text-slate-500 max-w-2xl mx-auto text-lg">
                            Get started in minutes and protect your codebase from vulnerabilities.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 relative">
                        {/* Connection line */}
                        <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-primary-200 via-primary-300 to-primary-200" />

                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="relative text-center animate-fade-in"
                                style={{ animationDelay: `${0.2 * index}s` }}
                            >
                                <div className="relative z-10 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-xl shadow-primary-500/30 mb-6">
                                    <step.icon className="w-10 h-10 text-white" />
                                </div>
                                <div className="absolute -top-2 -right-2 md:right-1/3 bg-white border-2 border-primary-500 rounded-full px-3 py-1 text-sm font-bold text-primary-600">
                                    {step.number}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                                <p className="text-slate-500 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 bg-gradient-to-br from-primary-600 to-indigo-700 relative overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                </div>

                <div className="container mx-auto px-6 text-center relative z-10">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Ready to Secure Your Pipeline?
                    </h2>
                    <p className="text-xl text-primary-100 max-w-2xl mx-auto mb-10">
                        Join thousands of developers who trust SentinelOps to keep their code secure.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-4 bg-white text-primary-600 rounded-xl font-semibold text-lg shadow-xl shadow-primary-900/30 hover:shadow-primary-900/40 transition-all flex items-center gap-2"
                        >
                            Get Started Free
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button className="px-8 py-4 bg-transparent border-2 border-white/30 text-white rounded-xl font-semibold text-lg hover:bg-white/10 transition-all">
                            Schedule Demo
                        </button>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-10">
                        <p className="text-slate-400 font-medium uppercase tracking-wider text-sm">Trusted by developers worldwide</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-50">
                        {['GitHub', 'GitLab', 'Docker', 'Kubernetes', 'AWS'].map((company) => (
                            <div key={company} className="text-2xl font-bold text-slate-400">
                                {company}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-slate-900 mt-auto">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-500/20 rounded-lg">
                                <Shield className="w-6 h-6 text-primary-400" />
                            </div>
                            <span className="font-bold text-white text-lg">SentinelOps</span>
                        </div>
                        <div className="text-slate-400 text-sm">
                            © 2026 SentinelOps. All rights reserved.
                        </div>
                        <div className="flex gap-6">
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Terms</a>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">Contact</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
