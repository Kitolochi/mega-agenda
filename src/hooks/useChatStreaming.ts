import { useEffect } from 'react'
import { ChatMessage } from '../types'
import { useChatStore } from '../store/chatStore'
import { generateId } from '../utils/formatting'

export function useChatStreaming(
  streamTextRef: React.MutableRefObject<string>
) {
  const activeConvId = useChatStore(s => s.activeConvId)
  const setStreamText = useChatStore(s => s.setStreamText)
  const setStreaming = useChatStore(s => s.setStreaming)
  const loadConversations = useChatStore(s => s.loadConversations)

  useEffect(() => {
    const cleanupChunk = window.electronAPI.onChatStreamChunk((data) => {
      if (data.conversationId === activeConvId) {
        streamTextRef.current += data.text
        setStreamText(streamTextRef.current)
      }
    })

    const cleanupEnd = window.electronAPI.onChatStreamEnd(async (data) => {
      if (data.conversationId === activeConvId) {
        const finalText = streamTextRef.current
        const msg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: finalText,
          timestamp: new Date().toISOString(),
          model: data.model,
          tokenUsage: { input: data.usage.input, output: data.usage.output }
        }
        await window.electronAPI.addChatMessage(data.conversationId, msg)
        streamTextRef.current = ''
        setStreamText('')
        setStreaming(false)
        await loadConversations()
      }
    })

    const cleanupError = window.electronAPI.onChatStreamError((data) => {
      if (data.conversationId === activeConvId) {
        streamTextRef.current = ''
        setStreamText('')
        setStreaming(false)
        alert('Chat error: ' + data.error)
      }
    })

    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, [activeConvId, loadConversations, setStreamText, setStreaming, streamTextRef])
}
