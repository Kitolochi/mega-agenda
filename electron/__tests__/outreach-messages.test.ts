// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTempDir, cleanupTempDir } from './helpers/temp-dir'

// ── Electron mock ────────────────────────────────────────────────────
const mockElectronState = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((_name: string) => mockElectronState.userDataDir),
  },
}))

// ── LLM mock ─────────────────────────────────────────────────────────
const mockCallLLM = vi.hoisted(() => vi.fn())

vi.mock('../llm', () => ({
  callLLM: mockCallLLM,
}))

import {
  initOutreachTables,
  createBusiness,
  createContact,
  createTemplate,
  getTemplate,
  seedDefaultTemplates,
  getTemplates,
  getBusinessOutreach,
} from '../outreach-db'
import { DEFAULT_TEMPLATES } from '../outreach-templates'
import {
  generatePersonalizedMessage,
  generateBatchMessages,
} from '../outreach-messages'

let tempDir: string

beforeEach(() => {
  tempDir = createTempDir()
  mockElectronState.userDataDir = tempDir
  initOutreachTables()
  mockCallLLM.mockReset()
})

afterEach(() => {
  cleanupTempDir(tempDir)
})

// ── Template definitions ─────────────────────────────────────────────

describe('DEFAULT_TEMPLATES', () => {
  it('has at least 8 templates', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(8)
  })

  it('covers all required channels', () => {
    const channels = new Set(DEFAULT_TEMPLATES.map(t => t.channel))
    expect(channels.has('email')).toBe(true)
    expect(channels.has('linkedin')).toBe(true)
    expect(channels.has('instagram')).toBe(true)
    expect(channels.has('facebook')).toBe(true)
    expect(channels.has('twitter')).toBe(true)
  })

  it('has 3 email templates', () => {
    const emails = DEFAULT_TEMPLATES.filter(t => t.channel === 'email')
    expect(emails.length).toBe(3)
  })

  it('has 2 linkedin templates', () => {
    const linkedin = DEFAULT_TEMPLATES.filter(t => t.channel === 'linkedin')
    expect(linkedin.length).toBe(2)
  })

  it('all templates use standardized variable format', () => {
    for (const t of DEFAULT_TEMPLATES) {
      for (const v of t.variables) {
        const inBody = t.body.includes(`{${v}}`)
        const inSubject = t.subject.includes(`{${v}}`)
        expect(inBody || inSubject).toBe(true)
      }
    }
  })

  it('LinkedIn connection request body is under 300 characters', () => {
    const connReq = DEFAULT_TEMPLATES.find(t => t.name.includes('Connection Request'))
    expect(connReq).toBeDefined()
    expect(connReq!.body.length).toBeLessThan(300)
  })
})

describe('seedDefaultTemplates with new templates', () => {
  it('seeds all 8 default templates', () => {
    seedDefaultTemplates()
    const templates = getTemplates()
    expect(templates.length).toBe(DEFAULT_TEMPLATES.length)
  })

  it('preserves template variables', () => {
    seedDefaultTemplates()
    const templates = getTemplates()
    const coldEmail = templates.find(t => t.name === 'Cold Email Introduction')
    expect(coldEmail).toBeDefined()
    expect(coldEmail!.variables).toContain('businessName')
    expect(coldEmail!.variables).toContain('contactName')
    expect(coldEmail!.variables).toContain('serviceOffering')
  })
})

// ── Message personalization ──────────────────────────────────────────

describe('generatePersonalizedMessage', () => {
  it('generates a personalized email message', async () => {
    const business = createBusiness({ name: 'Acme Corp', category: 'Tech', website: 'https://acme.com', rating: 4.5, reviewCount: 120 })
    const template = createTemplate({
      name: 'Test Email',
      channel: 'email',
      subject: 'Quick question about {businessName}',
      body: 'Hi {contactName}, I noticed {businessName} and would love to chat about {serviceOffering}.',
      variables: ['businessName', 'contactName', 'serviceOffering'],
    })

    mockCallLLM.mockResolvedValue('SUBJECT: Quick question about Acme Corp\nBODY: Hi there, I noticed Acme Corp is a leader in tech and would love to chat about web development services.')

    const result = await generatePersonalizedMessage(template.id, business, undefined, {
      serviceOffering: 'web development',
      resumeLink: 'https://example.com/resume',
    })

    expect(result.channel).toBe('email')
    expect(result.subject).toBe('Quick question about Acme Corp')
    expect(result.body).toContain('Acme Corp')
    expect(mockCallLLM).toHaveBeenCalledOnce()
  })

  it('generates a message with contact info when available', async () => {
    const business = createBusiness({ name: 'Test Biz', category: 'Food' })
    const contact = createContact({ businessId: business.id, name: 'Jane Doe', title: 'Owner' })
    const template = createTemplate({
      name: 'Test DM',
      channel: 'instagram',
      subject: '',
      body: 'Hey {contactName}! Love {businessName}.',
      variables: ['contactName', 'businessName'],
    })

    mockCallLLM.mockResolvedValue('Hey Jane! Love what Test Biz is doing with their amazing food. Would love to connect!')

    const result = await generatePersonalizedMessage(template.id, business, contact, {
      serviceOffering: 'marketing',
      resumeLink: 'https://example.com',
    })

    expect(result.channel).toBe('instagram')
    expect(result.subject).toBeUndefined()
    expect(result.body).toContain('Jane')

    const callArgs = mockCallLLM.mock.calls[0][0]
    expect(callArgs.prompt).toContain('Jane Doe')
    expect(callArgs.prompt).toContain('Owner')
  })

  it('throws when template not found', async () => {
    const business = createBusiness({ name: 'Test' })
    await expect(
      generatePersonalizedMessage('nonexistent', business, undefined, { serviceOffering: '', resumeLink: '' })
    ).rejects.toThrow('Template not found')
  })

  it('includes business details in the prompt', async () => {
    const business = createBusiness({
      name: 'Star Restaurant',
      category: 'Restaurant',
      website: 'https://star.com',
      rating: 4.8,
      reviewCount: 250,
      address: '123 Main St, Charlotte NC',
    })
    const template = createTemplate({
      name: 'Test',
      channel: 'email',
      subject: 'Hello',
      body: 'Hi there.',
      variables: [],
    })

    mockCallLLM.mockResolvedValue('SUBJECT: Hello\nBODY: Hi there, personalized.')

    await generatePersonalizedMessage(template.id, business, undefined, {
      serviceOffering: 'social media management',
      resumeLink: 'https://example.com',
    })

    const prompt = mockCallLLM.mock.calls[0][0].prompt
    expect(prompt).toContain('Star Restaurant')
    expect(prompt).toContain('Restaurant')
    expect(prompt).toContain('4.8')
    expect(prompt).toContain('250')
    expect(prompt).toContain('social media management')
  })

  it('enforces character limits for LinkedIn connection requests', async () => {
    const business = createBusiness({ name: 'Test Biz' })
    const template = createTemplate({
      name: 'LinkedIn Connection Request',
      channel: 'linkedin',
      subject: '',
      body: 'Hi {contactName}.',
      variables: ['contactName'],
    })

    mockCallLLM.mockResolvedValue('Short connection message.')

    await generatePersonalizedMessage(template.id, business, undefined, {
      serviceOffering: 'consulting',
      resumeLink: '',
    })

    const prompt = mockCallLLM.mock.calls[0][0].prompt
    expect(prompt).toContain('300 characters')
  })
})

// ── Batch generation ─────────────────────────────────────────────────

describe('generateBatchMessages', () => {
  it('generates messages for multiple businesses', async () => {
    const b1 = createBusiness({ name: 'Biz A', category: 'Tech' })
    const b2 = createBusiness({ name: 'Biz B', category: 'Food' })
    const template = createTemplate({
      name: 'Batch Test',
      channel: 'email',
      subject: 'Hi {businessName}',
      body: 'Hello {contactName} at {businessName}.',
      variables: ['businessName', 'contactName'],
    })

    mockCallLLM
      .mockResolvedValueOnce('SUBJECT: Hi Biz A\nBODY: Hello there at Biz A.')
      .mockResolvedValueOnce('SUBJECT: Hi Biz B\nBODY: Hello there at Biz B.')

    const progressCalls: any[] = []
    const result = await generateBatchMessages(
      [b1.id, b2.id],
      template.id,
      { serviceOffering: 'consulting', resumeLink: '' },
      (p) => progressCalls.push(p),
    )

    expect(result.generated).toBe(2)
    expect(result.errors).toHaveLength(0)
    expect(progressCalls).toHaveLength(2)
    expect(progressCalls[0].current).toBe(1)
    expect(progressCalls[0].businessName).toBe('Biz A')
    expect(progressCalls[1].current).toBe(2)
  })

  it('saves generated messages as draft outreach records', async () => {
    const b = createBusiness({ name: 'Draft Test Biz' })
    const template = createTemplate({
      name: 'Draft Test',
      channel: 'linkedin',
      subject: '',
      body: 'Hello.',
      variables: [],
    })

    mockCallLLM.mockResolvedValue('Personalized LinkedIn message for Draft Test Biz.')

    await generateBatchMessages(
      [b.id],
      template.id,
      { serviceOffering: 'design', resumeLink: '' },
    )

    const outreach = getBusinessOutreach(b.id)
    expect(outreach.length).toBe(1)
    expect(outreach[0].status).toBe('draft')
    expect(outreach[0].channel).toBe('linkedin')
    expect(outreach[0].messageText).toContain('Personalized LinkedIn message')
  })

  it('handles errors gracefully and continues', async () => {
    const b1 = createBusiness({ name: 'Good Biz' })
    const b2 = createBusiness({ name: 'Bad Biz' })
    const template = createTemplate({
      name: 'Error Test',
      channel: 'email',
      subject: 'Test',
      body: 'Test.',
      variables: [],
    })

    mockCallLLM
      .mockResolvedValueOnce('SUBJECT: Test\nBODY: Good message.')
      .mockRejectedValueOnce(new Error('API rate limit'))

    const result = await generateBatchMessages(
      [b1.id, b2.id],
      template.id,
      { serviceOffering: '', resumeLink: '' },
    )

    expect(result.generated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Bad Biz')
    expect(result.errors[0]).toContain('API rate limit')
  })

  it('reports error for missing business IDs', async () => {
    const template = createTemplate({
      name: 'Missing Test',
      channel: 'email',
      subject: '',
      body: 'Test.',
      variables: [],
    })

    const result = await generateBatchMessages(
      ['nonexistent-id'],
      template.id,
      { serviceOffering: '', resumeLink: '' },
    )

    expect(result.generated).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Business not found')
  })
})
