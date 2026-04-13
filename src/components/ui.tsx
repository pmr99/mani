import { useState, useRef, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency, getCategoryColor, formatCategoryName, CHART_COLORS } from '../lib/engines/utils'
import { usePrivacy as usePrivacyHook } from '../hooks/usePrivacy'

// ═══ Tooltip on hover ═══

interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  function handleEnter(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    setShow(true)
  }

  return (
    <div ref={ref} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)} className="relative inline-flex">
      {children}
      {show && (
        <div
          className="fixed z-50 px-2.5 py-1.5 text-xs text-white bg-[#252839] border border-[#2a2d3d] rounded-lg shadow-xl pointer-events-none whitespace-nowrap"
          style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
        >
          {content}
        </div>
      )}
    </div>
  )
}

// ═══ Truncated text with hover tooltip ═══

interface TruncatedTextProps {
  text: string
  maxLength?: number
  className?: string
}

export function TruncatedText({ text, maxLength = 20, className = '' }: TruncatedTextProps) {
  const truncated = text.length > maxLength ? text.substring(0, maxLength).trim() + '...' : text
  const needsTip = text.length > maxLength

  if (!needsTip) return <span className={className}>{text}</span>

  return (
    <Tip content={text}>
      <span className={className}>{truncated}</span>
    </Tip>
  )
}

// ═══ Card wrapper ═══

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

// ═══ Section / Chart label ═══

export function ChartLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wider">{children}</p>
}

export function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
      <span className="w-1.5 h-5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </h2>
  )
}

// ═══ Category Badge with color ═══

interface CategoryBadgeProps {
  category: string | null
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return <span className="text-gray-600">-</span>
  const color = getCategoryColor(category)
  return (
    <Tip content={category}>
      <span
        className="px-2 py-0.5 text-xs rounded-full font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {formatCategoryName(category)}
      </span>
    </Tip>
  )
}

// ═══ Merchant bar (list item with inline progress bar) ═══

interface MerchantBarProps {
  name: string
  value: number
  maxValue: number
  color: string
  index?: number
}

export function MerchantBar({ name, value, maxValue, color, index = 0 }: MerchantBarProps) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <TruncatedText text={name} maxLength={22} className="text-xs text-gray-300" />
        <span className="text-xs font-semibold text-gray-200">{formatCurrency(value)}</span>
      </div>
      <div className="w-full bg-[#252839] rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ═══ Stat card (summary metric) ═══

interface StatCardProps {
  label: string
  value: number
  color: string
  change?: number | null
  format?: 'currency' | 'compact'
}

export function StatCard({ label, value, color, change, format = 'compact' }: StatCardProps) {
  const { mask } = usePrivacyHook()
  const formatted = format === 'compact'
    ? `$${Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) + 'K' : value.toFixed(0)}`
    : formatCurrency(value)

  return (
    <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-2xl p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10" style={{ backgroundColor: color, transform: 'translate(30%, -30%)' }} />
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{mask(formatted)}</p>
      {change != null && (
        <p className={`text-xs mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change >= 0 ? '+' : ''}{mask(formatCurrency(change))}
        </p>
      )}
    </div>
  )
}

// ═══ Amount display (colored) ═══

interface AmountProps {
  amount: number
  className?: string
}

export function Amount({ amount, className = '' }: AmountProps) {
  const isExpense = amount > 0
  return (
    <span className={`font-medium ${isExpense ? 'text-rose-400' : 'text-emerald-400'} ${className}`}>
      {isExpense ? '-' : '+'}{formatCurrency(Math.abs(amount))}
    </span>
  )
}

// ═══ Transaction row ═══

interface TransactionRowProps {
  date: string
  merchantName: string | null
  name: string
  category: string | null
  amount: number
  pending?: boolean
  compact?: boolean
  onCategoryClick?: () => void
}

export function TransactionRow({ date, merchantName, name, category, amount, pending, compact, onCategoryClick }: TransactionRowProps) {
  const displayName = merchantName || name
  if (compact) {
    return (
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getCategoryColor(category) }} />
          <span className="text-gray-500 w-14 shrink-0">{date.slice(5)}</span>
          <TruncatedText text={displayName} maxLength={22} className="text-gray-300" />
        </div>
        <Amount amount={amount} className="shrink-0 ml-2 text-xs" />
      </div>
    )
  }
  return (
    <tr className="border-b border-[#2a2d3d]/50 hover:bg-[#252839]">
      <td className="px-4 py-3 text-gray-500 text-sm">{date}</td>
      <td className="px-4 py-3 text-sm">
        <TruncatedText text={displayName} maxLength={28} className="text-white" />
      </td>
      <td className="px-4 py-3">
        {onCategoryClick ? (
          <button onClick={onCategoryClick} className="hover:opacity-80 transition-opacity cursor-pointer">
            <CategoryBadge category={category} />
          </button>
        ) : (
          <CategoryBadge category={category} />
        )}
      </td>
      <td className="px-4 py-3">
        {pending ? <span className="text-xs text-amber-400">Pending</span> : <span className="text-xs text-emerald-400">Posted</span>}
      </td>
      <td className="px-4 py-3 text-right"><Amount amount={amount} className="text-sm" /></td>
    </tr>
  )
}

// ═══ Breakdown list (Money In / Money Out style) ═══

interface BreakdownItem {
  name: string
  value: number
  color: string
}

interface BreakdownListProps {
  title: string
  items: BreakdownItem[]
  total: number
  positive?: boolean
}

export function BreakdownList({ title, items, total, positive = true }: BreakdownListProps) {
  const sign = positive ? '+' : '-'
  const textColor = positive ? 'text-emerald-400' : 'text-rose-400'
  return (
    <Card>
      <ChartLabel>{title}</ChartLabel>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-400">{item.name}</span>
            </div>
            <span className={`text-xs font-semibold ${textColor}`}>{sign}{formatCurrency(item.value)}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-600">No data</p>}
        <div className="border-t border-[#2a2d3d] pt-2 flex justify-between">
          <span className="text-xs text-gray-500">Total</span>
          <span className={`text-xs font-bold ${textColor}`}>{sign}{formatCurrency(total)}</span>
        </div>
      </div>
    </Card>
  )
}

// ═══ Shared chart config ═══

export const chartTooltipStyle = { backgroundColor: '#1a1d29', border: '1px solid #2a2d3d', borderRadius: '10px', color: '#f3f4f6', fontSize: 13, padding: '8px 12px' }
export const chartAxisProps = { axisLine: false, tickLine: false, tick: { fill: '#9ca3af', fontSize: 12 } }
export const chartLegendStyle = { fontSize: 12, color: '#9ca3af', paddingTop: 8 }

// Standardized chart heights
export const CHART_HEIGHT = {
  large: 340,    // main feature charts (cash flow, spending over time)
  medium: 280,   // secondary charts (category, allocation)
  small: 200,    // compact charts (performance, forecast mini)
  mini: 100,     // sparklines, inline previews
}

// ═══ Standardized Donut Chart ═══

interface DonutChartItem {
  name: string
  value: number
  color?: string
}

interface DonutChartProps {
  data: DonutChartItem[]
  height?: number
  showLegend?: boolean
  /** Color mode: 'category' uses getCategoryColor, 'palette' uses CHART_COLORS, 'custom' uses item.color */
  colorMode?: 'category' | 'palette' | 'custom'
  emptyMessage?: string
}

export function DonutChart({ data, height = 340, showLegend = true, colorMode = 'category', emptyMessage = 'No data' }: DonutChartProps) {
  const { mask: pm } = usePrivacyHook()

  if (data.length === 0) return <p className="text-gray-600 text-sm py-12 text-center">{emptyMessage}</p>

  function getColor(item: DonutChartItem, index: number): string {
    if (colorMode === 'custom' && item.color) return item.color
    if (colorMode === 'category') return getCategoryColor(item.name)
    return CHART_COLORS[index % CHART_COLORS.length]
  }

  const total = data.reduce((s, d) => s + d.value, 0)
  const outerR = Math.min(160, Math.floor(height * 0.44))
  const innerR = Math.floor(outerR * 0.58)
  // Scale center text so it never overflows the inner hole
  const centerFontSize = innerR >= 50 ? 'text-lg' : innerR >= 35 ? 'text-sm' : 'text-xs'

  // % labels on slices — only for large enough slices and charts
  const renderLabel = height <= 180 ? false : ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // Side-by-side layout: donut left, legend right
  // Shared pie + tooltip JSX (used in both legend and no-legend variants)
  const pieContent = (chartHeight: number) => (
    <div className="relative" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%"
            outerRadius={outerR} innerRadius={innerR}
            strokeWidth={0} label={renderLabel} labelLine={false}
            animationBegin={0} animationDuration={500}
            activeIndex={[]} activeShape={false as any}
          >
            {data.map((item, i) => <Cell key={i} fill={getColor(item, i)} cursor="pointer" />)}
          </Pie>
          <Tooltip
            wrapperStyle={{ zIndex: 50, pointerEvents: 'none', transition: 'none' }}
            allowEscapeViewBox={{ x: true, y: true }}
            offset={15}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              const val = item.value as number
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
              return (
                <div style={{ ...chartTooltipStyle, zIndex: 50 }} className="p-3 rounded-xl shadow-xl">
                  <p className="text-xs text-gray-300 font-medium">{formatCategoryName(String(item.name))}</p>
                  <p className="text-sm text-white font-bold mt-1">{pm(formatCurrency(val))}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pct}% of {pm(formatCurrency(total))}</p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center total */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className={`${centerFontSize} font-bold text-white`}>{pm(formatCurrency(total))}</p>
          {innerR >= 35 && <p className="text-[10px] text-gray-500 mt-0.5">{data.length} items</p>}
        </div>
      </div>
    </div>
  )

  const legendContent = (maxH?: number) => (
    <div className="space-y-1.5 overflow-y-auto pr-1" style={maxH ? { maxHeight: maxH } : undefined}>
      {data.map((item, i) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
        return (
          <div key={item.name} className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: getColor(item, i) }} />
              <span className="text-gray-300 truncate">{formatCategoryName(item.name)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-gray-500 w-10 text-right">{pct}%</span>
              <span className="text-gray-200 font-semibold w-20 text-right">{pm(formatCurrency(item.value))}</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  if (showLegend) {
    return (
      <>
        {/* Mobile: vertical stack */}
        <div className="sm:hidden">
          {pieContent(Math.min(height, 220))}
          <div className="mt-3">{legendContent(180)}</div>
        </div>
        {/* Desktop: side-by-side */}
        <div className="hidden sm:flex gap-4 items-center" style={{ height }}>
          <div className="shrink-0" style={{ width: height, height }}>
            {pieContent(height)}
          </div>
          <div className="flex-1 min-w-0">
            {legendContent(height)}
          </div>
        </div>
      </>
    )
  }

  // No legend — chart only (full width)
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%"
            outerRadius={outerR} innerRadius={innerR}
            strokeWidth={0} label={renderLabel} labelLine={false}
            animationBegin={0} animationDuration={500}
            activeIndex={[]} activeShape={false as any}
          >
            {data.map((item, i) => <Cell key={i} fill={getColor(item, i)} cursor="pointer" />)}
          </Pie>
          <Tooltip
            wrapperStyle={{ zIndex: 50, pointerEvents: 'none', transition: 'none' }}
            allowEscapeViewBox={{ x: true, y: true }}
            offset={15}
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const item = payload[0]
              const val = item.value as number
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0'
              return (
                <div style={{ ...chartTooltipStyle, zIndex: 50 }} className="p-3 rounded-xl shadow-xl">
                  <p className="text-xs text-gray-300 font-medium">{formatCategoryName(String(item.name))}</p>
                  <p className="text-sm text-white font-bold mt-1">{pm(formatCurrency(val))}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pct}% of {pm(formatCurrency(total))}</p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className={`${centerFontSize} font-bold text-white`}>{pm(formatCurrency(total))}</p>
          {innerR >= 35 && <p className="text-[10px] text-gray-500 mt-0.5">{data.length} items</p>}
        </div>
      </div>
    </div>
  )
}
