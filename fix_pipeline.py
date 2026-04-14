import re

with open('dashboard/frontend/src/pages/Pipeline.jsx', 'r') as f:
    content = f.read()

# 1. Import useRepo
if "useRepo" not in content:
    content = content.replace("from '../context/AuthContext'", "from '../context/AuthContext'\nimport { useRepo } from '../context/RepoContext'")

# 2. Add selectedRepo
if "const { selectedRepo }" not in content:
    content = content.replace("const { isAuthenticated, loading: authLoading } = useAuth()", "const { isAuthenticated, loading: authLoading } = useAuth()\n  const { selectedRepo } = useRepo()")

# 3. Modify loadPipelines
content = re.sub(
    r'const loadPipelines = useCallback\(async \(\) => \{\n\s+try \{\n\s+const result = await fetchPipelines\(\)',
    r'const loadPipelines = useCallback(async () => {\n    try {\n      const result = await fetchPipelines(20, selectedRepo?.full_name)',
    content
)
content = content.replace(', [selectedPipeline])', ', [selectedPipeline, selectedRepo])')

# 4. Modify handleTrigger
new_trigger = """  const handleTrigger = async () => {
    if (!selectedRepo) {
      notyf.error('Please select a GitHub repository from the top menu first.')
      return
    }
    setTriggering(true)
    setError(null)
    try {
      const res = await triggerPipeline({
        repo_url: selectedRepo.url,
        branch: selectedRepo.default_branch || 'main',
      })

      await loadPipelines()
      if (res.pipeline_id) {
        const list = (await fetchPipelines(20, selectedRepo.full_name)).pipelines || []
        const created = list.find(p => p.id === res.pipeline_id)
        if (created) {
          setSelectedPipeline(created)
          setShowDetail(true)
        }
      }
      notyf.success('Pipeline triggered successfully')
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to trigger pipeline'
      notyf.error(msg)
      setError(msg)
      console.error(err)
    } finally {
      setTriggering(false)
    }
  }"""

# Replace the old handleTrigger block (which is huge) up to its end.
content = re.sub(r'const handleTrigger = async \(\) => \{.+?(?=\s+const handleSelectPipeline)', new_trigger + "\n\n", content, flags=re.DOTALL)

# 5. Remove the Repository Configuration UI block
# Note: we need to place the "Run Scan" button in the header.
new_header_buttons = """        <div className="flex items-center gap-2">
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="btn-primary flex items-center justify-center gap-1.5 text-sm disabled:opacity-50"
          >
            {triggering ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</> : <><Zap className="w-3.5 h-3.5" /> Run Scan</>}
          </button>
          <button onClick={loadPipelines} className="btn-secondary flex items-center gap-1.5 text-sm group">
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" /> Refresh
          </button>
          <Link to="/dashboard/settings?tab=github" className="btn-secondary flex items-center gap-1.5 text-sm">
            <Settings className="w-3.5 h-3.5" /> Webhook Settings
          </Link>
        </div>"""

content = re.sub(
    r'<div className="flex items-center gap-2">\s+<button onClick=\{loadPipelines\}.+?</Link>\s+</div>',
    new_header_buttons,
    content,
    flags=re.DOTALL
)

# And remove the big glass-card
content = re.sub(
    r'<div className="glass-card border border-emerald-500/30 shadow-\[0_0_25px_rgba\(250,129,18,0\.14\)\].+?</div>\s+</div>\s+</div>',
    '',
    content,
    flags=re.DOTALL
)

with open('dashboard/frontend/src/pages/Pipeline.jsx', 'w') as f:
    f.write(content)

print("Pipeline.jsx updated successfully!")
