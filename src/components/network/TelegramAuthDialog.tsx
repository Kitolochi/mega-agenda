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

type Step = 'credentials' | 'otp'

export default function TelegramAuthDialog({ open, onClose, onConnected }: Props) {
  const { connectProvider } = useNetworkStore()

  const [step, setStep] = useState<Step>('credentials')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [phoneCodeHash, setPhoneCodeHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendCode = async () => {
    if (!apiId || !apiHash || !phone) {
      setError('All fields are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.telegramSendCode(phone, parseInt(apiId), apiHash)
      setPhoneCodeHash(result.phoneCodeHash)
      setStep('otp')
    } catch (err: any) {
      setError(err.message || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!code) {
      setError('Please enter the verification code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await window.electronAPI.telegramVerifyCode(
        phone, code, phoneCodeHash, parseInt(apiId), apiHash
      )
      // Create the social connection with the session
      await connectProvider('telegram', {
        session: result.session,
        apiId: parseInt(apiId),
        apiHash,
        accountId: result.accountId,
        accountName: result.accountName,
      })
      onConnected()
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="glass-card rounded-xl p-6 w-[420px]">
        <h3 className="text-sm font-semibold text-white/90 mb-1">Connect Telegram</h3>
        <p className="text-xs text-muted mb-4">
          {step === 'credentials'
            ? <>Get API credentials from <span className="text-accent-blue cursor-pointer" onClick={() => window.electronAPI.openExternal('https://my.telegram.org')}>my.telegram.org</span></>
            : 'Enter the verification code sent to your Telegram.'
          }
        </p>

        {step === 'credentials' && (
          <div className="space-y-3">
            <Input
              label="API ID"
              value={apiId}
              onChange={(e) => { setApiId(e.target.value); setError('') }}
              placeholder="12345678"
            />
            <Input
              label="API Hash"
              type="password"
              value={apiHash}
              onChange={(e) => { setApiHash(e.target.value); setError('') }}
              placeholder="a1b2c3d4e5f6..."
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError('') }}
              placeholder="+1234567890"
            />
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <p className="text-xs text-white/70">
              A code was sent to <span className="text-white/90 font-medium">{phone}</span>
            </p>
            <Input
              label="Verification Code"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError('') }}
              placeholder="12345"
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-accent-red mt-2">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          {step === 'credentials' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSendCode}
              loading={loading}
              disabled={!apiId || !apiHash || !phone}
            >
              Send Code
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleVerify}
              loading={loading}
              disabled={!code}
            >
              Verify
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  )
}
