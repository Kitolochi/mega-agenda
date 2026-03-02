export interface DonutSegment {
  key: string
  label: string
  value: number
  color: string  // hex
}

interface DonutChartProps {
  segments: DonutSegment[]
  total: number
  hoveredKey: string | null
  onHover: (key: string | null) => void
  formatValue: (cents: number) => string
}

export default function DonutChart({ segments, total, hoveredKey, onHover, formatValue }: DonutChartProps) {
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const outerR = 88
  const innerR = 58
  const hoverGrow = 4

  if (segments.length === 0 || total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-sm text-muted">No spending data</div>
      </div>
    )
  }

  const hovered = segments.find(s => s.key === hoveredKey)

  // Build arc paths
  let cumulative = 0
  const arcs = segments.map(seg => {
    const pct = seg.value / total
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2
    cumulative += pct
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2

    const isHovered = hoveredKey === seg.key
    const r = isHovered ? outerR + hoverGrow : outerR
    const ir = isHovered ? innerR - 2 : innerR

    return { ...seg, pct, startAngle, endAngle, r, ir }
  })

  function arcPath(startAngle: number, endAngle: number, outerR: number, innerR: number) {
    // Handle full circle (single segment)
    if (endAngle - startAngle >= 2 * Math.PI - 0.001) {
      return [
        `M ${cx} ${cy - outerR}`,
        `A ${outerR} ${outerR} 0 1 1 ${cx - 0.001} ${cy - outerR}`,
        `L ${cx - 0.001} ${cy - innerR}`,
        `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
        'Z',
      ].join(' ')
    }

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    const x1 = cx + outerR * Math.cos(startAngle)
    const y1 = cy + outerR * Math.sin(startAngle)
    const x2 = cx + outerR * Math.cos(endAngle)
    const y2 = cy + outerR * Math.sin(endAngle)
    const x3 = cx + innerR * Math.cos(endAngle)
    const y3 = cy + innerR * Math.sin(endAngle)
    const x4 = cx + innerR * Math.cos(startAngle)
    const y4 = cy + innerR * Math.sin(startAngle)

    return [
      `M ${x1} ${y1}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ')
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseLeave={() => onHover(null)}
      >
        {arcs.map(arc => (
          <path
            key={arc.key}
            d={arcPath(arc.startAngle, arc.endAngle, arc.r, arc.ir)}
            fill={arc.color}
            opacity={hoveredKey && hoveredKey !== arc.key ? 0.3 : 1}
            className="transition-opacity duration-150 cursor-pointer"
            onMouseEnter={() => onHover(arc.key)}
          />
        ))}
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {hovered ? (
          <>
            <span className="text-[10px] text-muted">{hovered.label}</span>
            <span className="text-sm font-semibold text-white">${formatValue(hovered.value)}</span>
            <span className="text-[10px] text-muted">{(hovered.pct * 100).toFixed(1)}%</span>
          </>
        ) : (
          <>
            <span className="text-[10px] text-muted">Total</span>
            <span className="text-sm font-semibold text-white">${formatValue(total)}</span>
          </>
        )}
      </div>
    </div>
  )
}
