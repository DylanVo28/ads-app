import Link from "next/link";
import { headers } from "next/headers";

import { fetchGoogleAdCreativeById, type GoogleAdCreative } from "../../../actions";
import { RelatedCreativeGallery } from "./related-creative-gallery";

type PageProps = {
  params: Promise<{
    advertiserId: string;
    creativeId: string;
  }>;
  searchParams: Promise<{
    advertiserName?: string;
    domain?: string;
  }>;
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function BackIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type CreativeGalleryApiResult = {
  creatives?: GoogleAdCreative[];
  nextPageToken?: string;
};

type CreativeByIdRaw = {
  "1"?: {
    "5"?: Array<{
      "3"?: {
        "2"?: string;
      };
    }>;
  };
};


function extractImagePreviewFromRaw(raw: unknown) {
  const variants = (raw as CreativeByIdRaw | undefined)?.["1"]?.["5"] ?? [];
  const imageHtml = variants.find((variant) => variant["3"]?.["2"])?.["3"]?.["2"];
  const imageUrl = imageHtml?.match(/src="([^"]+)"/)?.[1];

  if (!imageUrl) {
    return undefined;
  }

  return {
    imageHtml,
    imageUrl,
    imageWidth: parseHtmlNumberAttribute(imageHtml, "width"),
    imageHeight: parseHtmlNumberAttribute(imageHtml, "height"),
  };
}

async function extractImagePreviewFromScript(scriptUrl: string) {
  const response = await fetch(scriptUrl, {
    cache: "no-store",
    headers: {
      accept: "application/javascript,text/javascript,*/*;q=0.8",
      referer: "https://adstransparency.google.com/",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    return undefined;
  }

  const script = await response.text();
  const insertedImage = extractInsertedPreviewImage(script);

  if (insertedImage) {
    return insertedImage;
  }

  const imageUrl = extractFirstScriptImageUrl(script);

  if (!imageUrl) {
    return undefined;
  }

  return {
    imageUrl,
    imageWidth: extractScriptNumberAttribute(script, "width"),
    imageHeight: extractScriptNumberAttribute(script, "height"),
  };
}

function parseHtmlNumberAttribute(html: string | undefined, attributeName: string) {
  const value = html?.match(new RegExp(`${attributeName}="(\\d+(?:\\.\\d+)?)"`))?.[1];

  return value ? Number(value) : undefined;
}

function extractInsertedPreviewImage(script: string) {
  const match = script.match(
    /previewservice\.(?:registerDeferredInsertPreviewImageContent|insertPreviewImageContent)\(([^)]*)\)/,
  );

  if (!match) {
    return undefined;
  }

  const args = parseScriptCallArguments(match[1]);
  const imageUrl = args.find(isSupportedScriptImageUrl);

  if (!imageUrl) {
    return undefined;
  }

  const imageUrlIndex = args.indexOf(imageUrl);

  return {
    imageUrl,
    imageWidth: parseNumber(args[imageUrlIndex + 1]),
    imageHeight: parseNumber(args[imageUrlIndex + 2]),
  };
}

function extractFirstScriptImageUrl(script: string) {
  return script.match(/https:\/\/(?:tpc\.googlesyndication\.com\/archive\/simgad\/\d+|i\.ytimg\.com\/vi\/[^'"\s)]+\/[^'"\s)]+)/)?.[0];
}

function isSupportedScriptImageUrl(value: string) {
  return /^https:\/\/(?:tpc\.googlesyndication\.com\/archive\/simgad\/\d+|i\.ytimg\.com\/vi\/[^/]+\/[^/]+)$/.test(value);
}

function parseScriptCallArguments(argumentsText: string) {
  const args: string[] = [];
  const argumentPattern = /'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"|(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = argumentPattern.exec(argumentsText))) {
    args.push((match[1] ?? match[2] ?? match[3]).replace(/\\(['"])/g, "$1"));
  }

  return args;
}

function parseNumber(value: string | undefined) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function extractScriptNumberAttribute(script: string, attributeName: string) {
  const value = script.match(new RegExp(`${attributeName}(?:=|\\\\x3d|\\u003d)(?:"|\\\\x22|\\u0022)(\\d+(?:\\.\\d+)?)`))?.[1];

  return value ? Number(value) : undefined;
}

async function fetchCreativeGallery(advertiserId: string) {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return { creatives: [], nextPageToken: undefined };
  }

  const url = new URL(`/api/google-ads/creatives`, `${protocol}://${host}`);
  url.searchParams.set("advertiserId", advertiserId);
  url.searchParams.set("pageSize", "40");
  url.searchParams.set("regionId", "2704");

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return { creatives: [], nextPageToken: undefined };
  }

  const data = (await response.json()) as CreativeGalleryApiResult;
  const creatives = data.creatives ?? [];
  const resolvedCreatives = await Promise.all(
    creatives.map(async (creative) => {
      if (creative.imageUrl || !creative.scriptUrl) {
        return creative;
      }

      const preview = await fetchGoogleAdCreativeById(advertiserId, creative.creativeId)
        .then((result) => extractImagePreviewFromRaw(result.raw))
        .catch(() => undefined);

      if (preview) {
        return { ...creative, ...preview };
      }

      const scriptPreview = await extractImagePreviewFromScript(creative.scriptUrl)
        .catch(() => undefined);

      return scriptPreview ? { ...creative, ...scriptPreview } : creative;
    }),
  );

  return { creatives: resolvedCreatives, nextPageToken: data.nextPageToken };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { advertiserId: advertiserIdParam, creativeId: creativeIdParam } = await params;
  const { advertiserName: advertiserNameParam, domain } = await searchParams;
  const advertiserId = decodeURIComponent(advertiserIdParam);
  const creativeId = decodeURIComponent(creativeIdParam);
  const result = await fetchGoogleAdCreativeById(advertiserId, creativeId);
  const creative = result.creative;
  const advertiserName = creative?.advertiserName || advertiserNameParam || domain || advertiserId || "Nhà quảng cáo";
  const { creatives, nextPageToken } = await fetchCreativeGallery(advertiserId);
  const backHref = advertiserId ? `/${encodeURIComponent(advertiserId)}` : "/";

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-[#fff8e1]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,210,122,0.28),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(48,116,255,0.24),transparent_28%),linear-gradient(145deg,#050914_0%,#111b33_46%,#3a1d08_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />

      <div className="relative mx-auto max-w-[1600px] px-4 pb-16 pt-8 sm:px-8 lg:px-12">
        <Link href={backHref} className="inline-flex items-center gap-4 rounded-full border border-[#f6cf84]/25 bg-white/10 px-5 py-3 text-xl font-black text-white shadow-2xl backdrop-blur transition hover:bg-white/16 md:text-3xl">
          <BackIcon />
          <span>Thông tin chi tiết về quảng cáo</span>
        </Link>

        <section className="mt-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="w-fit rounded-full border border-[#ffd27a]/30 bg-[#ffd27a]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-[#ffd98b]">
              Hồ sơ quảng cáo đã soi chiếu
            </p>
            <h1 className="mt-6 max-w-[1120px] text-5xl font-black uppercase leading-[0.92] tracking-[-0.06em] text-white drop-shadow-[0_18px_48px_rgba(0,0,0,0.58)] md:text-7xl lg:text-8xl">
              {advertiserName}
            </h1>
            <p className="mt-7 text-xl font-semibold leading-8 text-[#d7dfef] md:text-2xl">
              Thông tin về quảng cáo này có thể khác nhau theo vị trí
            </p>
          </div>

          
        </section>

        <section className="mt-9 overflow-hidden rounded-[2.5rem] border border-[#f6cf84]/25 bg-[#071226]/86 shadow-[0_36px_140px_rgba(0,0,0,0.52)] backdrop-blur-xl">
          <div className="grid gap-8 border-b border-white/10 px-7 py-8 text-xl text-[#d7dfef] lg:grid-cols-[1fr_auto] lg:px-12 lg:py-10">
            <div className="space-y-6">
              <p><span className="font-black text-white">Lần hiển thị gần đây nhất:</span> {formatDate(creative?.lastShownAt)}</p>
              <p><span className="font-black text-white">Bên tài trợ cho quảng cáo:</span> {advertiserName} <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d7dfef] text-sm font-black">i</span></p>
            </div>
            <p><span className="font-black text-white">Định dạng:</span> {creative?.format === 1 ? "Văn bản" : "Hình ảnh"}</p>
          </div>

          

          <RelatedCreativeGallery
            advertiserId={advertiserId}
            initialCreatives={creatives}
            initialNextPageToken={nextPageToken}
          />

        </section>

        
      </div>
    </main>
  );
}
