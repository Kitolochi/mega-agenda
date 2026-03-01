import { useState } from 'react'
import type { BankConnection } from '../../types'

interface ConnectionStatusProps {
  connection: BankConnection
  onSync: (id: string) => Promise<void>
  onDelete: (id: string) => void
}

export default function ConnectionStatus({ connection, onSync, onDelete }: ConnectionStatusProps) {
  const [syncing, setSyncing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await onSync(connection.id)
    } finally {
      setSyncing(false)
    }
  }

  const statusColors = {
    active: 'bg-accent-emerald/20 text-accent-emerald',
    error: 'bg-accent-red/20 text-accent-red',
    disconnected: 'bg-muted/20 text-muted',
  }

  const statusDot = {
    active: 'bg-accent-emerald',
    error: 'bg-accent-red',
    disconnected: 'bg-muted',
  }

  const lastSynced = connection.lastSynced
    ? formatTimeAgo(new Date(connection.lastSynced))
    : 'Never'

  return (
    <div className="bg-surface-2/50 border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${statusDot[connection.status]}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white capitalize">{connection.provider === 'simplefin' ? 'SimpleFIN' : 'Teller'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[connection.status]}`}>
                {connection.status}
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Last synced: {lastSynced}
            </p>
            {connection.errorMessage && (
              <p className="text-xs text-accent-red/80 mt-0.5">{connection.errorMessage}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSync}
            disabled={syncing || connection.status === 'disconnected'}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-30"
            title="Sync now"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(connection.id)}
                className="px-2 py-1 rounded text-[10px] font-medium bg-accent-red/20 text-accent-red hover:bg-accent-red/30 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded text-[10px] font-medium text-muted hover:text-white transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-lg text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
              title="Disconnect"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
