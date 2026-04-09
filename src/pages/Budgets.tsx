import { useState, useMemo } from 'react'
import { useBudgets } from '../hooks/useBudgets'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency, getCategoryColor, formatCategoryName } from '../lib/engines/utils'

export function Budgets() {
  const { budgets, loading, addBudget, deleteBudget } = useBudgets()
  const { transactions } = useTransactions()
  const [newCategory, setNewCategory] = useState('')
  const [newLimit, setNewLimit] = useState('')

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter((t) => t.date.startsWith(thisMonth) && t.amount > 0).forEach((t) => {
      const cat = t.category || 'Uncategorized'
      map.set(cat, (map.get(cat) || 0) + t.amount)
    })
    return map
  }, [transactions, thisMonth])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategory || !newLimit) return
    await addBudget(newCategory, parseFloat(newLimit))
    setNewCategory('')
    setNewLimit('')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-white">Budgets</h1>

      <form onSubmit={handleAdd} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-5 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. FOOD_AND_DRINK"
            className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Monthly Limit</label>
          <input type="number" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} placeholder="500" min="0" step="0.01"
            className="px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
        </div>
        <button type="submit" className="px-4 py-1.5 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] transition-colors">
          Add Budget
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : budgets.length === 0 ? (
        <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-12 text-center">
          <p className="text-gray-500">No budgets set yet. Add one above to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const spent = spentByCategory.get(budget.category) || 0
            const percent = Math.min((spent / budget.monthly_limit) * 100, 100)
            const over = spent > budget.monthly_limit
            const color = over ? '#ef4444' : getCategoryColor(budget.category)

            return (
              <div key={budget.id} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-white">{formatCategoryName(budget.category)}</span>
                    <span className="text-xs text-gray-500">
                      {formatCurrency(spent)} / {formatCurrency(budget.monthly_limit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {over && <span className="text-xs text-rose-400 font-medium">Over budget</span>}
                    <button onClick={() => deleteBudget(budget.id)} className="text-xs text-gray-600 hover:text-rose-400 transition-colors">Remove</button>
                  </div>
                </div>
                <div className="w-full bg-[#252839] rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
