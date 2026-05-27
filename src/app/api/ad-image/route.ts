import { NextRequest } from "next/server";

const ALLOWED_IMAGE_HOSTS = new Set([
  "tpc.googlesyndication.com",
  "googleads.g.doubleclick.net",
]);

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing image url", { status: 400 });
  }

  let url: URL;

  try {
    url = new URL(imageUrl);
  } catch {
    return new Response("Invalid image url", { status: 400 });
  }

  if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) {
    return new Response("Image host is not allowed", { status: 400 });
  }

  const upstream = await fetch(url, {
    cache: "force-cache",
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: "https://adstransparency.google.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Cannot fetch image", { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      "cache-control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
