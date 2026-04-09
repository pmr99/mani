import { useState, useMemo } from 'react'
import { useGoals } from '../hooks/useGoals'
import { computeGoalTracking } from '../lib/engines/goal-tracking'
import { formatCurrency } from '../lib/engines/utils'

const GOAL_TYPES = ['general', 'emergency', 'retirement', 'house', 'car', 'vacation', 'debt']

const FEASIBILITY_STYLES = {
  on_track: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  at_risk: { bg: 'bg-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500' },
  behind: { bg: 'bg-rose-500/20', text: 'text-rose-400', bar: 'bg-rose-500' },
}

export function Goals() {
  const { goals, loading, addGoal, deleteGoal } = useGoals()
  const [name, setName] = useState('')
  const [type, setType] = useState('general')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [contribution, setContribution] = useState('')

  const goalResults = useMemo(() => computeGoalTracking(goals), [goals])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !target) return
    await addGoal({
      name, type, target_amount: parseFloat(target),
      deadline: deadline || null,
      monthly_contribution: contribution ? parseFloat(contribution) : 0,
    })
    setName(''); setTarget(''); setDeadline(''); setContribution('')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-white">Goals</h1>

      <form onSubmit={handleAdd} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Goal name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund"
              className="w-full px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50">
              {GOAL_TYPES.map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target amount</label>
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" min="0" step="0.01"
              className="w-full px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Monthly contribution</label>
            <input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="500" min="0" step="0.01"
              className="w-full px-3 py-1.5 text-sm border border-[#2a2d3d] rounded-lg bg-[#252839] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full px-4 py-1.5 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-[#5558e6] transition-colors">
              Add Goal
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : goalResults.length === 0 ? (
        <div className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-12 text-center">
          <p className="text-gray-500">No goals yet. Add one above to start tracking.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goalResults.map((g) => {
            const s = FEASIBILITY_STYLES[g.feasibility]
            return (
              <div key={g.goalId} className="bg-[#1a1d29] border border-[#2a2d3d] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{g.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{g.feasibility.replace('_', ' ')}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#252839] text-gray-400">{g.type}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(g.currentAmount)} of {formatCurrency(g.targetAmount)}
                      {g.monthsRemaining != null && ` \u2022 ${g.monthsRemaining} months remaining`}
                    </p>
                  </div>
                  <button onClick={() => deleteGoal(g.goalId)} className="text-xs text-gray-600 hover:text-rose-400 transition-colors">Remove</button>
                </div>

                <div className="w-full bg-[#252839] rounded-full h-2.5 mb-3">
                  <div className={`h-2.5 rounded-full ${s.bar} transition-all`} style={{ width: `${Math.min(100, g.progressPercent)}%` }} />
                </div>

                <div className="flex gap-6 text-xs text-gray-500">
                  <div><span className="text-gray-600">Progress:</span> <span className="font-medium text-gray-300">{g.progressPercent}%</span></div>
                  <div><span className="text-gray-600">Contributing:</span> <span className="font-medium text-gray-300">{formatCurrency(g.currentMonthlyContribution)}/mo</span></div>
                  {g.requiredMonthlyContribution > 0 && g.monthsRemaining != null && (
                    <div><span className="text-gray-600">Needed:</span> <span className="font-medium text-gray-300">{formatCurrency(g.requiredMonthlyContribution)}/mo</span></div>
                  )}
                  <div><span className="text-gray-600">Gap:</span> <span className="font-medium text-gray-300">{formatCurrency(g.gap)}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
