import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { CHART_COLORS } from '../../utils/helpers'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 shadow-2xl">
        <p className="text-white font-medium">{payload[0].payload.category}</p>
        <p className="text-steel-400 text-sm font-mono">
          Score: <span className="text-white font-semibold">{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function SecurityRadarChart({ data, title, height = 350 }) {
  return (
    <div className="glass-card p-6">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: '#8b95a5', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
          />
          <Radar
            name="Security Score"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.15}
            strokeWidth={2}
            animationDuration={800}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
