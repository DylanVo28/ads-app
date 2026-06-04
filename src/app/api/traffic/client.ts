import type { TrafficApiResponse } from "./types";

const TRAFFIC_API_URL = "https://traffic.workfast.cc/";
const DEFAULT_TRAFFIC_TIMESTAMP = "1780560383237";
const DEFAULT_TRAFFIC_CLIENT_ID = "ab11def3ae47cc5cfd9f667b0bf35392c08815a8b39dda29___";
const DEFAULT_TRAFFIC_SIGN = "8a1cce7a33ab697a8504bc690e9ec626";

type FetchTrafficOptions = {
  domain: string;
  timestamp?: string;
  source?: string;
  clientId?: string;
  sign?: string;
};

export async function fetchTrafficOverview({
  domain,
  timestamp = process.env.TRAFFIC_TIMESTAMP || DEFAULT_TRAFFIC_TIMESTAMP,
  source = "extension",
  clientId = process.env.TRAFFIC_CLIENT_ID || DEFAULT_TRAFFIC_CLIENT_ID,
  sign = process.env.TRAFFIC_SIGN || DEFAULT_TRAFFIC_SIGN,
}: FetchTrafficOptions): Promise<TrafficApiResponse> {
  const upstreamUrl = new URL(TRAFFIC_API_URL);
  upstreamUrl.searchParams.set("domain", domain);
  upstreamUrl.searchParams.set("timestamp", timestamp);
  upstreamUrl.searchParams.set("source", source);
  upstreamUrl.searchParams.set("clientId", clientId);
  upstreamUrl.searchParams.set("sign", sign);

  const response = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9,vi;q=0.8",
      priority: "u=1, i",
      "sec-ch-ua": '"Brave";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "none",
      "sec-fetch-storage-access": "active",
      "sec-gpc": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Traffic API failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TrafficApiResponse;
}
