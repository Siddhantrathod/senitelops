import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { getChartPalette, isAnimationsEnabled } from '../../utils/appearance'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 shadow-2xl">
        <p className="text-steel-50 font-medium">{payload[0].payload.category}</p>
        <p className="text-steel-400 text-sm font-mono">
          Score: <span className="text-steel-50 font-semibold">{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function SecurityRadarChart({ data, title, height = 350 }) {
  const palette = getChartPalette()
  const animate = isAnimationsEnabled()

  return (
    <div className="glass-card p-6">
      {title && (
        <h3 className="text-lg font-semibold text-steel-50 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <PolarGrid stroke="var(--chart-grid)" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: 'rgb(var(--steel-300))', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: 'rgb(var(--steel-500))', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
          />
          <Radar
            name="Security Score"
            dataKey="score"
            stroke={palette.primary}
            fill={palette.primary}
            fillOpacity={0.15}
            strokeWidth={2}
            animationDuration={animate ? 800 : 0}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
