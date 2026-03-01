import { useState, useEffect, useCallback } from 'react'
import { TwitterSettings as TwitterSettingsType } from '../../types'

const inputClass = "w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 focus:bg-surface-3 transition-all placeholder-muted/50"

export default function TwitterSettings() {
  const [twitterSettings, setTwitterSettings] = useState<TwitterSettingsType | null>(null)
  const [twApiKey, setTwApiKey] = useState('')
  const [twApiSecret, setTwApiSecret] = useState('')
  const [twAccessToken, setTwAccessToken] = useState('')
  const [twAccessSecret, setTwAccessSecret] = useState('')
  const [twVerifying, setTwVerifying] = useState(false)
  const [twError, setTwError] = useState<string | null>(null)
  const [twUsername, setTwUsername] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const tw = await window.electronAPI.getTwitterSettings()
    setTwitterSettings(tw)
    if (tw.apiKey) setTwUsername('connected')
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveTwitter = async () => {
    if (!twApiKey.trim() || !twApiSecret.trim() || !twAccessToken.trim() || !twAccessSecret.trim()) return
    setTwVerifying(true)
    setTwError(null)
    await window.electronAPI.saveTwitterSettings({
      apiKey: twApiKey.trim(),
      apiSecret: twApiSecret.trim(),
      accessToken: twAccessToken.trim(),
      accessTokenSecret: twAccessSecret.trim(),
    })
    const result = await window.electronAPI.verifyTwitterOAuth()
    if (result.valid) {
      setTwUsername(result.username || 'connected')
      setTwitterSettings(await window.electronAPI.getTwitterSettings())
      setTwError(null)
    } else {
      setTwError(result.error || 'Invalid credentials')
      await window.electronAPI.saveTwitterSettings({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' })
    }
    setTwVerifying(false)
  }

  const handleRemoveTwitter = async () => {
    await window.electronAPI.saveTwitterSettings({ apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '' })
    setTwitterSettings(await window.electronAPI.getTwitterSettings())
    setTwUsername(null)
    setTwApiKey('')
    setTwApiSecret('')
    setTwAccessToken('')
    setTwAccessSecret('')
  }

  return (
    <div className="mb-6">
      <label className="block text-[10px] uppercase tracking-widest text-muted font-display font-medium mb-2">Twitter / X Posting</label>
      {twitterSettings?.apiKey ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass-card">
          <svg className="w-3.5 h-3.5 text-accent-blue shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span className="text-[11px] text-white/60 flex-1">
            {twUsername && twUsername !== 'connected' ? `@${twUsername}` : 'Connected'}
          </span>
          <button onClick={handleRemoveTwitter} className="text-[10px] text-muted hover:text-accent-red transition-colors">Remove</button>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="password" value={twApiKey} onChange={e => setTwApiKey(e.target.value)} placeholder="API Key (Consumer Key)" className={inputClass} />
          <input type="password" value={twApiSecret} onChange={e => setTwApiSecret(e.target.value)} placeholder="API Secret (Consumer Secret)" className={inputClass} />
          <input type="password" value={twAccessToken} onChange={e => setTwAccessToken(e.target.value)} placeholder="Access Token" className={inputClass} />
          <input type="password" value={twAccessSecret} onChange={e => setTwAccessSecret(e.target.value)} placeholder="Access Token Secret" className={inputClass} />
          {twError && <p className="text-[10px] text-accent-red">{twError}</p>}
          <button
            onClick={handleSaveTwitter}
            disabled={!twApiKey.trim() || !twApiSecret.trim() || !twAccessToken.trim() || !twAccessSecret.trim() || twVerifying}
            className="w-full py-2 bg-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-30 rounded-lg text-xs text-accent-blue font-medium transition-all"
          >
            {twVerifying ? 'Verifying...' : 'Save Credentials'}
          </button>
        </div>
      )}
      <p className="text-[10px] text-muted/50 mt-1.5">Get credentials from developer.x.com (free tier allows 1,500 tweets/month)</p>
    </div>
  )
}
