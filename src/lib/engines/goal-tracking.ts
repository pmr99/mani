import type { Goal } from '../../types/database'
import type { GoalTrackingResult } from '../../types/engines'

export function computeGoalTracking(goals: Goal[]): GoalTrackingResult[] {
  const today = new Date()

  return goals
    .filter((g) => g.is_active)
    .map((goal) => {
      const progressPercent = goal.target_amount > 0
        ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
        : 0

      const gap = Math.max(0, goal.target_amount - goal.current_amount)

      // Months remaining until deadline
      let monthsRemaining: number | null = null
      if (goal.deadline) {
        const deadline = new Date(goal.deadline)
        monthsRemaining = Math.max(
          0,
          (deadline.getFullYear() - today.getFullYear()) * 12 +
            (deadline.getMonth() - today.getMonth())
        )
      }

      // Required monthly contribution to meet goal on time
      let requiredMonthlyContribution = 0
      if (monthsRemaining != null && monthsRemaining > 0) {
        requiredMonthlyContribution = gap / monthsRemaining
      } else if (monthsRemaining === 0 && gap > 0) {
        requiredMonthlyContribution = gap // need it all now
      }

      // Feasibility assessment
      let feasibility: 'on_track' | 'at_risk' | 'behind'
      if (gap <= 0) {
        feasibility = 'on_track' // goal reached
      } else if (monthsRemaining == null) {
        // No deadline — assess based on contribution rate
        feasibility = goal.monthly_contribution > 0 ? 'on_track' : 'at_risk'
      } else if (goal.monthly_contribution >= requiredMonthlyContribution * 0.9) {
        feasibility = 'on_track'
      } else if (goal.monthly_contribution >= requiredMonthlyContribution * 0.5) {
        feasibility = 'at_risk'
      } else {
        feasibility = 'behind'
      }

      return {
        goalId: goal.id,
        name: goal.name,
        type: goal.type,
        targetAmount: goal.target_amount,
        currentAmount: goal.current_amount,
        progressPercent: Math.round(progressPercent * 10) / 10,
        monthsRemaining,
        requiredMonthlyContribution: Math.round(requiredMonthlyContribution * 100) / 100,
        currentMonthlyContribution: goal.monthly_contribution,
        feasibility,
        gap: Math.round(gap * 100) / 100,
      }
    })
}
