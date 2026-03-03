import { useState, useEffect } from 'react'
import { useNetworkStore } from '../../store'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface Props {
  open: boolean
  onClose: () => void
  onConnected: () => void
}

export default function SMSSetupDialog({ open, onClose, onConnected }: Props) {
  const { connectProvider } = useNetworkStore()
  const [dbPath, setDbPath] = useState('')
  const [detecting, setDetecting] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    // Auto-detect Phone Link DB
    const detect = async () => {
      try {
        const result = await window.electronAPI.smsDetectDb()
        if (result.found && result.path) {
          setDbPath(result.path)
        }
      } catch {
        // ignore
      } finally {
        setDetecting(false)
      }
    }
    detect()
  }, [open])

  const handleConnect = async () => {
    if (!dbPath.trim()) {
      setError('Please enter the database path')
      return
    }
    setConnecting(true)
    setError('')
    try {
      await connectProvider('sms', { dbPath: dbPath.trim() })
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
        <h3 className="text-sm font-semibold text-white/90 mb-1">SMS via Phone Link</h3>
        <p className="text-xs text-muted mb-4">
          Import contacts and messages from Windows Phone Link.
        </p>

        {detecting ? (
          <p className="text-xs text-muted">Detecting Phone Link database...</p>
        ) : (
          <>
            <Input
              label="Phone Link Database Path"
              value={dbPath}
              onChange={(e) => { setDbPath(e.target.value); setError('') }}
              placeholder="C:\Users\...\PhoneLinkSMS.db"
            />
            {dbPath && (
              <p className="text-[10px] text-accent-emerald mt-1">Database detected</p>
            )}
            {!dbPath && (
              <p className="text-[10px] text-muted mt-1">
                Could not auto-detect. Paste the path to your PhoneLinkSMS.db file.
              </p>
            )}

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
                disabled={!dbPath.trim()}
              >
                Connect
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
