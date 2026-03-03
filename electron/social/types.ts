export interface ExternalContact {
  externalId: string
  name: string
  phone?: string
  email?: string
  username?: string
  avatarUrl?: string
}

export interface ExternalInteraction {
  externalId: string
  contactExternalId: string
  type: 'message'
  subject: string
  body: string
  date: string
}

export interface SyncResult {
  contacts: ExternalContact[]
  interactions: ExternalInteraction[]
}

export interface SocialProviderInterface {
  connect(credentials: any): Promise<{ accountId: string; accountName: string }>
  disconnect(): Promise<void>
  sync(): Promise<SyncResult>
}
