import { useEffect, useRef } from 'react'
import { useContentStore } from '../store/contentStore'

export function useContentStreaming() {
  const activeDraftId = useContentStore(s => s.activeDraftId)
  const setResearchText = useContentStore(s => s.setResearchText)
  const setResearching = useContentStore(s => s.setResearching)
  const setStreamText = useContentStore(s => s.setStreamText)
  const setStreaming = useContentStore(s => s.setStreaming)
  const loadDrafts = useContentStore(s => s.loadDrafts)

  const researchBuf = useRef('')
  const draftBuf = useRef('')

  useEffect(() => {
    // Research stream listeners
    const cleanupResearchChunk = window.electronAPI.onContentResearchChunk((data) => {
      if (data.draftId === activeDraftId) {
        researchBuf.current += data.text
        setResearchText(researchBuf.current)
      }
    })

    const cleanupResearchEnd = window.electronAPI.onContentResearchEnd(async (data) => {
      if (data.draftId === activeDraftId) {
        setResearching(false)
        // Save research to draft
        if (activeDraftId) {
          await window.electronAPI.updateContentDraft(activeDraftId, {
            research: researchBuf.current,
            status: 'outlined',
          })
          await loadDrafts()
        }
      }
    })

    const cleanupResearchError = window.electronAPI.onContentResearchError((data) => {
      if (data.draftId === activeDraftId) {
        setResearching(false)
      }
    })

    // Draft stream listeners
    const cleanupDraftChunk = window.electronAPI.onContentStreamChunk((data) => {
      if (data.draftId === activeDraftId) {
        draftBuf.current += data.text
        setStreamText(draftBuf.current)
      }
    })

    const cleanupDraftEnd = window.electronAPI.onContentStreamEnd(async (data) => {
      if (data.draftId === activeDraftId) {
        setStreaming(false)
        // Save content to draft
        if (activeDraftId) {
          await window.electronAPI.updateContentDraft(activeDraftId, {
            content: draftBuf.current,
            status: 'ready',
          })
          await loadDrafts()
        }
      }
    })

    const cleanupDraftError = window.electronAPI.onContentStreamError((data) => {
      if (data.draftId === activeDraftId) {
        setStreaming(false)
      }
    })

    return () => {
      cleanupResearchChunk()
      cleanupResearchEnd()
      cleanupResearchError()
      cleanupDraftChunk()
      cleanupDraftEnd()
      cleanupDraftError()
    }
  }, [activeDraftId, setResearchText, setResearching, setStreamText, setStreaming, loadDrafts])

  // Reset buffers when active draft changes
  useEffect(() => {
    researchBuf.current = ''
    draftBuf.current = ''
  }, [activeDraftId])
}
