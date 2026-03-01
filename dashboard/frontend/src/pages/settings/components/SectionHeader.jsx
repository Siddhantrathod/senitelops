export default function SectionHeader({ title, description }) {
  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-steel-100 uppercase tracking-wider font-mono">{title}</h4>
      {description && <p className="text-xs text-steel-500 mt-1">{description}</p>}
    </div>
  )
}
