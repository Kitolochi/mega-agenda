import { useState } from 'react'
import { useNetworkStore } from '../../store'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  onConnected: () => void
}

export default function DiscordAuthDialog({ open, onClose, onConnected }: Props) {
  const { connectProvider } = useNetworkStore()
  const [botToken, setBotToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    if (!botToken.trim()) {
      setError('Please enter your bot token')
      return
    }
    setConnecting(true)
    setError('')
    try {
      await connectProvider('discord', { botToken: botToken.trim() })
      onConnected()
    } catch (err: any) {
      setError(err.message || 'Failed to connect')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="glass-card rounded-xl p-6 w-[420px]">
        <h3 className="text-sm font-semibold text-white/90 mb-1">Connect Discord</h3>
        <p className="text-xs text-muted mb-4">
          Create a Discord bot at{' '}
          <span className="text-accent-blue cursor-pointer" onClick={() => window.electronAPI.openExternal('https://discord.com/developers/applications')}>
            discord.com/developers
          </span>
          {' '}and paste the bot token below.
        </p>

        <Input
          label="Bot Token"
          type="password"
          value={botToken}
          onChange={(e) => { setBotToken(e.target.value); setError('') }}
          placeholder="MTIz..."
        />

        {error && (
          <p className="text-xs text-accent-red mt-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConnect}
            loading={connecting}
            disabled={!botToken.trim()}
          >
            Connect
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
