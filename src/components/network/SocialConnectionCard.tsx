import { useState } from 'react'
import { SocialConnection, SocialProvider } from '../../types'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Dialog from '../ui/Dialog'

const PROVIDER_META: Record<SocialProvider, { name: string; icon: string; color: string; badgeVariant: 'blue' | 'purple' | 'emerald' | 'amber' }> = {
  telegram: { name: 'Telegram', icon: '✈', color: '#229ED9', badgeVariant: 'blue' },
  discord: { name: 'Discord', icon: '🎮', color: '#5865F2', badgeVariant: 'purple' },
  twitter: { name: 'Twitter', icon: '𝕏', color: '#1DA1F2', badgeVariant: 'blue' },
  sms: { name: 'SMS', icon: '💬', color: '#22C55E', badgeVariant: 'emerald' },
}

const PROVIDER_SETUP_INFO: Record<SocialProvider, { title: string; steps: string[]; note?: string }> = {
  sms: {
    title: 'SMS via Phone Link',
    steps: [
      'Install the Windows Phone Link app and pair it with your phone.',
      'Phone Link stores SMS in a local SQLite database on your machine.',
      'Click Connect — the setup will auto-detect the database path, or you can paste it manually.',
      'Hit "Sync Now" to import contacts and messages. It reads the DB directly — no API keys needed.',
    ],
    note: 'Read-only import. No messages are sent — only existing SMS history is pulled in.',
  },
  discord: {
    title: 'Discord Bot Setup',
    steps: [
      'Go to discord.com/developers and create a new Application.',
      'Navigate to the Bot tab and click "Reset Token" to get your bot token.',
      'Under OAuth2 → URL Generator, select "bot" scope with "Read Messages/View Channels" and "Read Message History" permissions.',
      'Use the generated URL to invite the bot to your servers.',
      'Paste the bot token in the connect dialog.',
    ],
    note: 'The bot imports server members and DM history. It only reads — never sends messages.',
  },
  twitter: {
    title: 'Twitter / X Sync',
    steps: [
      'This uses the OAuth credentials you already configured in Settings.',
      'No new setup needed — just click Connect.',
      'Sync fetches your followers, accounts you follow, and recent DMs.',
    ],
    note: 'Requires Twitter OAuth 1.0a to be set up in Settings → Twitter. If you haven\'t done that yet, go there first.',
  },
  telegram: {
    title: 'Telegram Setup',
    steps: [
      'Go to my.telegram.org and log in with your phone number.',
      'Navigate to "API development tools" and create a new app.',
      'Copy the api_id (number) and api_hash (string) from the app page.',
      'Enter those credentials plus your phone number and click "Send Code".',
      'Telegram sends a verification code to your Telegram app — enter it to connect.',
    ],
    note: 'Your session is saved locally so you only need to verify once. Sync pulls your contacts and recent DMs.',
  },
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
  const [showInfo, setShowInfo] = useState(false)
  const isConnected = connection?.status === 'connected'
  const isError = connection?.status === 'error'

  const statusBadge = () => {
    if (syncing) return <Badge variant="amber">Syncing...</Badge>
    if (!connection) return <Badge>Not connected</Badge>
    if (isConnected) return <Badge variant="emerald">Connected</Badge>
    if (isError) return <Badge variant="red">Error</Badge>
    return <Badge>Disconnected</Badge>
  }

  const info = PROVIDER_SETUP_INFO[provider]

  return (
    <>
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
          {/* Info button */}
          <button
            onClick={() => setShowInfo(true)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-white/70 hover:bg-white/[0.06] transition-all text-xs"
            title="How to set up"
          >
            ?
          </button>
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

      {/* Setup info dialog */}
      {showInfo && (
        <Dialog open={showInfo} onClose={() => setShowInfo(false)}>
          <div className="glass-card rounded-xl p-6 w-[440px]">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
              >
                {meta.icon}
              </div>
              <h3 className="text-sm font-semibold text-white/90">{info.title}</h3>
            </div>

            <ol className="space-y-2.5 mb-4">
              {info.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-white/75">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold mt-px"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            {info.note && (
              <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[11px] text-muted leading-relaxed">
                  <span className="text-white/50 font-medium">Note: </span>
                  {info.note}
                </p>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button variant="ghost" size="sm" onClick={() => setShowInfo(false)}>
                Got it
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}
