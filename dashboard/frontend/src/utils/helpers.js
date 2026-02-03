import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function getSeverityColor(severity) {
  const colors = {
    CRITICAL: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
    HIGH: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
    MEDIUM: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500' },
    LOW: { bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500' },
    UNKNOWN: { bg: 'bg-gray-500', text: 'text-gray-400', border: 'border-gray-500' },
  }
  return colors[severity?.toUpperCase()] || colors.UNKNOWN
}

export function getSeverityBadgeClass(severity) {
  const classes = {
    CRITICAL: 'badge-critical',
    HIGH: 'badge-high',
    MEDIUM: 'badge-medium',
    LOW: 'badge-low',
  }
  return classes[severity?.toUpperCase()] || 'badge-info'
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export function truncateText(text, maxLength = 100) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function calculateRiskScore(vulnerabilities) {
  if (!vulnerabilities || vulnerabilities.length === 0) return 0
  
  const weights = {
    CRITICAL: 10,
    HIGH: 7,
    MEDIUM: 4,
    LOW: 1,
  }
  
  let totalScore = 0
  let maxPossible = vulnerabilities.length * 10
  
  vulnerabilities.forEach(vuln => {
    const severity = vuln.Severity?.toUpperCase() || vuln.issue_severity?.toUpperCase() || 'LOW'
    totalScore += weights[severity] || 1
  })
  
  return Math.min(100, Math.round((totalScore / maxPossible) * 100))
}

export function getSecurityGrade(score) {
  if (score >= 90) return { grade: 'A+', color: 'text-green-400' }
  if (score >= 80) return { grade: 'A', color: 'text-green-400' }
  if (score >= 70) return { grade: 'B', color: 'text-yellow-400' }
  if (score >= 60) return { grade: 'C', color: 'text-orange-400' }
  if (score >= 50) return { grade: 'D', color: 'text-orange-500' }
  return { grade: 'F', color: 'text-red-400' }
}

export const CHART_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
}

export const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
