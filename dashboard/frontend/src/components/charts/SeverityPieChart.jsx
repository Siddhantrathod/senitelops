import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { CHART_COLORS } from '../../utils/helpers'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    return (
      <div className="glass-card p-3 border border-dark-600">
        <p className="text-white font-medium">{data.name}</p>
        <p className="text-dark-300 text-sm">
          Count: <span className="text-white font-semibold">{data.value}</span>
        </p>
        <p className="text-dark-300 text-sm">
          Percentage: <span className="text-white font-semibold">{(data.payload.percent * 100).toFixed(1)}%</span>
        </p>
      </div>
    )
  }
  return null
}

const CustomLegend = ({ payload }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-dark-300 text-sm">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function SeverityPieChart({ data, title, height = 300 }) {
  const chartData = data.map(item => ({
    ...item,
    percent: item.value / data.reduce((acc, curr) => acc + curr.value, 0),
  }))

  const colors = {
    Critical: CHART_COLORS.critical,
    High: CHART_COLORS.high,
    Medium: CHART_COLORS.medium,
    Low: CHART_COLORS.low,
    Info: CHART_COLORS.info,
  }

  return (
    <div className="glass-card p-6">
      {title && (
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            animationBegin={0}
            animationDuration={800}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[entry.name] || CHART_COLORS.info}
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
