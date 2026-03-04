/**
 * Apollo.io contact enrichment integration.
 *
 * Searches the Apollo People Search API for contacts at a given company,
 * stores them as contacts linked to the business.
 */

import https from 'https'
import { Contact, createContact, getBusinessContacts } from './outreach-db'

export interface ApolloContact {
  name: string
  title: string
  email: string
  linkedinUrl: string
}

export interface ApolloSearchResult {
  contacts: Contact[]
  found: number
}

const DEFAULT_TITLES = [
  'CEO',
  'Owner',
  'Founder',
  'CTO',
  'Marketing Director',
  'Hiring Manager',
]

/**
 * Call the Apollo.io People Search API.
 */
function callApolloApi(
  companyName: string,
  domain: string,
  apiKey: string,
): Promise<ApolloContact[]> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      person_titles: DEFAULT_TITLES,
      q_organization_name: companyName,
      organization_domains: [domain],
    })

    const req = https.request(
      {
        hostname: 'api.apollo.io',
        path: '/api/v1/mixed_people/search',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: string) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)

            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.message || `Apollo API error ${res.statusCode}`))
              return
            }

            const people: any[] = parsed.people || parsed.contacts || []
            const contacts: ApolloContact[] = people.map((p: any) => ({
              name: [p.first_name, p.last_name].filter(Boolean).join(' '),
              title: p.title || '',
              email: p.email || '',
              linkedinUrl: p.linkedin_url || '',
            }))

            resolve(contacts)
          } catch {
            reject(new Error('Failed to parse Apollo API response'))
          }
        })
      },
    )

    req.on('error', reject)
    req.setTimeout(30_000, () => {
      req.destroy()
      reject(new Error('Apollo API request timeout'))
    })
    req.write(body)
    req.end()
  })
}

/**
 * Extract domain from a URL string.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  }
}

/**
 * Search Apollo.io for contacts at a company and store them.
 */
export async function searchApolloContacts(
  companyName: string,
  domain: string,
  apiKey: string,
  businessId?: string,
): Promise<ApolloSearchResult> {
  const cleanDomain = extractDomain(domain)
  const apolloContacts = await callApolloApi(companyName, cleanDomain, apiKey)

  const storedContacts: Contact[] = []

  if (businessId) {
    // Get existing contacts to avoid duplicates
    const existing = getBusinessContacts(businessId)
    const existingEmails = new Set(existing.map(c => c.email.toLowerCase()).filter(Boolean))
    const existingNames = new Set(existing.map(c => c.name.toLowerCase()))

    for (const ac of apolloContacts) {
      // Skip duplicates by email or name
      if (ac.email && existingEmails.has(ac.email.toLowerCase())) continue
      if (ac.name && existingNames.has(ac.name.toLowerCase())) continue

      const contact = createContact({
        businessId,
        name: ac.name,
        title: ac.title,
        email: ac.email,
        linkedinUrl: ac.linkedinUrl,
        source: 'apollo',
      })
      storedContacts.push(contact)
    }
  }

  return {
    contacts: storedContacts,
    found: apolloContacts.length,
  }
}
