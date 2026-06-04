import type { TrafficApiResponse } from "./types";

const TRAFFIC_API_URL = "https://traffic.workfast.cc/";
const DEFAULT_TRAFFIC_CLIENT_ID = "ab11def3ae47cc5cfd9f667b0bf35392c08815a8b39dda29___";
const TRAFFIC_SIGN_SECRET = "2@3&^8d4$%H9,M";

type FetchTrafficOptions = {
  domain: string;
  timestamp?: string;
  source?: string;
  clientId?: string;
  sign?: string;
};

export async function fetchTrafficOverview({
  domain,
  timestamp = Date.now().toString(),
  source = "extension",
  clientId = process.env.TRAFFIC_CLIENT_ID || DEFAULT_TRAFFIC_CLIENT_ID,
  sign,
}: FetchTrafficOptions): Promise<TrafficApiResponse> {
  const trafficSign = sign
    ? { timestamp, clientId, sign }
    : await createTrafficSign(clientId, timestamp);
  const upstreamUrl = new URL(TRAFFIC_API_URL);
  upstreamUrl.searchParams.set("domain", domain);
  upstreamUrl.searchParams.set("timestamp", trafficSign.timestamp);
  upstreamUrl.searchParams.set("source", source);
  upstreamUrl.searchParams.set("clientId", trafficSign.clientId);
  upstreamUrl.searchParams.set("sign", trafficSign.sign);

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

async function createTrafficSign(clientId: string, timestamp = Date.now().toString()) {
  const raw = clientId + timestamp + TRAFFIC_SIGN_SECRET;
  const bytes = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const sign = Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 32);

  return {
    timestamp,
    clientId,
    sign,
  };
}
