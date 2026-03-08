import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAgentStore } from '../../store'
import AgentCard from './AgentCard'
import AgentForm from './AgentForm'
import AgentIssueBoard from './AgentIssueBoard'
import CostDashboard from './CostDashboard'
import HeartbeatHistory from './HeartbeatHistory'

const SUB_VIEWS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'issues' as const, label: 'Issues' },
  { id: 'costs' as const, label: 'Costs' },
  { id: 'history' as const, label: 'History' },
]

export default function AgentsTab() {
  const {
    agents, subView, showForm, editingAgent,
    setSubView, setShowForm, setEditingAgent, loadAll,
  } = useAgentStore()

  useEffect(() => {
    loadAll()
    const unsub = window.electronAPI.onAgentsUpdated(() => loadAll())
    return unsub
  }, [loadAll])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Agents</h1>
          <p className="text-sm text-white/40 mt-1">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={() => { setEditingAgent(null); setShowForm(true) }}
          className="px-4 py-2 bg-accent-blue/20 hover:bg-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium transition-colors"
        >
          + New Agent
        </button>
      </div>

      {/* Sub-view tabs */}
      <div className="flex gap-1 p-1 bg-surface-1/50 rounded-lg w-fit">
        {SUB_VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setSubView(v.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subView === v.id
                ? 'bg-surface-3 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subView === 'overview' && (
        <div className="space-y-4">
          {agents.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <p className="text-lg mb-2">No agents yet</p>
              <p className="text-sm">Create an agent to get started with autonomous task execution.</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      )}
      {subView === 'issues' && <AgentIssueBoard />}
      {subView === 'costs' && <CostDashboard />}
      {subView === 'history' && <HeartbeatHistory />}

      {/* Agent Form Dialog — portal to body to escape backdrop-filter containing block */}
      {showForm && createPortal(
        <AgentForm
          agent={editingAgent}
          onClose={() => { setShowForm(false); setEditingAgent(null) }}
        />,
        document.body
      )}
    </div>
  )
}
