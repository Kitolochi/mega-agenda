import { useState } from 'react'
import { SocialConnection, SocialProvider } from '../../types'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

const PROVIDER_META: Record<SocialProvider, { name: string; icon: string; color: string; badgeVariant: 'blue' | 'purple' | 'emerald' | 'amber' }> = {
  telegram: { name: 'Telegram', icon: '✈', color: '#229ED9', badgeVariant: 'blue' },
  discord: { name: 'Discord', icon: '🎮', color: '#5865F2', badgeVariant: 'purple' },
  twitter: { name: 'Twitter', icon: '𝕏', color: '#1DA1F2', badgeVariant: 'blue' },
  sms: { name: 'SMS', icon: '💬', color: '#22C55E', badgeVariant: 'emerald' },
}

interface Props {
  provider: SocialProvider
  connection: SocialConnection | null
  syncing: boolean
  onConnect: () => void
  onDisconnect: (id: string) => void
  onSync: (id: string) => void
  onDelete: (id: string) => void
}

export default function SocialConnectionCard({
  provider,
  connection,
  syncing,
  onConnect,
  onDisconnect,
  onSync,
  onDelete,
}: Props) {
  const meta = PROVIDER_META[provider]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isConnected = connection?.status === 'connected'
  const isError = connection?.status === 'error'

  const statusBadge = () => {
    if (syncing) return <Badge variant="amber">Syncing...</Badge>
    if (!connection) return <Badge>Not connected</Badge>
    if (isConnected) return <Badge variant="emerald">Connected</Badge>
    if (isError) return <Badge variant="red">Error</Badge>
    return <Badge>Disconnected</Badge>
  }

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white/90">{meta.name}</span>
            {statusBadge()}
          </div>
          {connection?.accountName && (
            <p className="text-xs text-muted truncate">{connection.accountName}</p>
          )}
        </div>
      </div>

      {/* Last sync */}
      {connection?.lastSyncAt && (
        <p className="text-[10px] text-muted">
          Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 mt-auto">
        {!connection ? (
          <Button variant="primary" size="xs" onClick={onConnect} className="flex-1">
            Connect
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              size="xs"
              onClick={() => onSync(connection.id)}
              loading={syncing}
              disabled={syncing || connection.status === 'disconnected'}
              className="flex-1"
            >
              Sync Now
            </Button>
            {confirmDelete ? (
              <div className="flex gap-1">
                <Button variant="danger" size="xs" onClick={() => { onDelete(connection.id); setConfirmDelete(false) }}>
                  Confirm
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="xs" onClick={() => onDisconnect(connection.id)}>
                  Disconnect
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setConfirmDelete(true)}>
                  ✕
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
