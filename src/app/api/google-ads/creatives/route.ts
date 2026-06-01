import { fetchGoogleAdCreatives } from "../../../actions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const advertiserId = searchParams.get("advertiserId")?.trim();
  const domain = searchParams.get("domain")?.trim();
  const target = advertiserId || domain;

  if (!target) {
    return Response.json(
      { error: "Missing advertiserId or domain" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchGoogleAdCreatives(target, {
      limit: parseOptionalNumber(searchParams.get("limit")),
      pageSize: parseOptionalNumber(searchParams.get("pageSize")),
      regionId: parseOptionalNumber(searchParams.get("regionId")),
      nextPageToken: searchParams.get("nextPageToken") ?? undefined,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot fetch creatives";

    return Response.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = payload as Partial<{
    advertiserId: string;
    domain: string;
    limit: number;
    pageSize: number;
    regionId: number;
    topicIds: number[];
    nextPageToken: string;
  }>;
  const target = body.advertiserId?.trim() || body.domain?.trim();

  if (!target) {
    return Response.json(
      { error: "Missing advertiserId or domain" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchGoogleAdCreatives(target, {
      limit: body.limit,
      pageSize: body.pageSize,
      regionId: body.regionId,
      topicIds: body.topicIds,
      nextPageToken: body.nextPageToken,
    });

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot fetch creatives";

    return Response.json({ error: message }, { status: 502 });
  }
}

function parseOptionalNumber(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}
