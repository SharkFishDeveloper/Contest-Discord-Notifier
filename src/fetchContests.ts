import axios from "axios"
import { getUTCRange } from "./utcRange"

const RESOURCE_IDS = '1,2,93,102,12'

 export async function fetchContests(USERNAME: string, API_KEY: string) {
    const { utcStart, utcEnd } = getUTCRange()
    const url = `https://clist.by/api/v2/contest/?start__gt=${utcStart}&start__lt=${utcEnd}&order_by=start&resource_id__in=${RESOURCE_IDS}`

    const response = await axios.get(url, {
      headers: {
        Authorization: `ApiKey ${USERNAME}:${API_KEY}`,
      },
    })
    return response.data.objects
  }