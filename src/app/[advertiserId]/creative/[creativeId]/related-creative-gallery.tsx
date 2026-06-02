"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GoogleAdCreative } from "../../../actions";
import { ScriptCreativePreview } from "./script-creative-preview";

type CreativeGalleryApiResult = {
  creatives?: GoogleAdCreative[];
  nextPageToken?: string;
};

type RelatedCreativeGalleryProps = {
  advertiserId: string;
  initialCreatives: GoogleAdCreative[];
  initialNextPageToken?: string;
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

function getImageProxyUrl(imageUrl?: string) {
  return imageUrl ? `/api/ad-image?url=${encodeURIComponent(imageUrl)}` : undefined;
}

function CreativeCard({ creative }: { creative: GoogleAdCreative }) {
  const proxiedImageUrl = getImageProxyUrl(creative.imageUrl);
  const width = creative.imageWidth ?? 380;
  const height = creative.imageHeight ?? 213;

  return (
    <article className="group min-w-0 rounded-[2rem] outline-none">
      <div className="overflow-hidden rounded-[2rem] border border-[#f6cf84]/20 bg-[#fffaf0] shadow-[0_24px_90px_rgba(0,0,0,0.38)] transition duration-500 group-hover:-translate-y-2 group-hover:border-[#ffd27a]/60 group-hover:shadow-[0_34px_120px_rgba(198,119,33,0.35)]">
        <div className="relative p-3">
          <div className="pointer-events-none absolute inset-3 rounded-[1.5rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,122,0.22),transparent_42%)] opacity-0 transition duration-500 group-hover:opacity-100" />
          {proxiedImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxiedImageUrl}
              alt=""
              width={width}
              height={height}
              className="relative max-h-[430px] w-full rounded-[1.35rem] bg-white object-contain"
            />
          ) : creative.scriptUrl ? (
            <div className="relative overflow-hidden rounded-[1.35rem] bg-white">
              <ScriptCreativePreview scriptUrl={creative.scriptUrl} />
            </div>
          ) : (
            <div className="relative flex aspect-[1.25] w-full items-center justify-center rounded-[1.35rem] border border-dashed border-[#b98535]/40 bg-[#f4ead7] text-center text-sm font-black uppercase tracking-[0.2em] text-[#7b4a16]">
              Chưa có bản xem trước
            </div>
          )}
        </div>
      </div>
      <div className="px-2 pt-4">
        <h3 className="truncate text-lg font-black uppercase leading-6 text-white">
          {creative.advertiserName || "Nhà quảng cáo"}
        </h3>
        <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-white/8 p-4 text-[15px] leading-7 text-[#d7dfef] backdrop-blur">
          <div className="font-black text-[#7df0a7]">Đã xác minh</div>
          <div><span className="text-[#ffd27a]">Lần đầu:</span> {formatDate(creative.firstShownAt)}</div>
          <div><span className="text-[#ffd27a]">Lần cuối:</span> {formatDate(creative.lastShownAt)}</div>
          <div><span className="text-[#ffd27a]">Lượng truy cập:</span> {creative.regionStats ?? "-"}</div>
          {creative.domain && <div className="truncate"><span className="text-[#ffd27a]">Tên miền:</span> {creative.domain}</div>}
        </div>
      </div>
    </article>
  );
}

export function RelatedCreativeGallery({ advertiserId, initialCreatives, initialNextPageToken }: RelatedCreativeGalleryProps) {
  const [creatives, setCreatives] = useState(initialCreatives);
  const [nextPageToken, setNextPageToken] = useState(initialNextPageToken);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const url = new URL("/api/google-ads/creatives", window.location.origin);
      url.searchParams.set("advertiserId", advertiserId);
      url.searchParams.set("pageSize", "40");
      url.searchParams.set("regionId", "2704");
      url.searchParams.set("nextPageToken", nextPageToken);

      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Cannot fetch creatives");
      }

      const data = (await response.json()) as CreativeGalleryApiResult;
      const seen = new Set(creatives.map((creative) => creative.creativeId));
      const freshCreatives = (data.creatives ?? []).filter((creative) => !seen.has(creative.creativeId));

      setCreatives((currentCreatives) => [...currentCreatives, ...freshCreatives]);
      setNextPageToken(data.nextPageToken);
    } catch {
      setError("Không thể tải thêm quảng cáo. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, [advertiserId, creatives, isLoading, nextPageToken]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !nextPageToken) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore, nextPageToken]);

  if (!creatives.length) {
    return (
      <div className="bg-white px-7 py-10 text-center text-lg font-bold text-[#5f6368] lg:px-12">
        Không thể tải thêm quảng cáo của nhà quảng cáo này.
      </div>
    );
  }

  return (
    <div className="px-7 py-7 lg:px-12">
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {creatives.map((creative) => (
          <CreativeCard key={creative.creativeId} creative={creative} />
        ))}
      </div>
      <div ref={sentinelRef} className="flex min-h-28 items-center justify-center pt-8 text-center text-sm font-black uppercase tracking-[0.24em] text-[#ffd27a]">
        {isLoading ? "Đang tải thêm..." : nextPageToken ? "Cuộn xuống để tải thêm" : "Đã tải hết quảng cáo"}
      </div>
      {error && <div className="pb-4 text-center text-sm font-bold text-[#ffb4a8]">{error}</div>}
    </div>
  );
}
