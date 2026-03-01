import { useEffect } from 'react'
import { useChatStore } from '../store/chatStore'

export function useSmartQuery(
  smartQueryTextRef: React.MutableRefObject<string>
) {
  const smartQueryId = useChatStore(s => s.smartQueryId)
  const setSmartQueryText = useChatStore(s => s.setSmartQueryText)
  const setSmartQueryStreaming = useChatStore(s => s.setSmartQueryStreaming)

  useEffect(() => {
    const cleanupChunk = window.electronAPI.onSmartQueryChunk((data) => {
      if (data.queryId === smartQueryId) {
        smartQueryTextRef.current += data.text
        setSmartQueryText(smartQueryTextRef.current)
      }
    })
    const cleanupEnd = window.electronAPI.onSmartQueryEnd((data) => {
      if (data.queryId === smartQueryId) {
        setSmartQueryStreaming(false)
      }
    })
    const cleanupError = window.electronAPI.onSmartQueryError((data) => {
      if (data.queryId === smartQueryId) {
        setSmartQueryStreaming(false)
        if (!smartQueryTextRef.current) {
          setSmartQueryText('Error: ' + data.error)
        }
      }
    })
    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, [smartQueryId, setSmartQueryText, setSmartQueryStreaming, smartQueryTextRef])
}
