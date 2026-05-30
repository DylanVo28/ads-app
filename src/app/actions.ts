'use server'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export type GoogleAdAdvertiserSuggestion = {
  type: 'advertiser'
  name: string
  advertiserId: string
  region: string
  minAds?: string
  maxAds?: string
  verified?: boolean
}

export type GoogleAdDomainSuggestion = {
  type: 'domain'
  domain: string
}

export type GoogleAdSearchSuggestion =
  | GoogleAdAdvertiserSuggestion
  | GoogleAdDomainSuggestion

export type GoogleAdSearchSuggestionsResult = {
  suggestions: GoogleAdSearchSuggestion[]
  nextPageToken?: string
  raw: unknown
}

export type GoogleAdCreative = {
  advertiserId: string
  creativeId: string
  advertiserName: string
  domain?: string
  format?: number
  imageHtml?: string
  imageUrl?: string
  firstShownAt?: string
  lastShownAt?: string
  regionStats?: number
}

export type GoogleAdCreativesResult = {
  creatives: GoogleAdCreative[]
  nextPageToken?: string
  total?: string
  requestId?: string
  raw: unknown
}

export type GoogleAdCreativeByIdResult = {
  creative?: GoogleAdCreative
  raw: unknown
}

type GoogleAdSuggestionsRpcResponse = {
  '1'?: Array<{
    '1'?: {
      '1'?: string
      '2'?: string
      '3'?: string
      '4'?: {
        '2'?: {
          '1'?: string
          '2'?: string
        }
      }
      '5'?: boolean
    }
    '2'?: {
      '1'?: string
    }
  }>
  '3'?: string
}

const SEARCH_SUGGESTIONS_URL =
  'https://adstransparency.google.com/anji/_/rpc/SearchService/SearchSuggestions?authuser=0'

const SEARCH_CREATIVES_URL =
  'https://adstransparency.google.com/anji/_/rpc/SearchService/SearchCreatives?authuser=0'

const GET_CREATIVE_BY_ID_URL =
  'https://adstransparency.google.com/anji/_/rpc/LookupService/GetCreativeById?authuser=0'

const GOOGLE_ADS_CACHE_TTL_MS = 10 * 60 * 1000
const GOOGLE_ADS_RETRY_DELAYS_MS = [750, 1500, 3000]
const execFileAsync = promisify(execFile)

type CacheEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

const creativeByIdCache = new Map<string, CacheEntry<GoogleAdCreativeByIdResult>>()
const creativesCache = new Map<string, CacheEntry<GoogleAdCreativesResult>>()
const suggestionsCache = new Map<string, CacheEntry<GoogleAdSearchSuggestionsResult>>()

function getCachedGoogleAdsResult<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  loader: () => Promise<T>,
) {
  const now = Date.now()
  const cached = cache.get(key)

  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = loader().catch((error) => {
    cache.delete(key)
    throw error
  })

  cache.set(key, {
    expiresAt: now + GOOGLE_ADS_CACHE_TTL_MS,
    promise,
  })

  return promise
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function postGoogleAdsRpcWithCurl(
  url: string,
  headers: HeadersInit,
  encodedFields: Record<string, string>,
) {
  const headerEntries = new Headers(headers).entries()
  const args = [
    '--silent',
    '--show-error',
    '--location',
    '--write-out',
    '\n%{http_code}',
    url,
  ]

  for (const [name, value] of headerEntries) {
    args.push('--header', `${name}: ${value}`)
  }

  for (const [name, value] of Object.entries(encodedFields)) {
    args.push('--data-urlencode', `${name}=${value}`)
  }

  const { stdout } = await execFileAsync('curl', args, {
    maxBuffer: 2 * 1024 * 1024,
  })
  const statusSeparatorIndex = stdout.lastIndexOf('\n')
  const text = stdout.slice(0, statusSeparatorIndex)
  const status = Number(stdout.slice(statusSeparatorIndex + 1))

  return { ok: status >= 200 && status < 300, status, statusText: '', text }
}

async function fetchGoogleAdsRpc(
  url: string,
  init: RequestInit,
  options?: { retry429?: boolean },
): Promise<Response> {
  let response = await fetch(url, init)

  if (options?.retry429 === false) {
    return response
  }

  for (const delay of GOOGLE_ADS_RETRY_DELAYS_MS) {
    if (response.status !== 429) {
      break
    }

    const retryAfter = Number(response.headers.get('retry-after'))
    await sleep(retryAfter > 0 ? retryAfter * 1000 : delay)
    response = await fetch(url, init)
  }

  return response
}

export async function fetchGoogleAdSearchSuggestions(
  keyword: string,
  options?: {
    limit?: number
    regionIds?: number[]
    language?: 'en-US' | string
  },
): Promise<GoogleAdSearchSuggestionsResult> {
  const query = keyword.trim()

  if (!query) {
    return { suggestions: [], raw: null }
  }

  const limit = options?.limit ?? 10
  const cacheKey = JSON.stringify({
    query: query.toLowerCase(),
    limit,
    regionIds: options?.regionIds ?? [],
    language: options?.language ?? 'en-US',
  })

  return getCachedGoogleAdsResult(suggestionsCache, cacheKey, async () => {
    const requestPayload: Record<string, unknown> = {
      '1': query,
      '2': limit,
      '3': limit,
      '5': { '1': 1 },
    }

    if (options?.regionIds?.length) {
      requestPayload['4'] = options.regionIds
    }

    const requestPayloadJson = JSON.stringify(requestPayload)
    const headers = buildGoogleAdsTransparencyHeaders({
      language: options?.language,
      referer: 'https://adstransparency.google.com/?authuser=0&region=anywhere',
    })
    const response = await postGoogleAdsRpcWithCurl(
      SEARCH_SUGGESTIONS_URL,
      headers,
      { 'f.req': requestPayloadJson },
    )

    if (!response.ok) {
      throw new Error(
        `Google Ads Transparency suggestions failed: ${response.status} ${response.statusText}`,
      )
    }

    const text = response.text
    const data = JSON.parse(stripJsonPrefix(text)) as GoogleAdSuggestionsRpcResponse

    return {
      suggestions: normalizeSuggestions(data),
      nextPageToken: data['3'],
      raw: data,
    }
  })
}

function normalizeSuggestions(
  data: GoogleAdSuggestionsRpcResponse,
): GoogleAdSearchSuggestion[] {
  return (data['1'] ?? []).flatMap<GoogleAdSearchSuggestion>((item) => {
    const advertiser = item['1']
    const domain = item['2']

    if (advertiser) {
      return [
        {
          type: 'advertiser' as const,
          name: advertiser['1'] ?? '',
          advertiserId: advertiser['2'] ?? '',
          region: advertiser['3'] ?? '',
          minAds: advertiser['4']?.['2']?.['1'],
          maxAds: advertiser['4']?.['2']?.['2'],
          verified: !advertiser['5'],
        },
      ]
    }

    if (domain?.['1']) {
      return [{ type: 'domain' as const, domain: domain['1'] }]
    }

    return []
  })
}

function stripJsonPrefix(text: string) {
  return text.replace(/^\)\]\}'\n?/, '')
}


type GoogleAdCreativesRpcResponse = {
  '1'?: Array<{
    '1'?: string
    '2'?: string
    '3'?: {
      '3'?: {
        '2'?: string
      }
    }
    '4'?: number
    '6'?: GoogleTimestamp
    '7'?: GoogleTimestamp
    '12'?: string
    '13'?: number
    '14'?: string
  }>
  '2'?: string
  '4'?: string
  '5'?: string
}

type GoogleAdCreativeByIdRpcResponse = GoogleAdCreativesRpcResponse['1'] extends Array<infer T>
  ? T | { '1'?: T }
  : unknown

type GoogleTimestamp = {
  '1'?: string
  '2'?: number
}

export async function fetchGoogleAdCreatives(
  advertiserIdOrDomain: string,
  options?: {
    limit?: number
    pageSize?: number
    regionId?: number
    topicIds?: number[]
    nextPageToken?: string
    language?: 'en-US' | string
  },
): Promise<GoogleAdCreativesResult> {
  const id = advertiserIdOrDomain.trim()

  if (!id) {
    return { creatives: [], raw: null }
  }

  const cacheKey = JSON.stringify({
    id,
    limit: options?.limit ?? 40,
    pageSize: options?.pageSize ?? 25,
    regionId: options?.regionId ?? 2704,
    topicIds: options?.topicIds ?? [options?.regionId ?? 2704],
    nextPageToken: options?.nextPageToken ?? '',
    language: options?.language ?? 'en-US',
  })

  return getCachedGoogleAdsResult(creativesCache, cacheKey, () =>
    fetchGoogleAdCreativesUncached(id, options),
  )
}

async function fetchGoogleAdCreativesUncached(
  id: string,
  options?: {
    limit?: number
    pageSize?: number
    regionId?: number
    topicIds?: number[]
    nextPageToken?: string
    language?: 'en-US' | string
  },
): Promise<GoogleAdCreativesResult> {

  const regionId = options?.regionId ?? 2704
  const isDomainRequest = isDomain(id)
  const body = new URLSearchParams({
    'f.req': JSON.stringify({
      '2': options?.limit ?? 40,
      '3': {
        '8': options?.topicIds ?? [regionId],
        '12': { '1': options?.nextPageToken ?? (isDomainRequest ? id : ''), '2': true },
        ...(isDomainRequest ? {} : { '13': { '1': [id] } }),
      },
      '7': {
        '1': 1,
        '2': options?.pageSize ?? 25,
        '3': regionId,
      },
    }),
  })

  const response = await fetchGoogleAdsRpc(SEARCH_CREATIVES_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: buildGoogleAdsTransparencyHeaders({
      language: options?.language,
      referer: isDomainRequest
        ? `https://adstransparency.google.com/?authuser=0&domain=${encodeURIComponent(id)}`
        : `https://adstransparency.google.com/advertiser/${id}?authuser=0`,
    }),
    body,
  })

  if (!response.ok) {
    throw new Error(
      `Google Ads Transparency creatives failed: ${response.status} ${response.statusText}`,
    )
  }

  const text = await response.text()
  const data = JSON.parse(stripJsonPrefix(text)) as GoogleAdCreativesRpcResponse

  if (!data['1']) {
    throw new Error(
      'Google Ads Transparency creatives returned empty data. Add GOOGLE_ADS_TRANSPARENCY_COOKIE and GOOGLE_ADS_TRANSPARENCY_XSRF_TOKEN to .env.local, then restart Next.js.',
    )
  }

  return {
    creatives: normalizeCreatives(data),
    nextPageToken: data['2'],
    total: data['4'],
    requestId: data['5'],
    raw: data,
  }
}

export async function fetchGoogleAdCreativeById(
  advertiserId: string,
  creativeId: string,
  options?: {
    pageSize?: number
    regionId?: number
    language?: 'en-US' | string
  },
): Promise<GoogleAdCreativeByIdResult> {
  const normalizedAdvertiserId = advertiserId.trim()
  const normalizedCreativeId = creativeId.trim()

  if (!normalizedAdvertiserId || !normalizedCreativeId) {
    return { raw: null }
  }

  const cacheKey = JSON.stringify({
    advertiserId: normalizedAdvertiserId,
    creativeId: normalizedCreativeId,
    pageSize: options?.pageSize ?? 25,
    regionId: options?.regionId ?? 2704,
    language: options?.language ?? 'en-US',
  })

  return getCachedGoogleAdsResult(creativeByIdCache, cacheKey, () =>
    fetchGoogleAdCreativeByIdUncached(
      normalizedAdvertiserId,
      normalizedCreativeId,
      options,
    ),
  )
}

async function fetchGoogleAdCreativeByIdUncached(
  normalizedAdvertiserId: string,
  normalizedCreativeId: string,
  options?: {
    pageSize?: number
    regionId?: number
    language?: 'en-US' | string
  },
): Promise<GoogleAdCreativeByIdResult> {
  const regionId = options?.regionId ?? 2704
  const body = new URLSearchParams({
    'f.req': JSON.stringify({
      '1': normalizedAdvertiserId,
      '2': normalizedCreativeId,
      '5': {
        '1': 1,
        '2': options?.pageSize ?? 25,
        '3': regionId,
      },
    }),
  })

  const response = await fetchGoogleAdsRpc(GET_CREATIVE_BY_ID_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: buildGoogleAdsTransparencyHeaders({
      language: options?.language,
      referer: `https://adstransparency.google.com/advertiser/${normalizedAdvertiserId}/creative/${normalizedCreativeId}?authuser=0`,
    }),
    body,
  })

  if (!response.ok) {
    throw new Error(
      `Google Ads Transparency creative lookup failed: ${response.status} ${response.statusText}`,
    )
  }

  const text = await response.text()
  const data = JSON.parse(stripJsonPrefix(text)) as GoogleAdCreativeByIdRpcResponse
  const creativeData = unwrapCreativeByIdResponse(data)

  return {
    creative: creativeData ? normalizeCreative(creativeData) : undefined,
    raw: data,
  }
}

function isDomain(value: string) {
  return !/^AR\d+$/.test(value)
}

function buildGoogleAdsTransparencyHeaders(options?: {
  language?: string
  referer?: string
}): HeadersInit {
  return {
    accept: '*/*',
    'accept-language': options?.language ?? 'en-US,en;q=0.7',
    'content-type': 'application/x-www-form-urlencoded',
    origin: 'https://adstransparency.google.com',
    priority: 'u=1, i',
    referer:
      options?.referer ?? 'https://adstransparency.google.com/?authuser=0',
    'sec-ch-ua': '"Brave";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    'x-same-domain': '1',
    ...(process.env.GOOGLE_ADS_TRANSPARENCY_XSRF_TOKEN
      ? {
          'x-framework-xsrf-token':
            process.env.GOOGLE_ADS_TRANSPARENCY_XSRF_TOKEN,
        }
      : {}),
    ...(process.env.GOOGLE_ADS_TRANSPARENCY_COOKIE
      ? { cookie: process.env.GOOGLE_ADS_TRANSPARENCY_COOKIE }
      : {}),
  }
}

function normalizeCreatives(data: GoogleAdCreativesRpcResponse): GoogleAdCreative[] {
  return (data['1'] ?? []).map(normalizeCreative)
}

function normalizeCreative(
  creative: NonNullable<GoogleAdCreativesRpcResponse['1']>[number],
): GoogleAdCreative {
  const imageHtml = creative['3']?.['3']?.['2']

  return {
    advertiserId: creative['1'] ?? '',
    creativeId: creative['2'] ?? '',
    advertiserName: creative['12'] ?? '',
    domain: creative['14'],
    format: creative['4'],
    imageHtml,
    imageUrl: extractImageUrl(imageHtml),
    firstShownAt: toIsoString(creative['6']),
    lastShownAt: toIsoString(creative['7']),
    regionStats: creative['13'],
  }
}

function unwrapCreativeByIdResponse(data: GoogleAdCreativeByIdRpcResponse) {
  if (!data || typeof data !== 'object') {
    return undefined
  }

  if ('2' in data) {
    return data as NonNullable<GoogleAdCreativesRpcResponse['1']>[number]
  }

  if ('1' in data && data['1'] && typeof data['1'] === 'object') {
    return data['1'] as NonNullable<GoogleAdCreativesRpcResponse['1']>[number]
  }

  return undefined
}

function extractImageUrl(html?: string) {
  return html?.match(/src="([^"]+)"/)?.[1]
}

function toIsoString(timestamp?: GoogleTimestamp) {
  if (!timestamp?.['1']) {
    return undefined
  }

  const milliseconds = Number(timestamp['1']) * 1000 + Math.floor((timestamp['2'] ?? 0) / 1_000_000)

  return new Date(milliseconds).toISOString()
}
