import { useState, useEffect } from 'react'
import { cn } from '../utils/cn'

// ============================================================
// Types
// ============================================================

interface OutreachSettingsData {
  google_places_api_key: string
  apollo_api_key: string
  default_lat: string
  default_lng: string
  default_radius: string
  resume_link: string
  onboarding_completed: string
  gws_installed: string
  gws_authenticated: string
  gws_user_email: string
}

interface SeedProgress {
  category: string
  categoryIndex: number
  totalCategories: number
  imported: number
  totalImported: number
}

// ============================================================
// Onboarding Wizard
// ============================================================

type WizardStep = 'welcome' | 'api-keys' | 'location' | 'resume' | 'seed' | 'tips' | 'done'

const WIZARD_STEPS: WizardStep[] = ['welcome', 'api-keys', 'location', 'resume', 'seed', 'tips', 'done']

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome')
  const [settings, setSettings] = useState<OutreachSettingsData>({
    google_places_api_key: '',
    apollo_api_key: '',
    default_lat: '35.2271',
    default_lng: '-80.8431',
    default_radius: '25000',
    resume_link: '',
    onboarding_completed: 'false',
    gws_installed: '',
    gws_authenticated: '',
    gws_user_email: '',
  })
  const [googleKeyStatus, setGoogleKeyStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [apolloKeyStatus, setApolloKeyStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [validating, setValidating] = useState<'google' | 'apollo' | null>(null)
  const [seedProgress, setSeedProgress] = useState<SeedProgress | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<{ totalImported: number; categories: number } | null>(null)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getOutreachSettings().then(setSettings)
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onSeedProgress((data) => {
      setSeedProgress(data)
    })
    return unsub
  }, [])

  const stepIndex = WIZARD_STEPS.indexOf(step)

  const saveSetting = async (key: keyof OutreachSettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.electronAPI.setOutreachSetting(key, value)
  }

  const validateGoogleKey = async () => {
    if (!settings.google_places_api_key.trim()) return
    setValidating('google')
    setGoogleKeyStatus(null)
    try {
      const result = await window.electronAPI.validateApiKey('google_places', settings.google_places_api_key)
      setGoogleKeyStatus(result)
    } catch (err: any) {
      setGoogleKeyStatus({ valid: false, message: err.message || 'Validation failed' })
    } finally {
      setValidating(null)
    }
  }

  const validateApolloKey = async () => {
    if (!settings.apollo_api_key.trim()) return
    setValidating('apollo')
    setApolloKeyStatus(null)
    try {
      const result = await window.electronAPI.validateApiKey('apollo', settings.apollo_api_key)
      setApolloKeyStatus(result)
    } catch (err: any) {
      setApolloKeyStatus({ valid: false, message: err.message || 'Validation failed' })
    } finally {
      setValidating(null)
    }
  }

  const runSeed = async () => {
    setSeeding(true)
    setSeedError(null)
    setSeedResult(null)
    setSeedProgress(null)
    try {
      const result = await window.electronAPI.runSeedDiscovery()
      setSeedResult(result)
    } catch (err: any) {
      setSeedError(err.message || 'Seeding failed')
    } finally {
      setSeeding(false)
    }
  }

  const finishOnboarding = async () => {
    await window.electronAPI.setOutreachSetting('onboarding_completed', 'true')
    onComplete()
  }

  const goNext = () => {
    const idx = WIZARD_STEPS.indexOf(step)
    if (idx < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[idx + 1])
  }

  const goBack = () => {
    const idx = WIZARD_STEPS.indexOf(step)
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-white/[0.08] rounded-2xl shadow-2xl w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-5">
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1 rounded-full flex-1 transition-all duration-300',
                i <= stepIndex ? 'bg-accent-emerald' : 'bg-surface-3'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-emerald/30 to-accent-blue/30 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-display font-semibold text-white">Welcome to Outreach</h2>
              <p className="text-sm text-white/60 leading-relaxed max-w-md mx-auto">
                Discover local businesses, find decision-makers, and send personalized
                outreach messages. Let's get you set up in a few quick steps.
              </p>
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Configure API keys
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Set your location
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Auto-populate 50+ businesses
                </div>
              </div>
            </div>
          )}

          {step === 'api-keys' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">API Keys</h3>
                <p className="text-xs text-white/40">Connect to Google Places and Apollo.io for business discovery and contact enrichment.</p>
              </div>

              {/* Google Places */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/60 font-medium">Google Places API Key</label>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://console.cloud.google.com/apis/credentials')}
                    className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                  >
                    Get a key
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings.google_places_api_key}
                    onChange={e => saveSetting('google_places_api_key', e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
                  />
                  <button
                    onClick={validateGoogleKey}
                    disabled={!settings.google_places_api_key.trim() || validating === 'google'}
                    className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-white/70 hover:text-white transition-all disabled:opacity-40"
                  >
                    {validating === 'google' ? 'Checking...' : 'Validate'}
                  </button>
                </div>
                {googleKeyStatus && (
                  <div className={cn('text-[10px] px-2 py-1 rounded', googleKeyStatus.valid ? 'text-accent-emerald bg-accent-emerald/10' : 'text-red-400 bg-red-400/10')}>
                    {googleKeyStatus.message}
                  </div>
                )}
              </div>

              {/* Apollo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-white/60 font-medium">Apollo.io API Key</label>
                  <button
                    onClick={() => window.electronAPI.openExternal('https://app.apollo.io/#/settings/integrations/api')}
                    className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                  >
                    Get a key
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={settings.apollo_api_key}
                    onChange={e => saveSetting('apollo_api_key', e.target.value)}
                    placeholder="apollo-api-..."
                    className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
                  />
                  <button
                    onClick={validateApolloKey}
                    disabled={!settings.apollo_api_key.trim() || validating === 'apollo'}
                    className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-white/70 hover:text-white transition-all disabled:opacity-40"
                  >
                    {validating === 'apollo' ? 'Checking...' : 'Validate'}
                  </button>
                </div>
                {apolloKeyStatus && (
                  <div className={cn('text-[10px] px-2 py-1 rounded', apolloKeyStatus.valid ? 'text-accent-emerald bg-accent-emerald/10' : 'text-red-400 bg-red-400/10')}>
                    {apolloKeyStatus.message}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-white/30">
                Google Places is required for business discovery. Apollo is optional (used for contact enrichment).
              </p>
            </div>
          )}

          {step === 'location' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">Default Location</h3>
                <p className="text-xs text-white/40">Set your target area for business discovery. Charlotte metro is pre-filled.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/60 font-medium mb-1 block">Latitude</label>
                  <input
                    type="text"
                    value={settings.default_lat}
                    onChange={e => saveSetting('default_lat', e.target.value)}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-medium mb-1 block">Longitude</label>
                  <input
                    type="text"
                    value={settings.default_lng}
                    onChange={e => saveSetting('default_lng', e.target.value)}
                    className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-medium mb-1 block">Search Radius (meters)</label>
                <input
                  type="text"
                  value={settings.default_radius}
                  onChange={e => saveSetting('default_radius', e.target.value)}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                />
                <p className="text-[10px] text-white/30 mt-1">25000m (~15 miles) covers the Charlotte metro area</p>
              </div>

              <button
                onClick={() => {
                  saveSetting('default_lat', '35.2271')
                  saveSetting('default_lng', '-80.8431')
                  saveSetting('default_radius', '25000')
                }}
                className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Reset to Charlotte defaults
              </button>
            </div>
          )}

          {step === 'resume' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">Resume / Portfolio Link</h3>
                <p className="text-xs text-white/40">This link will be included in your outreach messages so prospects can learn more about you.</p>
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-medium mb-1 block">Resume Link URL</label>
                <input
                  type="url"
                  value={settings.resume_link}
                  onChange={e => saveSetting('resume_link', e.target.value)}
                  placeholder="https://your-site.com/resume"
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
                />
              </div>

              <p className="text-[10px] text-white/30">
                You can change this later in the outreach settings.
              </p>
            </div>
          )}

          {step === 'seed' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-display font-semibold text-white mb-1">Populate Businesses</h3>
                <p className="text-xs text-white/40">
                  Search 9 high-value categories in the Charlotte metro area to pre-load your pipeline with 50+ businesses.
                </p>
              </div>

              <div className="bg-surface-2/50 rounded-xl p-3 space-y-1">
                <div className="text-[10px] text-white/50 font-medium mb-2">Categories to search:</div>
                <div className="flex flex-wrap gap-1.5">
                  {['Marketing agencies', 'Real estate firms', 'Law offices', 'Dental practices', 'Medical practices', 'Restaurants', 'Construction companies', 'Accounting firms', 'IT services'].map(cat => (
                    <span key={cat} className="text-[9px] px-2 py-1 rounded-md bg-surface-3 text-white/50">{cat}</span>
                  ))}
                </div>
              </div>

              {!seeding && !seedResult && !seedError && (
                <button
                  onClick={runSeed}
                  disabled={!settings.google_places_api_key.trim()}
                  className="w-full px-4 py-2.5 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium border border-accent-emerald/20 hover:bg-accent-emerald/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {settings.google_places_api_key.trim() ? 'Start Discovery' : 'Google Places API key required'}
                </button>
              )}

              {seeding && seedProgress && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin text-accent-emerald" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs text-white/70">
                      Searching: {seedProgress.category} ({seedProgress.categoryIndex}/{seedProgress.totalCategories})
                    </span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-emerald rounded-full transition-all duration-500"
                      style={{ width: `${(seedProgress.categoryIndex / seedProgress.totalCategories) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-white/40">
                    {seedProgress.totalImported} businesses imported so far
                  </div>
                </div>
              )}

              {seeding && !seedProgress && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin text-accent-emerald" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-xs text-white/70">Starting discovery...</span>
                </div>
              )}

              {seedResult && (
                <div className="bg-accent-emerald/10 border border-accent-emerald/20 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-accent-emerald">Discovery complete!</span>
                  </div>
                  <p className="text-[10px] text-white/50">
                    Imported {seedResult.totalImported} businesses across {seedResult.categories} categories.
                  </p>
                </div>
              )}

              {seedError && (
                <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-3">
                  <p className="text-[10px] text-red-400">{seedError}</p>
                  <button
                    onClick={runSeed}
                    className="mt-2 text-[10px] text-accent-blue hover:text-accent-blue/80"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!settings.google_places_api_key.trim() && (
                <button
                  onClick={() => setStep('api-keys')}
                  className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
                >
                  Go back and add your Google Places API key
                </button>
              )}
            </div>
          )}

          {step === 'tips' && <TipsContent />}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-emerald/30 to-accent-blue/30 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-display font-semibold text-white">You're All Set!</h2>
              <p className="text-sm text-white/60 max-w-sm mx-auto">
                Your outreach pipeline is ready. Start browsing businesses, enriching contacts, and sending personalized messages.
              </p>
            </div>
          )}
        </div>

        {/* Footer with nav buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={step === 'welcome' ? onComplete : goBack}
            className="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white/70 hover:bg-surface-2 transition-all"
          >
            {step === 'welcome' ? 'Skip Setup' : 'Back'}
          </button>

          {step === 'done' ? (
            <button
              onClick={finishOnboarding}
              className="px-5 py-2 rounded-lg bg-accent-emerald text-white text-xs font-medium hover:bg-accent-emerald/90 transition-all"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={goNext}
              className="px-5 py-2 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium border border-accent-emerald/20 hover:bg-accent-emerald/30 transition-all"
            >
              {step === 'seed' && seeding ? 'Please wait...' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Tips Content (used in wizard and standalone overlay)
// ============================================================

function TipsContent() {
  const tips = [
    { icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', title: 'Keep emails under 125 words', description: 'Short, focused messages get 2x more responses than lengthy pitches.' },
    { icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z', title: 'Subject lines under 7 words', description: 'Short subjects have 15% higher open rates. Be specific and intriguing.' },
    { icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', title: '1-5% reply rate is normal and good', description: 'Cold outreach is a numbers game. Even top performers see 3-5% reply rates.' },
    { icon: 'M13 10V3L4 14h7v7l9-11h-7z', title: 'Multi-channel gets 40% more engagement', description: 'Combine email + LinkedIn. Connect first, then follow up via a different channel.' },
    { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Tue-Thu at 1 PM local time', description: 'Midweek, early afternoon is the optimal send window for cold outreach.' },
    { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', title: 'Connection request first, pitch in follow-up', description: 'Build rapport before selling. A warm intro doubles your response rate.' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-display font-semibold text-white mb-1">Cold Outreach Best Practices</h3>
        <p className="text-xs text-white/40">Tips to maximize your response rate and build genuine connections.</p>
      </div>

      <div className="space-y-2.5">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-2/50 border border-white/[0.04]">
            <div className="w-8 h-8 rounded-lg bg-accent-emerald/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-accent-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tip.icon} />
              </svg>
            </div>
            <div>
              <div className="text-[11px] font-medium text-white/80">{tip.title}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{tip.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Tips Overlay (standalone, dismissible)
// ============================================================

interface TipsOverlayProps {
  onClose: () => void
}

export function TipsOverlay({ onClose }: TipsOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-white/[0.08] rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto px-6 py-5">
          <TipsContent />
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium border border-accent-emerald/20 hover:bg-accent-emerald/30 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Settings Panel
// ============================================================

interface OutreachSettingsPanelProps {
  onClose: () => void
}

export function OutreachSettingsPanel({ onClose }: OutreachSettingsPanelProps) {
  const [settings, setSettings] = useState<OutreachSettingsData>({
    google_places_api_key: '',
    apollo_api_key: '',
    default_lat: '35.2271',
    default_lng: '-80.8431',
    default_radius: '25000',
    resume_link: '',
    onboarding_completed: 'false',
    gws_installed: '',
    gws_authenticated: '',
    gws_user_email: '',
  })
  const [googleKeyStatus, setGoogleKeyStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [apolloKeyStatus, setApolloKeyStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [validating, setValidating] = useState<'google' | 'apollo' | null>(null)
  const [gwsChecking, setGwsChecking] = useState(false)
  const [gwsStatus, setGwsStatus] = useState<{ installed: boolean; authenticated: boolean; error?: string } | null>(null)

  useEffect(() => {
    window.electronAPI.getOutreachSettings().then(setSettings)
  }, [])

  const handleSave = async (key: keyof OutreachSettingsData, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    await window.electronAPI.setOutreachSetting(key, value)
  }

  const validateGoogleKey = async () => {
    if (!settings.google_places_api_key.trim()) return
    setValidating('google')
    setGoogleKeyStatus(null)
    try {
      const result = await window.electronAPI.validateApiKey('google_places', settings.google_places_api_key)
      setGoogleKeyStatus(result)
    } catch (err: any) {
      setGoogleKeyStatus({ valid: false, message: err.message || 'Validation failed' })
    } finally {
      setValidating(null)
    }
  }

  const validateApolloKey = async () => {
    if (!settings.apollo_api_key.trim()) return
    setValidating('apollo')
    setApolloKeyStatus(null)
    try {
      const result = await window.electronAPI.validateApiKey('apollo', settings.apollo_api_key)
      setApolloKeyStatus(result)
    } catch (err: any) {
      setApolloKeyStatus({ valid: false, message: err.message || 'Validation failed' })
    } finally {
      setValidating(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-1 border border-white/[0.08] rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-display font-semibold text-white">Outreach Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
          {/* Google Places */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60 font-medium">Google Places API Key</label>
              <button
                onClick={() => window.electronAPI.openExternal('https://console.cloud.google.com/apis/credentials')}
                className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Get a key
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={settings.google_places_api_key}
                onChange={e => handleSave('google_places_api_key', e.target.value)}
                placeholder="AIza..."
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
              />
              <button
                onClick={validateGoogleKey}
                disabled={!settings.google_places_api_key.trim() || validating === 'google'}
                className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-white/70 hover:text-white transition-all disabled:opacity-40"
              >
                {validating === 'google' ? 'Checking...' : 'Validate'}
              </button>
            </div>
            {googleKeyStatus && (
              <div className={cn('text-[10px] px-2 py-1 rounded', googleKeyStatus.valid ? 'text-accent-emerald bg-accent-emerald/10' : 'text-red-400 bg-red-400/10')}>
                {googleKeyStatus.message}
              </div>
            )}
          </div>

          {/* Apollo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60 font-medium">Apollo.io API Key</label>
              <button
                onClick={() => window.electronAPI.openExternal('https://app.apollo.io/#/settings/integrations/api')}
                className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Get a key
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={settings.apollo_api_key}
                onChange={e => handleSave('apollo_api_key', e.target.value)}
                placeholder="apollo-api-..."
                className="flex-1 bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
              />
              <button
                onClick={validateApolloKey}
                disabled={!settings.apollo_api_key.trim() || validating === 'apollo'}
                className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-white/70 hover:text-white transition-all disabled:opacity-40"
              >
                {validating === 'apollo' ? 'Checking...' : 'Validate'}
              </button>
            </div>
            {apolloKeyStatus && (
              <div className={cn('text-[10px] px-2 py-1 rounded', apolloKeyStatus.valid ? 'text-accent-emerald bg-accent-emerald/10' : 'text-red-400 bg-red-400/10')}>
                {apolloKeyStatus.message}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Location */}
          <div className="space-y-3">
            <label className="text-[11px] text-white/60 font-medium block">Default Location</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">Latitude</label>
                <input
                  type="text"
                  value={settings.default_lat}
                  onChange={e => handleSave('default_lat', e.target.value)}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">Longitude</label>
                <input
                  type="text"
                  value={settings.default_lng}
                  onChange={e => handleSave('default_lng', e.target.value)}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 mb-1 block">Radius (m)</label>
                <input
                  type="text"
                  value={settings.default_radius}
                  onChange={e => handleSave('default_radius', e.target.value)}
                  className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent-emerald/30"
                />
              </div>
            </div>
          </div>

          {/* Resume Link */}
          <div className="space-y-2">
            <label className="text-[11px] text-white/60 font-medium block">Resume / Portfolio Link</label>
            <input
              type="url"
              value={settings.resume_link}
              onChange={e => handleSave('resume_link', e.target.value)}
              placeholder="https://your-site.com/resume"
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-white/[0.06]" />

          {/* Google Workspace */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-white/60 font-medium">Google Workspace</label>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  gwsStatus?.authenticated ? 'bg-accent-emerald' : gwsStatus?.installed ? 'bg-accent-amber' : 'bg-white/20'
                )} />
                <span className="text-[10px] text-white/40">
                  {gwsStatus?.authenticated ? 'Connected' : gwsStatus?.installed ? 'Not authenticated' : 'Not configured'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-surface-2/50 space-y-2">
              <p className="text-[10px] text-white/40">
                Send emails via Gmail, schedule calendar events, and export to Sheets/Drive.
              </p>
              <div className="text-[10px] text-white/30 space-y-1">
                <p>1. Install: <code className="text-accent-blue/70 bg-surface-3 px-1 py-0.5 rounded">npm install -g @anthropic-ai/gws</code></p>
                <p>2. Authenticate: <code className="text-accent-blue/70 bg-surface-3 px-1 py-0.5 rounded">gws auth login</code></p>
              </div>
            </div>

            <button
              onClick={async () => {
                setGwsChecking(true)
                setGwsStatus(null)
                try {
                  const result = await window.electronAPI.gwsCheckAuth()
                  setGwsStatus(result)
                } catch (err: any) {
                  setGwsStatus({ installed: false, authenticated: false, error: err.message })
                } finally {
                  setGwsChecking(false)
                }
              }}
              disabled={gwsChecking}
              className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-[10px] text-white/70 hover:text-white transition-all disabled:opacity-40"
            >
              {gwsChecking ? 'Checking...' : 'Test Connection'}
            </button>

            {gwsStatus && (
              <div className={cn(
                'text-[10px] px-2 py-1 rounded',
                gwsStatus.authenticated ? 'text-accent-emerald bg-accent-emerald/10'
                  : gwsStatus.installed ? 'text-accent-amber bg-accent-amber/10'
                  : 'text-red-400 bg-red-400/10'
              )}>
                {gwsStatus.authenticated
                  ? 'Google Workspace connected successfully'
                  : gwsStatus.installed
                  ? `Installed but not authenticated. Run: gws auth login`
                  : gwsStatus.error || 'gws CLI not found. Install it first.'}
              </div>
            )}

            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Gmail Address (for From header)</label>
              <input
                type="email"
                value={settings.gws_user_email}
                onChange={e => handleSave('gws_user_email', e.target.value)}
                placeholder="you@gmail.com"
                className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-emerald/30"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-accent-emerald/20 text-accent-emerald text-xs font-medium border border-accent-emerald/20 hover:bg-accent-emerald/30 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
