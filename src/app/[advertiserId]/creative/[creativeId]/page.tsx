import Link from "next/link";
import { headers } from "next/headers";

import { fetchGoogleAdCreativeById, type GoogleAdCreative } from "../../../actions";
import { ScriptCreativePreview } from "./script-creative-preview";

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

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V4m0 0h11l-1.5 4L16 12H5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type CreativeGalleryApiResult = {
  creatives?: GoogleAdCreative[];
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

function getImageProxyUrl(imageUrl?: string) {
  return imageUrl ? `/api/ad-image?url=${encodeURIComponent(imageUrl)}` : undefined;
}

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
  const response = await fetch(scriptUrl, { cache: "no-store" });

  if (!response.ok) {
    return undefined;
  }

  const script = await response.text();
  const imageUrl = script.match(/https:\/\/tpc\.googlesyndication\.com\/archive\/simgad\/\d+/)?.[0];

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

function extractScriptNumberAttribute(script: string, attributeName: string) {
  const value = script.match(new RegExp(`${attributeName}(?:=|\\\\x3d|\\u003d)(?:"|\\\\x22|\\u0022)(\\d+(?:\\.\\d+)?)`))?.[1];

  return value ? Number(value) : undefined;
}

async function fetchCreativeGallery(advertiserId: string) {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return [];
  }

  const url = new URL(`/api/google-ads/creatives`, `${protocol}://${host}`);
  url.searchParams.set("advertiserId", advertiserId);
  url.searchParams.set("pageSize", "40");
  url.searchParams.set("regionId", "2704");

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as CreativeGalleryApiResult;
  const creatives = data.creatives ?? [];
  console.log({
    creatives
  })
  return Promise.all(
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
}

function CreativeCard({ creative }: { creative: GoogleAdCreative }) {
  const proxiedImageUrl = getImageProxyUrl(creative.imageUrl);
  const width = creative.imageWidth ?? 380;
  const height = creative.imageHeight ?? 213;
  const isTall = height / width > 1.45;
  const isWide = width / height > 2.4;

  return (
    <article className={`overflow-hidden rounded-lg border border-[#d7dce2] bg-white text-[#202124] ${isTall ? "row-span-2" : ""} ${isWide ? "md:col-span-2" : ""}`}>
      <div className="flex min-h-[210px] items-center justify-center bg-[#eef0f2] px-10 py-4">
        {proxiedImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImageUrl}
            alt=""
            width={width}
            height={height}
            className={`max-w-full bg-white object-contain ${isTall ? "max-h-[520px]" : "max-h-[230px]"}`}
          />
        ) : creative.scriptUrl ? (
          <ScriptCreativePreview scriptUrl={creative.scriptUrl} />
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-xl bg-white text-center text-sm font-bold text-[#5f6368]">
            Không có ảnh xem trước
          </div>
        )}
      </div>
      <div className="border-t border-[#d7dce2] px-5 py-3 text-base font-semibold text-[#202124]">
        {creative.advertiserName || "Nhà quảng cáo"}
      </div>
    </article>
  );
}

async function RelatedCreativeGallery({ advertiserId }: { advertiserId: string }) {
  const creatives = await fetchCreativeGallery(advertiserId);

  if (!creatives.length) {
    return (
      <div className="bg-white px-7 py-10 text-center text-lg font-bold text-[#5f6368] lg:px-12">
        Không thể tải thêm quảng cáo của nhà quảng cáo này.
      </div>
    );
  }

  return (
    <div className="bg-white px-7 py-7 lg:px-12">
      <div className="grid auto-rows-[minmax(240px,auto)] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {creatives.map((creative) => (
          <CreativeCard key={creative.creativeId} creative={creative} />
        ))}
      </div>
    </div>
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const { advertiserId: advertiserIdParam, creativeId: creativeIdParam } = await params;
  const { advertiserName: advertiserNameParam, domain } = await searchParams;
  const advertiserId = decodeURIComponent(advertiserIdParam);
  const creativeId = decodeURIComponent(creativeIdParam);
  const result = await fetchGoogleAdCreativeById(advertiserId, creativeId);
  const creative = result.creative;
  const advertiserName = creative?.advertiserName || advertiserNameParam || domain || advertiserId || "Nhà quảng cáo";
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

          <button className="flex w-fit items-center gap-4 rounded-2xl border border-[#2f80ff] bg-[#dce9ff] px-5 py-4 text-xl font-black text-[#1a61d6] shadow-[0_0_0_4px_rgba(255,255,255,0.55)]">
            Hiển thị ở Việt Nam
            <CloseIcon />
          </button>
        </section>

        <section className="mt-9 overflow-hidden rounded-[2.5rem] border border-[#f6cf84]/25 bg-[#071226]/86 shadow-[0_36px_140px_rgba(0,0,0,0.52)] backdrop-blur-xl">
          <div className="grid gap-8 border-b border-white/10 px-7 py-8 text-xl text-[#d7dfef] lg:grid-cols-[1fr_auto] lg:px-12 lg:py-10">
            <div className="space-y-6">
              <p><span className="font-black text-white">Lần hiển thị gần đây nhất:</span> {formatDate(creative?.lastShownAt)}</p>
              <p><span className="font-black text-white">Bên tài trợ cho quảng cáo:</span> {advertiserName} <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#d7dfef] text-sm font-black">i</span></p>
            </div>
            <p><span className="font-black text-white">Định dạng:</span> {creative?.format === 1 ? "Văn bản" : "Hình ảnh"}</p>
          </div>

          <div className="flex justify-end border-b border-white/10 px-7 py-5 lg:px-12">
            <button className="inline-flex items-center gap-4 rounded-full border border-white/10 bg-white/8 px-5 py-3 text-lg font-black text-white transition hover:bg-white/14">
              <FlagIcon />
              Báo quảng cáo này vi phạm
            </button>
          </div>

          <RelatedCreativeGallery advertiserId={advertiserId} />

        </section>

        <div className="mt-10 flex justify-center">
          <Link href={backHref} className="inline-flex items-center gap-5 rounded-full border border-[#2f80ff]/20 bg-[#dce9ff] px-8 py-5 text-xl font-black text-[#1a61d6] shadow-[0_18px_70px_rgba(47,128,255,0.22)] transition hover:-translate-y-1 hover:shadow-[0_24px_90px_rgba(47,128,255,0.28)] md:text-2xl">
            Xem thêm quảng cáo của nhà quảng cáo này
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </main>
  );
}
