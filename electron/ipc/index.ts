import { BrowserWindow } from 'electron'
import { registerTaskHandlers } from './tasks'
import { registerNoteHandlers } from './notes'
import { registerTwitterHandlers } from './twitter'
import { registerRSSHandlers } from './rss'
import { registerChatHandlers } from './chat'
import { registerAIHandlers } from './ai'
import { registerMemoryHandlers } from './memory'
import { registerSystemHandlers } from './system'
import { registerKnowledgePackHandlers } from './knowledge-pack'
import { registerBankSyncHandlers } from './bank-sync'
import { registerNetworkHandlers } from './network'
import { registerSocialHandlers } from './social'
import { registerContentHandlers } from './content'
import { registerOutreachHandlers } from './outreach'
import { registerCalendarHandlers } from './calendar'

export function registerAllHandlers(mainWindow: BrowserWindow) {
  registerTaskHandlers(mainWindow)
  registerNoteHandlers(mainWindow)
  registerTwitterHandlers(mainWindow)
  registerRSSHandlers(mainWindow)
  registerChatHandlers(mainWindow)
  registerAIHandlers(mainWindow)
  registerMemoryHandlers(mainWindow)
  registerSystemHandlers(mainWindow)
  registerKnowledgePackHandlers(mainWindow)
  registerBankSyncHandlers(mainWindow)
  registerNetworkHandlers(mainWindow)
  registerSocialHandlers(mainWindow)
  registerContentHandlers(mainWindow)
  registerOutreachHandlers(mainWindow)
  registerCalendarHandlers(mainWindow)
}
