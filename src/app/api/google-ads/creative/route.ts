import { fetchGoogleAdCreativeById } from "../../../actions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const advertiserId = searchParams.get("advertiserId")?.trim();
  const creativeId = searchParams.get("creativeId")?.trim();

  if (!advertiserId || !creativeId) {
    return Response.json(
      { error: "Missing advertiserId or creativeId" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchGoogleAdCreativeById(advertiserId, creativeId);

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot fetch creative";

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
    creativeId: string;
    pageSize: number;
    regionId: number;
  }>;

  if (!body.advertiserId?.trim() || !body.creativeId?.trim()) {
    return Response.json(
      { error: "Missing advertiserId or creativeId" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchGoogleAdCreativeById(
      body.advertiserId,
      body.creativeId,
      {
        pageSize: body.pageSize,
        regionId: body.regionId,
      },
    );

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot fetch creative";

    return Response.json({ error: message }, { status: 502 });
  }
}
