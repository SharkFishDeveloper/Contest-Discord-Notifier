import { Hono } from 'hono'
import axios from 'axios'
import { fetchContests } from './fetchContests'

type Env = {
  Variables: {
    USERNAME: string
    API_KEY: string
  }
}

const app = new Hono<Env>()

const FILTER_KEYWORDS = [
  'beginner', 'easy', 'basic', 'abc', 'school',
  'div. 3', 'div.3', 'div 3',
  'div. 4', 'div.4', 'div 4',
  'biweekly', 'weekly', 'starters', 'cook-off', 'lunchtime'
]

const webhookUrl = 'https://discord.com/api/webhooks/1401124297254240276/6waK7rIp9eW7j81eeWze0FG3DcSL9pAK61orKBSgh4sVNy6uDbQrsGHcTjLpDBZ2WqgR'

app.get('/contests', async (c) => {
  const { USERNAME, API_KEY } = c.env as Env['Variables']
  const contests = await fetchContests(USERNAME, API_KEY)

  const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr + 'Z')
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', '') // remove comma between date and year
}

const contestsInIST = contests
  .filter((contest: any) => {
    const eventLower = contest.event.toLowerCase()
    return FILTER_KEYWORDS.some(keyword => eventLower.includes(keyword))
  })
  .map((contest: any) => {
    const start_ist = formatDateTime(contest.start)
    const end_ist = formatDateTime(contest.end)

    const hours = Math.floor(contest.duration / 3600)
    const minutes = Math.floor((contest.duration % 3600) / 60)
    const duration_hm = `${hours}h ${minutes}m`

    return {
      event: contest.event,
      href: contest.href,
      start_ist,
      end_ist,
      duration_hm,
      resource: contest.resource.charAt(0).toUpperCase() + contest.resource.slice(1),
    }
  })
  .slice(0, 7)


  function parseISTDate(str: string): Date {
  // Parse '6 Aug 2025 8:00 pm' to Date in Asia/Kolkata
  return new Date(
    new Date(str).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  )
}

function getISTDayOffset(date: Date): number {
  const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  const nowIST = new Date(now)

  const startDay = new Date(date)
  startDay.setHours(0, 0, 0, 0)
  nowIST.setHours(0, 0, 0, 0)

  const msInDay = 24 * 60 * 60 * 1000
  return Math.floor((startDay.getTime() - nowIST.getTime()) / msInDay)
}

const todayContests: any[] = []
const tomorrowContests: any[] = []
const dayAfterContests: any[] = []

for (const contest of contestsInIST) {
  const startDate = parseISTDate(contest.start_ist)
  const dayOffset = getISTDayOffset(startDate)

  if (dayOffset === 0) {
    todayContests.push(contest)
  } else if (dayOffset === 1) {
    tomorrowContests.push(contest)
  } else if (dayOffset === 2) {
    dayAfterContests.push(contest)
  }
}
const formatContests = (contests: any[], dayLabel: string) => {
  if (contests.length === 0) return `**${dayLabel}**\n_No contests_\n`;
  return `**${dayLabel}**\n` + contests.map((contest, index) => {
    return `**${index + 1}. [${contest.event}](${contest.href})**\n` +
           `📅 Start: \`${contest.start_ist}\`\n` +
           `⏱️ End: \`${contest.end_ist}\`\n` +
           `🕒 Duration: \`${contest.duration_hm}\`\n` +
           `🌐 Platform: \`${contest.resource}\`\n`;
  }).join('\n');
};
const now = new Date();
const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
const istTimeString = istNow.toLocaleTimeString('en-IN', { hour12: true });
const istDateString = istNow.toLocaleDateString('en-IN');

// Construct time string
const timeInfo = `🕒 IST Time: ${istDateString} ${istTimeString}\n`;

const message = 
  formatContests(todayContests, '📅 Today\'s Contests') + '\n' +
  formatContests(tomorrowContests, '📅 Tomorrow\'s Contests') + '\n' +
  formatContests(dayAfterContests, '📅 Day After Tomorrow\'s Contests')+
  timeInfo ;

await axios.post(webhookUrl, {
  content: message,
});

return c.json({
  status: 'sent',
  today: todayContests.length,
  tomorrow: tomorrowContests.length,
  dayAfterTomorrow: dayAfterContests.length,
});

});

export default app
