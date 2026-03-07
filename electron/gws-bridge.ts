import { execFile } from 'child_process'

// ── Error Types ──

export type GwsErrorCategory = 'NOT_INSTALLED' | 'NOT_AUTHENTICATED' | 'API_ERROR' | 'TIMEOUT'

export interface GwsResult<T = any> {
  success: boolean
  data?: T
  error?: string
  errorCategory?: GwsErrorCategory
}

export interface GwsAuthStatus {
  installed: boolean
  authenticated: boolean
  error?: string
}

export interface GmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface CalendarEventResult {
  success: boolean
  eventId?: string
  htmlLink?: string
  error?: string
}

export interface SheetsExportResult {
  success: boolean
  spreadsheetUrl?: string
  error?: string
}

export interface DriveUploadResult {
  success: boolean
  fileId?: string
  webViewLink?: string
  error?: string
}

// ── Core Executor ──

function gwsExecRaw(args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile('gws', args, {
      shell: true,
      windowsHide: true,
      timeout: 30000,
    }, (err, stdout, stderr) => {
      const code = err && 'code' in err ? (err as any).code : (err ? 1 : 0)
      resolve({ stdout: stdout || '', stderr: stderr || '', code })
    })
  })
}

export async function gwsIsInstalled(): Promise<boolean> {
  try {
    const { code } = await gwsExecRaw(['version'])
    return code === 0
  } catch {
    return false
  }
}

export async function gwsCheckAuth(): Promise<GwsAuthStatus> {
  const installed = await gwsIsInstalled()
  if (!installed) {
    return { installed: false, authenticated: false, error: 'gws CLI is not installed' }
  }

  try {
    // Lightweight check: list 1 Gmail message to verify auth
    const { stdout, stderr, code } = await gwsExecRaw([
      'gmail', 'users.messages', 'list',
      '--userId=me', '--maxResults=1', '--json',
    ])
    if (code === 0) {
      return { installed: true, authenticated: true }
    }
    const errMsg = stderr || stdout || 'Authentication check failed'
    if (errMsg.includes('auth') || errMsg.includes('token') || errMsg.includes('credential') || errMsg.includes('login')) {
      return { installed: true, authenticated: false, error: 'Not authenticated. Run: gws auth login' }
    }
    return { installed: true, authenticated: false, error: errMsg.slice(0, 200) }
  } catch (err: any) {
    return { installed: true, authenticated: false, error: err.message || 'Auth check failed' }
  }
}

export async function gwsExec(
  service: string,
  resource: string,
  method: string,
  options?: Record<string, string>,
): Promise<GwsResult> {
  const args = [service, resource, method]
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      args.push(`--${key}=${value}`)
    }
  }
  args.push('--json')

  const { stdout, stderr, code } = await gwsExecRaw(args)

  if (code !== 0) {
    const errMsg = stderr || stdout || 'Command failed'
    let errorCategory: GwsErrorCategory = 'API_ERROR'
    if (errMsg.includes('not found') || errMsg.includes('not recognized')) errorCategory = 'NOT_INSTALLED'
    if (errMsg.includes('auth') || errMsg.includes('token')) errorCategory = 'NOT_AUTHENTICATED'
    if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) errorCategory = 'TIMEOUT'
    return { success: false, error: errMsg.slice(0, 500), errorCategory }
  }

  try {
    const data = JSON.parse(stdout)
    return { success: true, data }
  } catch {
    // Some commands return non-JSON on success
    return { success: true, data: stdout }
  }
}

// ── Email Helpers ──

export function buildRawEmail({ to, from, subject, body }: {
  to: string
  from: string
  subject: string
  body: string
}): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    '',
    Buffer.from(body, 'utf-8').toString('base64'),
  ]
  const raw = lines.join('\r\n')
  // base64url encode the entire message
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function gmailSend(to: string, subject: string, body: string, fromEmail?: string): Promise<GmailSendResult> {
  const from = fromEmail || 'me'
  const raw = buildRawEmail({ to, from, subject, body })

  const result = await gwsExec('gmail', 'users.messages', 'send', {
    userId: 'me',
    raw,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return {
    success: true,
    messageId: result.data?.id || result.data?.messageId,
  }
}

// ── Calendar ──

export async function calendarCreateEvent(params: {
  summary: string
  startDateTime: string
  endDateTime: string
  attendeeEmail?: string
  description?: string
}): Promise<CalendarEventResult> {
  const options: Record<string, string> = {
    calendarId: 'primary',
    summary: params.summary,
    'start.dateTime': params.startDateTime,
    'end.dateTime': params.endDateTime,
  }
  if (params.description) {
    options['description'] = params.description
  }
  if (params.attendeeEmail) {
    options['attendees'] = params.attendeeEmail
  }

  const result = await gwsExec('calendar', 'events', 'insert', options)

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return {
    success: true,
    eventId: result.data?.id,
    htmlLink: result.data?.htmlLink,
  }
}

// ── Sheets ──

export async function sheetsExportPipeline(
  title: string,
  rows: string[][],
): Promise<SheetsExportResult> {
  // Step 1: Create spreadsheet
  const createResult = await gwsExec('sheets', 'spreadsheets', 'create', {
    title,
  })
  if (!createResult.success) {
    return { success: false, error: createResult.error }
  }

  const spreadsheetId = createResult.data?.spreadsheetId
  const spreadsheetUrl = createResult.data?.spreadsheetUrl
  if (!spreadsheetId) {
    return { success: false, error: 'Failed to get spreadsheet ID' }
  }

  // Step 2: Append rows
  if (rows.length > 0) {
    const values = JSON.stringify(rows)
    await gwsExec('sheets', 'spreadsheets.values', 'append', {
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      values,
    })
  }

  return {
    success: true,
    spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  }
}

// ── Drive (CREATE ONLY — no deleting) ──

export async function driveUploadFile(
  fileName: string,
  localPath: string,
): Promise<DriveUploadResult> {
  const result = await gwsExec('drive', 'files', 'create', {
    name: fileName,
    uploadFile: localPath,
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const fileId = result.data?.id
  return {
    success: true,
    fileId,
    webViewLink: result.data?.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}` : undefined),
  }
}
