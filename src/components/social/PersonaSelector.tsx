import { useSocialStore } from '../../store/socialStore'

export default function PersonaSelector() {
  const {
    activePersonaId, showPersonaForm,
    personaFormName, personaFormDesc, personaFormExamples,
    setActivePersonaId, setShowPersonaForm,
    setPersonaFormName, setPersonaFormDesc, setPersonaFormExamples,
    handleCreatePersona, handleDeletePersona,
  } = useSocialStore()
  const allPersonas = useSocialStore(s => s.getAllPersonas())

  return (
    <>
      {/* Persona Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setActivePersonaId(null)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${
            !activePersonaId ? 'bg-accent-blue/20 text-accent-blue' : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
          }`}
        >
          No persona
        </button>
        {allPersonas.map(p => (
          <div key={p.id} className="flex items-center shrink-0">
            <button
              onClick={() => setActivePersonaId(p.id === activePersonaId ? null : p.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                p.id === activePersonaId ? 'bg-accent-purple/20 text-accent-purple' : 'bg-surface-2 text-white/50 hover:bg-surface-3 hover:text-white/70'
              }`}
              title={p.description}
            >
              {p.name}
            </button>
            {!p.isBuiltIn && (
              <button
                onClick={() => handleDeletePersona(p.id)}
                className="w-4 h-4 -ml-0.5 rounded-full hover:bg-accent-red/20 flex items-center justify-center text-muted hover:text-accent-red transition-all"
                title="Delete persona"
              >
                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowPersonaForm(!showPersonaForm)}
          className="px-2.5 py-1 rounded-full bg-surface-2 hover:bg-surface-3 text-[10px] text-muted hover:text-white/70 font-medium transition-all whitespace-nowrap shrink-0"
        >
          + Custom
        </button>
      </div>

      {/* Custom Persona Form */}
      {showPersonaForm && (
        <div className="glass-card rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/70 font-medium">New Persona</span>
            <button
              onClick={() => setShowPersonaForm(false)}
              className="w-5 h-5 rounded hover:bg-white/[0.06] flex items-center justify-center text-muted hover:text-white/60"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={personaFormName}
            onChange={e => setPersonaFormName(e.target.value)}
            placeholder="Persona name"
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50"
          />
          <input
            type="text"
            value={personaFormDesc}
            onChange={e => setPersonaFormDesc(e.target.value)}
            placeholder="Style description (e.g., Witty, data-driven, optimistic)"
            className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50"
          />
          {personaFormExamples.map((ex, i) => (
            <textarea
              key={i}
              value={ex}
              onChange={e => {
                const updated = [...personaFormExamples]
                updated[i] = e.target.value
                setPersonaFormExamples(updated)
              }}
              placeholder={`Example tweet ${i + 1}`}
              rows={2}
              className="w-full bg-surface-2 border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/90 focus:outline-none focus:border-accent-blue/40 placeholder-muted/50 resize-none"
            />
          ))}
          {personaFormExamples.length < 3 && (
            <button
              onClick={() => setPersonaFormExamples([...personaFormExamples, ''])}
              className="text-[10px] text-muted hover:text-white/60 transition-all"
            >
              + Add example
            </button>
          )}
          <button
            onClick={handleCreatePersona}
            disabled={!personaFormName.trim() || !personaFormDesc.trim() || !personaFormExamples.some(e => e.trim())}
            className="w-full px-3 py-1.5 bg-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-30 rounded-lg text-[11px] text-accent-purple font-medium transition-all"
          >
            Save Persona
          </button>
        </div>
      )}
    </>
  )
}
