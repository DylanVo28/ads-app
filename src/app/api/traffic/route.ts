import { fetchTrafficOverview } from "./client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain")?.trim() || "soundeo.com";

  try {
    const data = await fetchTrafficOverview({
      domain,
      timestamp: searchParams.get("timestamp")?.trim() || "1780560383237",
      source: searchParams.get("source")?.trim() || "extension",
      clientId: searchParams.get("clientId")?.trim() || undefined,
      sign: searchParams.get("sign")?.trim() || undefined,
    });

    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cannot fetch traffic API";

    return Response.json({ error: message }, { status: 502 });
  }
}
