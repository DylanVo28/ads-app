import { fetchGoogleAdCreatives, type GoogleAdCreative } from "../../../../actions";
import { fetchTrafficOverview } from "../../../traffic/client";
import type { TrafficApiResponse } from "../../../traffic/types";

export const dynamic = "force-dynamic";

const MAX_CREATIVE_PAGES = 100;
const PAGE_SIZE = 40;

type CellValue = string | number | boolean | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const advertiserId = searchParams.get("advertiserId")?.trim();
  const domain = searchParams.get("domain")?.trim();

  if (!advertiserId) {
    return Response.json({ error: "Missing advertiserId" }, { status: 400 });
  }

  if (!domain) {
    return Response.json({ error: "Missing domain" }, { status: 400 });
  }

  try {
    const [creatives, traffic] = await Promise.all([
      fetchAllCreativesWithFallback(advertiserId, domain),
      fetchTrafficOverview({ domain }),
    ]);
    const workbook = buildWorkbookXml(buildWorksheets({ advertiserId, domain, creatives, traffic }));
    const filename = sanitizeFilename(`ads-${domain || advertiserId}.xls`);

    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot export Excel";

    return Response.json({ error: message }, { status: 502 });
  }
}

async function fetchAllAdvertiserCreatives(advertiserId: string) {
  const creatives: GoogleAdCreative[] = [];
  const seenCreativeIds = new Set<string>();
  let nextPageToken: string | undefined;

  for (let page = 0; page < MAX_CREATIVE_PAGES; page += 1) {
    const result = await fetchGoogleAdCreatives(advertiserId, {
      limit: PAGE_SIZE,
      pageSize: PAGE_SIZE,
      nextPageToken,
    });

    for (const creative of result.creatives) {
      if (!creative.creativeId || seenCreativeIds.has(creative.creativeId)) {
        continue;
      }

      seenCreativeIds.add(creative.creativeId);
      creatives.push(creative);
    }

    nextPageToken = result.nextPageToken;

    if (!nextPageToken) {
      break;
    }
  }

  return creatives;
}

async function fetchAllCreativesWithFallback(advertiserId: string, domain: string) {
  const advertiserCreatives = await fetchAllAdvertiserCreatives(advertiserId);

  if (advertiserCreatives.length > 0) {
    return advertiserCreatives;
  }

  // If advertiser search returns empty, domain search still gives the creative rows for export.
  return fetchAllAdvertiserCreatives(domain);
}

function buildWorksheets({
  advertiserId,
  domain,
  creatives,
  traffic,
}: {
  advertiserId: string;
  domain: string;
  creatives: GoogleAdCreative[];
  traffic: TrafficApiResponse;
}): Worksheet[] {
  return [
    {
      name: "Traffic stats",
      rows: [
        ["Metric", "Value"],
        ["Domain", traffic.SiteName || domain],
        ["Description", traffic.Description || "-"],
        ["Category", traffic.Category || traffic.CategoryRank?.Category || "-"],
        ["Monthly visit", parseNumber(traffic.Engagments?.Visits)],
        ["Bounce rate", formatPercent(parseNumber(traffic.Engagments?.BounceRate))],
        ["Pages per visit", formatDecimal(parseNumber(traffic.Engagments?.PagePerVisit))],
        ["Visit duration", formatDuration(parseNumber(traffic.Engagments?.TimeOnSite))],
        ["Domain created", formatDate(traffic.DateData?.registration)],
        ["Domain expires", formatDate(traffic.DateData?.expiration)],
        ["Google ads", creatives.length],
        ["SERP", "-"],
        ["DR", "-"],
        ["Global rank", traffic.GlobalRank?.Rank ?? "-"],
        ["Country rank", traffic.CountryRank ? `${traffic.CountryRank.CountryCode} #${traffic.CountryRank.Rank}` : "-"],
        ["Snapshot date", formatDate(traffic.SnapshotDate)],
        ["Advertiser ID", advertiserId],
        ["From cache", traffic.fromCache],
      ],
    },
    {
      name: "Domain list",
      rows: [
        ["Ten creative", "Domain creative", "Time lan dau", "Time lan cuoi"],
        ...creatives.map((creative) => [
          creative.advertiserName || creative.creativeId || "-",
          creative.imageUrl || "-",
          formatDate(creative.firstShownAt),
          formatDate(creative.lastShownAt),
        ]),
      ],
    },
    {
      name: "Visit over time",
      rows: [
        ["Month", "Visits"],
        ...Object.entries(traffic.EstimatedMonthlyVisits || {}).map(([month, visits]) => [month, visits]),
      ],
    },
    {
      name: "Traffic sources",
      rows: [
        ["Source", "Share"],
        ...Object.entries(traffic.TrafficSources || {}).map(([source, share]) => [source, formatPercent(share)]),
      ],
    },
    {
      name: "Top keywords",
      rows: [
        ["Keyword", "Volume", "CPC", "Estimated value"],
        ...(traffic.TopKeywords || []).map((keyword) => [
          keyword.Name,
          keyword.Volume,
          keyword.Cpc ?? "-",
          keyword.EstimatedValue,
        ]),
      ],
    },
    {
      name: "Top regions",
      rows: [
        ["Country code", "Country", "Share"],
        ...(traffic.TopCountryShares || []).map((region) => [
          region.CountryCode,
          region.Country,
          formatPercent(region.Value),
        ]),
      ],
    },
  ];
}

function buildWorkbookXml(worksheets: Worksheet[]) {
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheets.map(buildWorksheetXml).join("\n")}
</Workbook>`;
}

function buildWorksheetXml(worksheet: Worksheet) {
  return `<Worksheet ss:Name="${escapeXml(truncateSheetName(worksheet.name))}">
    <Table>
      ${worksheet.rows.map(buildRowXml).join("\n")}
    </Table>
  </Worksheet>`;
}

function buildRowXml(row: CellValue[]) {
  return `<Row>${row.map(buildCellXml).join("")}</Row>`;
}

function buildCellXml(value: CellValue) {
  const normalizedValue = value ?? "-";
  const isNumber = typeof normalizedValue === "number" && Number.isFinite(normalizedValue);
  const type = isNumber ? "Number" : "String";

  return `<Cell><Data ss:Type="${type}">${escapeXml(String(normalizedValue))}</Data></Cell>`;
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function formatPercent(value?: number) {
  if (value === undefined) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatDecimal(value?: number) {
  return value === undefined ? "-" : value.toFixed(2);
}

function formatDuration(value?: number) {
  if (value === undefined) {
    return "-";
  }

  const totalSeconds = Math.round(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseNumber(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function truncateSheetName(value: string) {
  return value.slice(0, 31);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
