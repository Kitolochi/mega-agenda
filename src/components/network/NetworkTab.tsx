import { useEffect } from 'react'
import { useNetworkStore } from '../../store'
import LoadingSpinner from '../ui/LoadingSpinner'
import ContactList from './ContactList'
import ContactDetail from './ContactDetail'
import PipelineBoard from './PipelineBoard'

export default function NetworkTab() {
  const { view, setView, loading, loadData } = useNetworkStore()

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* View toggle header */}
      {view !== 'contact-detail' && (
        <div className="flex items-center gap-1 px-6 pt-4 pb-2">
          <button
            onClick={() => setView('contacts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === 'contacts'
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-muted hover:text-white/70 hover:bg-white/[0.06]'
            }`}
          >
            Contacts
          </button>
          <button
            onClick={() => setView('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              view === 'pipeline'
                ? 'bg-accent-blue/20 text-accent-blue'
                : 'text-muted hover:text-white/70 hover:bg-white/[0.06]'
            }`}
          >
            Pipeline
          </button>
        </div>
      )}

      {/* View content */}
      <div className="flex-1 overflow-auto">
        {view === 'contacts' && <ContactList />}
        {view === 'contact-detail' && <ContactDetail />}
        {view === 'pipeline' && <PipelineBoard />}
      </div>
    </div>
  )
}
