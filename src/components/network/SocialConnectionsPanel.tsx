import { useState } from 'react'
import { useNetworkStore } from '../../store'
import { SocialProvider } from '../../types'
import SocialConnectionCard from './SocialConnectionCard'
import TelegramAuthDialog from './TelegramAuthDialog'
import DiscordAuthDialog from './DiscordAuthDialog'
import SMSSetupDialog from './SMSSetupDialog'

const PROVIDERS: SocialProvider[] = ['sms', 'discord', 'twitter', 'telegram']

export default function SocialConnectionsPanel() {
  const {
    socialConnections,
    syncingProviders,
    disconnectProvider,
    syncProvider,
    deleteConnection,
    loadData,
  } = useNetworkStore()

  const [authDialog, setAuthDialog] = useState<SocialProvider | null>(null)
  const [syncResult, setSyncResult] = useState<{ provider: string; newContacts: number; newInteractions: number } | null>(null)

  const getConnection = (provider: SocialProvider) =>
    socialConnections.find(c => c.provider === provider) || null

  const handleConnect = (provider: SocialProvider) => {
    if (provider === 'twitter') {
      // Twitter uses existing OAuth — just create connection and sync
      handleTwitterConnect()
    } else {
      setAuthDialog(provider)
    }
  }

  const handleTwitterConnect = async () => {
    try {
      const result = await window.electronAPI.twitterSyncContacts()
      await loadData()
      setSyncResult({ provider: 'twitter', ...result })
      setTimeout(() => setSyncResult(null), 5000)
    } catch (err: any) {
      console.error('Twitter connect failed:', err)
    }
  }

  const handleSync = async (connectionId: string) => {
    try {
      const conn = socialConnections.find(c => c.id === connectionId)
      const result = await syncProvider(connectionId)
      setSyncResult({ provider: conn?.provider || '', ...result })
      setTimeout(() => setSyncResult(null), 5000)
    } catch (err: any) {
      console.error('Sync failed:', err)
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    await disconnectProvider(connectionId)
  }

  const handleDelete = async (connectionId: string) => {
    await deleteConnection(connectionId)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white/90">Social Connections</h2>
        <p className="text-xs text-muted mt-1">
          Connect your messaging platforms to auto-import contacts and conversations.
        </p>
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className="mb-4 p-3 rounded-lg bg-accent-emerald/10 border border-accent-emerald/20">
          <p className="text-xs text-accent-emerald">
            Synced {syncResult.provider}: {syncResult.newContacts} contacts, {syncResult.newInteractions} interactions imported.
          </p>
        </div>
      )}

      {/* Provider grid */}
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map(provider => (
          <SocialConnectionCard
            key={provider}
            provider={provider}
            connection={getConnection(provider)}
            syncing={syncingProviders.has(provider)}
            onConnect={() => handleConnect(provider)}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Auth dialogs */}
      {authDialog === 'telegram' && (
        <TelegramAuthDialog
          open={true}
          onClose={() => setAuthDialog(null)}
          onConnected={async () => {
            setAuthDialog(null)
            await loadData()
          }}
        />
      )}
      {authDialog === 'discord' && (
        <DiscordAuthDialog
          open={true}
          onClose={() => setAuthDialog(null)}
          onConnected={async () => {
            setAuthDialog(null)
            await loadData()
          }}
        />
      )}
      {authDialog === 'sms' && (
        <SMSSetupDialog
          open={true}
          onClose={() => setAuthDialog(null)}
          onConnected={async () => {
            setAuthDialog(null)
            await loadData()
          }}
        />
      )}
    </div>
  )
}
