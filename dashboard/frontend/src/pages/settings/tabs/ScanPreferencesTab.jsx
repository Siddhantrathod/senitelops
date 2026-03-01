import {
  Search, Shield, Bug, Container, Globe2, KeyRound, Zap,
  AlertTriangle, FileX, Save, RotateCcw,
} from 'lucide-react'
import { SettingsCard, FormField, SectionHeader, ToggleSwitch, SettingsSkeleton } from '../components'
import { TextInput, TextArea, Select } from '../components/FormInputs'
import { useSettings } from '../hooks/useSettings'
import { fetchScanPrefs, updateScanPrefs } from '../services/settingsApi'
import { cn } from '../../../utils/helpers'

const DEFAULTS = {
  scanners: {
    sast: true,
    dast: true,
    trivy: true,
    gitleaks: true,
  },
  severityThreshold: 'medium',
  fastScanMode: false,
  autoScanOnPush: true,
  customIgnorePatterns: '',
  excludedPaths: '',
}

const SCANNERS = [
  { key: 'sast', label: 'SAST (Semgrep)', desc: 'Static application security testing', icon: Bug, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
  { key: 'dast', label: 'DAST (ZAP)', desc: 'Dynamic application security testing', icon: Globe2, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' },
  { key: 'trivy', label: 'Trivy', desc: 'Container & dependency vulnerability scanning', icon: Container, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  { key: 'gitleaks', label: 'Gitleaks', desc: 'Secret detection in source code', icon: KeyRound, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
]

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical only' },
  { value: 'high', label: 'High and above' },
  { value: 'medium', label: 'Medium and above' },
  { value: 'low', label: 'All severities' },
]

export default function ScanPreferencesTab({ showToast }) {
  const { data, loading, saving, dirty, update, updateNested, save, reset } = useSettings(
    fetchScanPrefs, updateScanPrefs, DEFAULTS
  )

  const handleSave = async () => {
    const result = await save()
    showToast(result.success ? 'Scan preferences saved' : result.error, result.success ? 'success' : 'error')
  }

  if (loading) return <SettingsSkeleton />

  const enabledCount = Object.values(data.scanners || {}).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Scanner Toggles */}
      <SettingsCard
        title="Security Scanners"
        icon={Shield}
        description="Enable or disable individual scan engines"
        actions={
          <span className="text-xs text-steel-400 font-mono">{enabledCount}/4 active</span>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCANNERS.map(scanner => (
            <div
              key={scanner.key}
              className={cn(
                'flex items-center justify-between p-4 rounded-xl border transition-all',
                data.scanners?.[scanner.key]
                  ? 'bg-theme-base border-violet-500/20'
                  : 'bg-theme-base border-theme-subtle opacity-60'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', scanner.bgColor)}>
                  <scanner.icon className={cn('w-4 h-4', scanner.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-steel-100">{scanner.label}</p>
                  <p className="text-xs text-steel-500">{scanner.desc}</p>
                </div>
              </div>
              <ToggleSwitch
                checked={data.scanners?.[scanner.key] ?? true}
                onChange={(val) => updateNested('scanners', scanner.key, val)}
              />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Scan Behavior */}
      <SettingsCard title="Scan Behavior" icon={Zap} description="Configure how scans are triggered and run">
        <div className="space-y-4">
          <FormField label="Personal Alert Threshold" hint="Only receive alerts for this severity and above">
            <Select
              value={data.severityThreshold}
              onChange={(e) => update('severityThreshold', e.target.value)}
              options={SEVERITY_OPTIONS}
            />
          </FormField>

          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Fast Scan Mode</p>
                <p className="text-xs text-steel-500">Skip DAST for faster results (SAST + Trivy + Gitleaks only)</p>
              </div>
            </div>
            <ToggleSwitch checked={data.fastScanMode} onChange={(val) => update('fastScanMode', val)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-theme-base border border-theme-subtle">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-lime-500/10">
                <Search className="w-4 h-4 text-lime-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-steel-100">Auto-scan on Push</p>
                <p className="text-xs text-steel-500">Automatically trigger scan when code is pushed to the repository</p>
              </div>
            </div>
            <ToggleSwitch checked={data.autoScanOnPush} onChange={(val) => update('autoScanOnPush', val)} />
          </div>
        </div>
      </SettingsCard>

      {/* Exclusions */}
      <SettingsCard title="Exclusions" icon={FileX} description="Paths and patterns to ignore during scans">
        <div className="space-y-5">
          <FormField label="Custom Ignore Patterns" hint="One pattern per line (e.g., *.test.js, __mocks__/*)">
            <TextArea
              value={data.customIgnorePatterns}
              onChange={(e) => update('customIgnorePatterns', e.target.value)}
              placeholder={"*.test.js\n__mocks__/*\n*.spec.ts"}
              rows={4}
            />
          </FormField>

          <FormField label="Excluded File Paths" hint="Comma-separated paths to skip">
            <TextInput
              value={data.excludedPaths}
              onChange={(e) => update('excludedPaths', e.target.value)}
              placeholder="node_modules, dist, .cache, vendor"
            />
          </FormField>
        </div>
      </SettingsCard>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={reset} disabled={!dirty || saving}
          className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-40">
          <RotateCcw className="w-4 h-4" /> Discard
        </button>
        <button onClick={handleSave} disabled={!dirty || saving}
          className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  )
}
