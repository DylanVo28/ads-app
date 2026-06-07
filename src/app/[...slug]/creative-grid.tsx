"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchGoogleAdCreatives } from "../actions";
import type { GoogleAdCreative } from "../actions";

function formatDate(value?: string) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function getTime(value?: string) {
  if (!value) return 0;

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? 0 : time;
}

function sortCreativesByLastShownDesc(creatives: GoogleAdCreative[]) {
  return [...creatives].sort((a, b) => getTime(b.lastShownAt) - getTime(a.lastShownAt));
}

function AdPreview({ imageUrl }: { imageUrl?: string }) {
  const proxiedImageUrl = imageUrl ? `/api/ad-image?url=${encodeURIComponent(imageUrl)}` : undefined;

  return (
    <div className="group overflow-hidden rounded-[2rem] border border-[#f6cf84]/20 bg-[#fffaf0] shadow-[0_24px_90px_rgba(0,0,0,0.38)] transition duration-500 hover:-translate-y-2 hover:border-[#ffd27a]/60 hover:shadow-[0_34px_120px_rgba(198,119,33,0.35)]">
      <div className="relative p-3">
        <div className="pointer-events-none absolute inset-3 rounded-[1.5rem] bg-[radial-gradient(circle_at_50%_0%,rgba(255,210,122,0.22),transparent_42%)] opacity-0 transition duration-500 group-hover:opacity-100" />
        {proxiedImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxiedImageUrl} alt="" className="relative max-h-[430px] w-full rounded-[1.35rem] bg-white object-contain" />
        ) : (
          <div className="relative flex aspect-[1.25] w-full items-center justify-center rounded-[1.35rem] border border-dashed border-[#b98535]/40 bg-[#f4ead7] text-sm font-black uppercase tracking-[0.2em] text-[#7b4a16]">
            Chưa có bản xem trước
          </div>
        )}
      </div>
    </div>
  );
}

function getCreativeKey(creative: GoogleAdCreative, index: number) {
  return `${creative.advertiserId}-${creative.creativeId || index}`;
}

export function CreativeGrid({
  advertiserId,
  initialCreatives,
  initialNextPageToken,
  primaryAdvertiser,
}: {
  advertiserId: string;
  initialCreatives: GoogleAdCreative[];
  initialNextPageToken?: string;
  primaryAdvertiser: string;
}) {
  const [creatives, setCreatives] = useState(() => sortCreativesByLastShownDesc(initialCreatives));
  const [nextPageToken, setNextPageToken] = useState(initialNextPageToken ?? "");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  function getCreativeHref(creative: GoogleAdCreative) {
    const targetAdvertiserId = creative.advertiserId || advertiserId;
    const href = new URL(`/${encodeURIComponent(targetAdvertiserId)}/creative/${encodeURIComponent(creative.creativeId)}`, "http://localhost");
    const advertiserName = creative.advertiserName || primaryAdvertiser;

    if (advertiserName) href.searchParams.set("advertiserName", advertiserName);
    if (creative.domain) href.searchParams.set("domain", creative.domain);

    return `${href.pathname}${href.search}`;
  }

  const loadMore = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadMoreError("");

    try {
      const result = await fetchGoogleAdCreatives(advertiserId, { pageSize: 40, nextPageToken });
      setCreatives((currentCreatives) => {
        const currentKeys = new Set(currentCreatives.map(getCreativeKey));
        const newCreatives = result.creatives.filter((creative, index) => !currentKeys.has(getCreativeKey(creative, index)));

        return sortCreativesByLastShownDesc([...currentCreatives, ...newCreatives]);
      });
      setNextPageToken(result.nextPageToken ?? "");
    } catch {
      setLoadMoreError("Không thể tải thêm quảng cáo lúc này.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [advertiserId, isLoadingMore, nextPageToken]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel || !nextPageToken) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "900px 0px" },
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore, nextPageToken]);

  return (
    <>
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {creatives.map((creative, index) => (
          <Link key={getCreativeKey(creative, index)} href={getCreativeHref(creative)} className="group/link min-w-0 rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd27a]/60">
            <AdPreview imageUrl={creative.imageUrl} />
            <div className="px-2 pt-4">
              <h3 className="truncate text-lg font-black uppercase leading-6 text-white">{creative.advertiserName || primaryAdvertiser}</h3>
              <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-white/8 p-4 text-[15px] leading-7 text-[#d7dfef] backdrop-blur">
                <div className="font-black text-[#7df0a7]">Đã xác minh</div>
                <div><span className="text-[#ffd27a]">Lần đầu:</span> {formatDate(creative.firstShownAt)}</div>
                <div><span className="text-[#ffd27a]">Lần cuối:</span> {formatDate(creative.lastShownAt)}</div>
                <div><span className="text-[#ffd27a]">Lượng truy cập:</span> {creative.regionStats ?? "-"}</div>
                {creative.domain && <div className="truncate"><span className="text-[#ffd27a]">Tên miền:</span> {creative.domain}</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div ref={sentinelRef} className="mt-10 flex min-h-16 justify-center">
        {isLoadingMore && <div className="rounded-full border border-[#ffd27a]/25 bg-[#071226]/90 px-6 py-3 text-base font-black text-[#ffd27a] shadow-2xl backdrop-blur">Đang tải thêm...</div>}
        {loadMoreError && <button type="button" onClick={() => void loadMore()} className="rounded-full border border-[#ffcfb8]/30 bg-[#ffcfb8]/10 px-6 py-3 text-base font-black text-[#ffcfb8]">{loadMoreError} Thử lại</button>}
        {!nextPageToken && !isLoadingMore && creatives.length > 0 && <div className="text-sm font-bold uppercase tracking-[0.24em] text-[#d7dfef]/70">Đã tải hết quảng cáo</div>}
      </div>
    </>
  );
}
