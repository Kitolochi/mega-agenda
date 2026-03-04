import { callLLM } from './llm'
import {
  getTemplate,
  getBusiness,
  getBusinessContacts,
  createOutreach,
  type Business,
  type Contact,
  type OutreachChannel,
} from './outreach-db'

// ── Types ──

export interface PersonalizeOptions {
  serviceOffering: string
  resumeLink: string
}

export interface PersonalizedMessage {
  subject?: string
  body: string
  channel: OutreachChannel
}

export interface BatchProgress {
  current: number
  total: number
  businessName: string
}

export interface BatchResult {
  generated: number
  errors: string[]
}

// ── Channel word/char limits ──

const CHANNEL_LIMITS: Record<string, { bodyWords?: number; bodyChars?: number; subjectWords?: number }> = {
  email: { bodyWords: 125, subjectWords: 7 },
  linkedin_connection: { bodyChars: 300 },
  linkedin: { bodyWords: 150 },
  instagram: { bodyWords: 100 },
  facebook: { bodyWords: 100 },
  twitter: { bodyWords: 100 },
}

function getLimitsForTemplate(channel: OutreachChannel, templateName: string) {
  if (channel === 'linkedin' && templateName.toLowerCase().includes('connection')) {
    return CHANNEL_LIMITS.linkedin_connection
  }
  return CHANNEL_LIMITS[channel] || { bodyWords: 125 }
}

// ── Build personalization prompt ──

function buildPrompt(
  templateBody: string,
  templateSubject: string,
  business: Business,
  contact: Contact | undefined,
  options: PersonalizeOptions,
  limits: { bodyWords?: number; bodyChars?: number; subjectWords?: number },
): string {
  const parts: string[] = []

  parts.push('You are a professional outreach copywriter. Personalize the following message template for a specific business.')
  parts.push('')
  parts.push('TEMPLATE:')
  if (templateSubject) {
    parts.push(`Subject: ${templateSubject}`)
  }
  parts.push(`Body: ${templateBody}`)
  parts.push('')
  parts.push('BUSINESS INFORMATION:')
  parts.push(`- Name: ${business.name}`)
  if (business.category) parts.push(`- Industry/Category: ${business.category}`)
  if (business.website) parts.push(`- Website: ${business.website}`)
  if (business.rating) parts.push(`- Rating: ${business.rating}/5`)
  if (business.reviewCount) parts.push(`- Reviews: ${business.reviewCount}`)
  if (business.address) parts.push(`- Location: ${business.address}`)

  if (contact) {
    parts.push('')
    parts.push('CONTACT INFORMATION:')
    parts.push(`- Name: ${contact.name}`)
    if (contact.title) parts.push(`- Title: ${contact.title}`)
  }

  parts.push('')
  parts.push('CONTEXT:')
  parts.push(`- Service offering: ${options.serviceOffering}`)
  parts.push(`- Resume/portfolio link: ${options.resumeLink}`)

  parts.push('')
  parts.push('INSTRUCTIONS:')
  parts.push('- Personalize the template for this specific business, referencing their industry, needs, or strengths.')
  parts.push('- Replace all template variables ({businessName}, {contactName}, etc.) with actual values.')
  parts.push('- If no contact name is available, use a natural greeting like "Hi there" instead.')
  parts.push('- Maintain a professional but warm, conversational tone.')
  parts.push('- Include a single clear call-to-action.')
  parts.push('- Do NOT use generic filler. Every sentence should feel tailored.')

  if (limits.bodyChars) {
    parts.push(`- Body MUST be under ${limits.bodyChars} characters total.`)
  }
  if (limits.bodyWords) {
    parts.push(`- Body MUST be under ${limits.bodyWords} words.`)
  }
  if (limits.subjectWords) {
    parts.push(`- Subject line MUST be under ${limits.subjectWords} words.`)
  }

  parts.push('')
  if (templateSubject) {
    parts.push('Respond with ONLY the personalized message in this exact format:')
    parts.push('SUBJECT: <personalized subject>')
    parts.push('BODY: <personalized body>')
  } else {
    parts.push('Respond with ONLY the personalized message body text. No labels, no extra formatting.')
  }

  return parts.join('\n')
}

// ── Parse LLM response ──

function parseResponse(raw: string, hasSubject: boolean): { subject?: string; body: string } {
  const trimmed = raw.trim()

  if (hasSubject) {
    const subjectMatch = trimmed.match(/^SUBJECT:\s*(.+)/im)
    const bodyMatch = trimmed.match(/^BODY:\s*([\s\S]+)/im)

    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].trim(),
        body: bodyMatch[1].trim(),
      }
    }
  }

  return { body: trimmed }
}

// ── Generate personalized message ──

export async function generatePersonalizedMessage(
  templateId: string,
  business: Business,
  contact?: Contact,
  options: PersonalizeOptions = { serviceOffering: '', resumeLink: '' },
): Promise<PersonalizedMessage> {
  const template = getTemplate(templateId)
  if (!template) throw new Error(`Template not found: ${templateId}`)

  const limits = getLimitsForTemplate(template.channel, template.name)
  const prompt = buildPrompt(
    template.body,
    template.subject,
    business,
    contact,
    options,
    limits,
  )

  const response = await callLLM({
    prompt,
    system: 'You are a concise, professional outreach copywriter. Follow the instructions exactly. Output only the requested content with no preamble or commentary.',
    tier: 'fast',
    maxTokens: 1024,
  })

  const parsed = parseResponse(response, !!template.subject)

  return {
    subject: parsed.subject,
    body: parsed.body,
    channel: template.channel,
  }
}

// ── Batch generation ──

export async function generateBatchMessages(
  businessIds: string[],
  templateId: string,
  options: PersonalizeOptions,
  onProgress?: (progress: BatchProgress) => void,
): Promise<BatchResult> {
  const errors: string[] = []
  let generated = 0

  for (let i = 0; i < businessIds.length; i++) {
    const businessId = businessIds[i]
    const business = getBusiness(businessId)

    if (!business) {
      errors.push(`Business not found: ${businessId}`)
      continue
    }

    onProgress?.({ current: i + 1, total: businessIds.length, businessName: business.name })

    try {
      const contacts = getBusinessContacts(businessId)
      const contact = contacts.length > 0 ? contacts[0] : undefined

      const message = await generatePersonalizedMessage(templateId, business, contact, options)

      const template = getTemplate(templateId)
      createOutreach({
        businessId,
        contactId: contact?.id ?? null,
        channel: template!.channel,
        messageText: message.subject
          ? `Subject: ${message.subject}\n\n${message.body}`
          : message.body,
        status: 'draft',
      })

      generated++
    } catch (err: any) {
      errors.push(`${business.name}: ${err.message || 'Generation failed'}`)
    }
  }

  return { generated, errors }
}
