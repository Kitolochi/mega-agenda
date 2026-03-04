import type { OutreachChannel } from './outreach-db'

export interface DefaultTemplate {
  name: string
  channel: OutreachChannel
  subject: string
  body: string
  variables: string[]
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // ── Email Templates ──

  {
    name: 'Cold Email Introduction',
    channel: 'email',
    subject: 'Quick question about {businessName}',
    body: `Hi {contactName},

I came across {businessName} while researching {contactTitle} professionals in the Charlotte metro area and was genuinely impressed by what you have built.

Given the direction your industry is heading, I think there is a real opportunity for {businessName} to leverage {serviceOffering} to stand out even further. I have been helping similar businesses in your space drive measurable results, and I would love to share a few ideas specific to your situation.

Would you be open to a quick 15-minute call this week? I think you will find it worthwhile.

Here is a bit more about my work: {resumeLink}

Best regards`,
    variables: ['businessName', 'contactName', 'contactTitle', 'serviceOffering', 'resumeLink'],
  },

  {
    name: 'Follow-up Email #1',
    channel: 'email',
    subject: 'Following up — {businessName}',
    body: `Hi {contactName},

I wanted to circle back on my earlier note about how {serviceOffering} could benefit {businessName}. I know things get busy, so I wanted to make sure it did not slip through the cracks.

I have a couple of ideas tailored to your space that I think would resonate. Would a brief call this week or next work for you?

Looking forward to connecting.

Best regards`,
    variables: ['businessName', 'contactName', 'serviceOffering'],
  },

  {
    name: 'Follow-up Email #2',
    channel: 'email',
    subject: 'Last note — {personalHook}',
    body: `Hi {contactName},

Just one last note — I do not want to be a pest, but I genuinely believe {businessName} would benefit from exploring {serviceOffering}.

If the timing is not right, no worries at all. But if you are curious, I am just a reply away.

Wishing you and the team continued success.

Best regards`,
    variables: ['businessName', 'contactName', 'serviceOffering', 'personalHook'],
  },

  // ── LinkedIn Templates ──

  {
    name: 'LinkedIn Connection Request',
    channel: 'linkedin',
    subject: '',
    body: 'Hi {contactName}, fellow Charlotte metro professional here. I work in {serviceOffering} and love what {businessName} is doing. Would love to connect and exchange ideas.',
    variables: ['businessName', 'contactName', 'serviceOffering'],
  },

  {
    name: 'LinkedIn Follow-up DM',
    channel: 'linkedin',
    subject: '',
    body: `Thanks for connecting, {contactName}! I have been following {businessName} and I am impressed by your work as {contactTitle}.

I specialize in {serviceOffering} and have been helping businesses in your industry achieve stronger results. I would love to share a couple of ideas that could be relevant for {businessName}.

Would you be open to a quick chat? Here is a bit more about what I do: {resumeLink}`,
    variables: ['businessName', 'contactName', 'contactTitle', 'serviceOffering', 'resumeLink'],
  },

  // ── Social DM Templates ──

  {
    name: 'Instagram / Facebook DM',
    channel: 'instagram',
    subject: '',
    body: 'Hey {contactName}! I have been following {businessName} and really love what you are putting out there. I work in {serviceOffering} and have some ideas that could help take things to the next level. Would you be open to a quick chat? No pressure at all — check out my work here: {resumeLink}',
    variables: ['businessName', 'contactName', 'serviceOffering', 'resumeLink'],
  },

  {
    name: 'Facebook DM',
    channel: 'facebook',
    subject: '',
    body: 'Hi {contactName}! Came across {businessName} and had to reach out. I work in {serviceOffering} and have helped similar businesses grow their reach. I would love to share a couple of quick ideas with you — no strings attached. Feel free to check out my background: {resumeLink}',
    variables: ['businessName', 'contactName', 'serviceOffering', 'resumeLink'],
  },

  {
    name: 'X / Twitter DM',
    channel: 'twitter',
    subject: '',
    body: 'Hey {contactName}! Big fan of what {businessName} is doing. I specialize in {serviceOffering} and have been working with businesses in your space. I have a couple of ideas that might be useful — would love to share them if you are open to it. More about me: {resumeLink}',
    variables: ['businessName', 'contactName', 'serviceOffering', 'resumeLink'],
  },
]
