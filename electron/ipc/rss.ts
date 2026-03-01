import { ipcMain, BrowserWindow } from 'electron'
import { getRSSFeeds, addRSSFeed, removeRSSFeed } from '../database'
import { fetchAllFeeds } from '../rss'

export function registerRSSHandlers(_mainWindow: BrowserWindow) {
  ipcMain.handle('get-rss-feeds', () => {
    return getRSSFeeds()
  })

  ipcMain.handle('add-rss-feed', (_, url: string, name: string, category: string) => {
    return addRSSFeed({ url, name, category: category || 'ai' })
  })

  ipcMain.handle('remove-rss-feed', (_, url: string) => {
    return removeRSSFeed(url)
  })

  ipcMain.handle('fetch-rss-feeds', async (_, feeds: { url: string; name: string; category: string }[]) => {
    return fetchAllFeeds(feeds)
  })
}
