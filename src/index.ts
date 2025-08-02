import { Hono } from 'hono'
import axios from 'axios'

type Env = {
  Variables: {
    USERNAME: string
    API_KEY: string
  }
}

const app = new Hono<Env>()

const RESOURCE_IDS = '1,2,93,102,12'
const FILTER_KEYWORDS = [
  'beginner', 'easy', 'basic', 'abc', 'school',
  'div. 3', 'div.3', 'div 3',
  'div. 4', 'div.4', 'div 4',
  'biweekly', 'weekly', 'starters', 'cook-off', 'lunchtime'
]

const webhookUrl = 'https://discord.com/api/webhooks/1401124297254240276/6waK7rIp9eW7j81eeWze0FG3DcSL9pAK61orKBSgh4sVNy6uDbQrsGHcTjLpDBZ2WqgR'

function getISTRange(daysFromNow: number) {
  const istOffset = 5.5 * 60 * 60 * 1000
  const now = new Date()
  const targetDate = new Date(now.getTime() + istOffset + daysFromNow * 24 * 60 * 60 * 1000)
  const year = targetDate.getFullYear()
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getDate()).padStart(2, '0')

  const istStart = new Date(`${year}-${month}-${day}T00:00:00+05:30`)
  const istEnd = new Date(`${year}-${month}-${day}T23:59:59+05:30`)
  const utcStart = new Date(istStart.getTime() - istOffset).toISOString().split('.')[0]
  const utcEnd = new Date(istEnd.getTime() - istOffset).toISOString().split('.')[0]

  return { utcStart, utcEnd, dateLabel: `${day}-${month}-${year}` }
}

async function fetchContests(USERNAME: string, API_KEY: string, utcStart: string, utcEnd: string) {
  const url = `https://clist.by/api/v2/contest/?start__gt=${utcStart}&start__lt=${utcEnd}&order_by=start&resource_id__in=${RESOURCE_IDS}`

  const response = await axios.get(url, {
    headers: {
      Authorization: `ApiKey ${USERNAME}:${API_KEY}`,
    },
  })

  return response.data.objects
}

function formatContests(contests: any[], includeLink: boolean) {
  const istOffset = 5.5 * 60 * 60 * 1000

  return contests
    .filter((contest: any) =>
      FILTER_KEYWORDS.some(keyword =>
        contest.event.toLowerCase().includes(keyword)
      )
    )
    .map((contest: any, i: number) => {
      const durationSeconds = contest.duration
      const hours = Math.floor(durationSeconds / 3600)
      const minutes = Math.floor((durationSeconds % 3600) / 60)
      const durationFormatted = `${hours}h ${minutes}m`

      const startISTFormatted = new Date(new Date(contest.start).getTime() + istOffset).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: true,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
      })

      let platform = contest.resource.charAt(0).toUpperCase() + contest.resource.slice(1);

      let result = `🎯 **${contest.event}**\n\n` +
                    `🌐 Platform: \`${platform}\`\n\n` +
                    `🗓️ Start: \`${startISTFormatted}\`\n\n` +
                    `⌛ Duration: \`${durationFormatted}\`\n\n`;

      if (includeLink) {
        result += `🔗 [Join Contest](${contest.href})`
      }

      return result
    })
}

app.get('/contests', async (c) => {
  const { USERNAME, API_KEY } = c.env as Env['Variables']

  try {
    const today = getISTRange(0)
    const tomorrow = getISTRange(1)

    const [todayContestsRaw, tomorrowContestsRaw] = await Promise.all([
      fetchContests(USERNAME, API_KEY, today.utcStart, today.utcEnd),
      fetchContests(USERNAME, API_KEY, tomorrow.utcStart, tomorrow.utcEnd),
    ])

    const todayFormatted = formatContests(todayContestsRaw, true)
    const tomorrowFormatted = formatContests(tomorrowContestsRaw, false)

    const message = [
      `## **Contests for Today — \`${today.dateLabel}\`**`,
      todayFormatted.length ? todayFormatted.join('\n\n') : '❌ No contests found for today.',
      ``,
      `## **Contests for Tomorrow — \`${tomorrow.dateLabel}\`**`,
      tomorrowFormatted.length ? tomorrowFormatted.join('\n\n') : '❌ No contests found for tomorrow.',
    ].join('\n\n')

    const discordRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    })

    if (!discordRes.ok) {
      return c.text('❌ Failed to send message to Discord', 500)
    }

    return c.text("Sent on Discord")
  } catch (err: any) {
    console.error('Error:', err.response?.data || err.message)
    return c.json({ error: err.response?.data || 'Failed to fetch contests.' }, 500)
  }
})

export default app
