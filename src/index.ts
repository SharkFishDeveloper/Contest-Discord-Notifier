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
    const now = new Date()

    // Convert `now` to IST
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    istNow.setDate(istNow.getDate() + daysFromNow)

    // Get start and end of that IST day
    const istStart = new Date(istNow)
    istStart.setHours(0, 0, 0, 0)

    const istEnd = new Date(istNow)
    istEnd.setHours(23, 59, 59, 999)

    // Convert IST start/end to UTC
    const utcStart = new Date(istStart.toLocaleString('en-US', { timeZone: 'UTC' }))
    const utcEnd = new Date(istEnd.toLocaleString('en-US', { timeZone: 'UTC' }))

    const dateLabel = `${String(istNow.getDate()).padStart(2, '0')}-${String(istNow.getMonth() + 1).padStart(2, '0')}-${istNow.getFullYear()}`

    return {
      utcStart: utcStart.toISOString().split('.')[0],
      utcEnd: utcEnd.toISOString().split('.')[0],
      dateLabel
    }
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

  function formatContestsWithLiveCheck(contests: any[], includeLink: boolean) {
    const istOffset = 5.5 * 60 * 60 * 1000
    const now = new Date()

    const allToday: string[] = []
    const liveNow: string[] = []

    contests
      .filter((contest: any) =>
        FILTER_KEYWORDS.some(keyword =>
          contest.event.toLowerCase().includes(keyword)
        )
      )
      .forEach((contest: any) => {
        const start = new Date(contest.start)
        const end = new Date(start.getTime() + contest.duration * 1000)

        const hours = Math.floor(contest.duration / 3600)
        const minutes = Math.floor((contest.duration % 3600) / 60)
        const durationFormatted = `${hours}h ${minutes}m`

        const startISTFormatted = new Date(start.getTime() + istOffset).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit'
        })

        let platform = contest.resource.charAt(0).toUpperCase() + contest.resource.slice(1)

        let result = `🎯 **${contest.event}**\n\n` +
                    `🌐 Platform: \`${platform}\`\n\n` +
                    `🗓️ Start: \`${startISTFormatted}\`\n\n` +
                    `⌛ Duration: \`${durationFormatted}\`\n\n`

        if (includeLink) {
          result += `🔗 [Join Contest](${contest.href})`
        }

        allToday.push(result)

        if (start <= now && now <= end) {
          liveNow.push(result)
        }
      })

    return { allToday, liveNow }
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

      const { allToday, liveNow } = formatContestsWithLiveCheck(todayContestsRaw, true)
      const { allToday: tomorrowContests } = formatContestsWithLiveCheck(tomorrowContestsRaw, true)


      const message = [
    `## ✅ Contests for Today — \`${today.dateLabel}\``,
    allToday.length ? allToday.join('\n\n') : '❌ No contests found for today.',
    ``,
    `## 🔴 Live Contests Happening Now`,
    liveNow.length ? liveNow.join('\n\n') : '🛑 No contests are currently live.',
    ``,
    `## 📅 Contests for Tomorrow — \`${tomorrow.dateLabel}\``,
    tomorrowContests.length ? tomorrowContests.join('\n\n') : '❌ No contests found for tomorrow.',
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
