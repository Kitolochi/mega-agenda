import { useChatStore } from '../../store/chatStore'

export default function ChatSettingsPanel() {
  const {
    settings, chatModels,
    setShowSettings, handleSaveSettings,
  } = useChatStore()

  if (!settings) return null

  return (
    <div className="absolute inset-0 z-20 bg-surface-0/95 flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-white/80">Chat Settings</span>
        <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-surface-3 text-muted hover:text-white">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">Model</label>
      <select
        value={settings.model}
        onChange={e => handleSaveSettings({ model: e.target.value })}
        className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 mb-4"
      >
        {chatModels.length > 0 ? chatModels.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        )) : (
          <>
            <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
            <option value="claude-opus-4-6">Claude Opus 4.6</option>
          </>
        )}
      </select>

      <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">System Prompt</label>
      <div className="flex gap-1 mb-2">
        {(['default', 'context', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => handleSaveSettings({ systemPromptMode: mode })}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              settings.systemPromptMode === mode ? 'bg-surface-4 text-white' : 'bg-surface-2 text-muted hover:text-white/60'
            }`}
          >
            {mode === 'default' ? 'Default' : mode === 'context' ? 'Context-aware' : 'Custom'}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted/60 mb-3">
        {settings.systemPromptMode === 'default' && 'Basic helpful assistant prompt'}
        {settings.systemPromptMode === 'context' && 'Includes your tasks, streak, and notes for personalized responses'}
        {settings.systemPromptMode === 'custom' && 'Write your own system prompt below'}
      </p>
      {settings.systemPromptMode === 'custom' && (
        <textarea
          value={settings.customSystemPrompt || ''}
          onChange={e => handleSaveSettings({ customSystemPrompt: e.target.value })}
          placeholder="Enter custom system prompt..."
          className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40 mb-4 h-24 resize-none"
        />
      )}

      <label className="block text-[10px] uppercase tracking-widest text-muted font-medium mb-1.5">Max Tokens</label>
      <input
        type="number"
        value={settings.maxTokens}
        onChange={e => handleSaveSettings({ maxTokens: parseInt(e.target.value) || 4096 })}
        className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-accent-blue/40"
      />
    </div>
  )
}
