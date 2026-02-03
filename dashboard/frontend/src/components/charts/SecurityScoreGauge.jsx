import { CHART_COLORS } from '../../utils/helpers'

export default function SecurityScoreGauge({ score, size = 200 }) {
  const radius = (size - 20) / 2
  const circumference = radius * Math.PI
  const progress = (score / 100) * circumference

  const getColor = (score) => {
    if (score >= 80) return CHART_COLORS.success
    if (score >= 60) return CHART_COLORS.warning
    return CHART_COLORS.danger
  }

  const getGrade = (score) => {
    if (score >= 90) return 'A+'
    if (score >= 80) return 'A'
    if (score >= 70) return 'B'
    if (score >= 60) return 'C'
    if (score >= 50) return 'D'
    return 'F'
  }

  const color = getColor(score)
  const grade = getGrade(score)

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size / 2 + 20}
        viewBox={`0 0 ${size} ${size / 2 + 20}`}
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={CHART_COLORS.danger} />
            <stop offset="50%" stopColor={CHART_COLORS.warning} />
            <stop offset="100%" stopColor={CHART_COLORS.success} />
          </linearGradient>
        </defs>
        
        {/* Background arc */}
        <path
          d={`M 10, ${size / 2} A ${radius}, ${radius} 0 0 1 ${size - 10}, ${size / 2}`}
          fill="none"
          stroke="#334155"
          strokeWidth="12"
          strokeLinecap="round"
        />
        
        {/* Progress arc */}
        <path
          d={`M 10, ${size / 2} A ${radius}, ${radius} 0 0 1 ${size - 10}, ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{
            transition: 'stroke-dasharray 1s ease-out',
          }}
        />
        
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 10}
          textAnchor="middle"
          className="text-4xl font-bold"
          fill="white"
        >
          {score}%
        </text>
        <text
          x={size / 2}
          y={size / 2 + 15}
          textAnchor="middle"
          className="text-lg font-semibold"
          fill={color}
        >
          Grade: {grade}
        </text>
      </svg>
    </div>
  )
}
