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
      <div className="glass-card p-3 border border-slate-200 bg-white/95 shadow-xl">
        <p className="text-slate-900 font-medium">{payload[0].payload.category}</p>
        <p className="text-slate-500 text-sm">
          Score: <span className="text-slate-900 font-semibold">{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function SecurityRadarChart({ data, title, height = 350 }) {
  return (
    <div className="glass-card p-6 bg-white border border-slate-200 shadow-sm">
      {title && (
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: '#64748b', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name="Security Score"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.3}
            strokeWidth={2}
            animationDuration={800}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
