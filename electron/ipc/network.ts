import { ipcMain, BrowserWindow } from 'electron'
import {
  getNetworkContacts,
  getNetworkContact,
  createNetworkContact,
  updateNetworkContact,
  deleteNetworkContact,
  getContactInteractions,
  createContactInteraction,
  deleteContactInteraction,
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  getPipelineCards,
  createPipelineCard,
  updatePipelineCard,
  movePipelineCard,
  deletePipelineCard,
} from '../database'

export function registerNetworkHandlers(_mainWindow: BrowserWindow) {
  // Contacts
  ipcMain.handle('get-network-contacts', () => getNetworkContacts())
  ipcMain.handle('get-network-contact', (_, id: string) => getNetworkContact(id))
  ipcMain.handle('create-network-contact', (_, data: any) => createNetworkContact(data))
  ipcMain.handle('update-network-contact', (_, id: string, updates: any) => updateNetworkContact(id, updates))
  ipcMain.handle('delete-network-contact', (_, id: string) => deleteNetworkContact(id))

  // Interactions
  ipcMain.handle('get-contact-interactions', (_, contactId?: string) => getContactInteractions(contactId))
  ipcMain.handle('create-contact-interaction', (_, data: any) => createContactInteraction(data))
  ipcMain.handle('delete-contact-interaction', (_, id: string) => deleteContactInteraction(id))

  // Pipelines
  ipcMain.handle('get-pipelines', () => getPipelines())
  ipcMain.handle('create-pipeline', (_, data: any) => createPipeline(data))
  ipcMain.handle('update-pipeline', (_, id: string, updates: any) => updatePipeline(id, updates))
  ipcMain.handle('delete-pipeline', (_, id: string) => deletePipeline(id))

  // Pipeline Cards
  ipcMain.handle('get-pipeline-cards', (_, pipelineId?: string) => getPipelineCards(pipelineId))
  ipcMain.handle('create-pipeline-card', (_, data: any) => createPipelineCard(data))
  ipcMain.handle('update-pipeline-card', (_, id: string, updates: any) => updatePipelineCard(id, updates))
  ipcMain.handle('move-pipeline-card', (_, id: string, stage: string) => movePipelineCard(id, stage))
  ipcMain.handle('delete-pipeline-card', (_, id: string) => deletePipelineCard(id))
}
