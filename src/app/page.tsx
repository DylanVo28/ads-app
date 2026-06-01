"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchGoogleAdSearchSuggestions } from "./actions";
import type { GoogleAdSearchSuggestion } from "./actions";

const locations = ["Quảng cáo ở Mọi vị trí", "Việt Nam", "Hoa Kỳ", "Nhật Bản"];
const stats = [
  { value: "12M+", label: "tín hiệu quảng cáo được soi chiếu" },
  { value: "98", label: "thị trường phủ sóng toàn cầu" },
  { value: "24/7", label: "quan sát minh bạch theo thời gian thực" },
];
const pillars = ["Minh bạch", "An toàn", "Quy mô", "Niềm tin"];

function formatAdsCount(suggestion: GoogleAdSearchSuggestion) {
  if (suggestion.type !== "advertiser") {
    return "-";
  }

  if (suggestion.minAds && suggestion.maxAds && suggestion.minAds !== suggestion.maxAds) {
    return `Xấp xỉ ${suggestion.minAds}-${suggestion.maxAds} quảng cáo`;
  }

  const adsCount = suggestion.maxAds ?? suggestion.minAds;

  return adsCount ? `Xấp xỉ ${adsCount} quảng cáo` : "-";
}

function getSuggestionName(suggestion: GoogleAdSearchSuggestion) {
  return suggestion.type === "advertiser" ? suggestion.name : suggestion.domain;
}

function SearchIcon() {
  return (
    <svg className="h-6 w-6 shrink-0 md:h-8 md:w-8" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="21" cy="21" r="13" stroke="currentColor" strokeWidth="4" />
      <path d="M31 31L42 42" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M7 16.5L13 22L25 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg className={`h-5 w-5 transition duration-300 md:h-6 md:w-6 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9L12 15L18 9" fill="currentColor" />
    </svg>
  );
}

function MonumentScene() {
  return (
    <div className="relative mx-auto mt-12 aspect-[1.55] w-full max-w-[980px] overflow-hidden rounded-[2rem] border border-white/15 bg-[#091329]/80 shadow-[0_40px_140px_rgba(0,0,0,0.5)] md:mt-16 md:rounded-[3.5rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,213,122,0.55),transparent_18%),radial-gradient(circle_at_20%_78%,rgba(25,129,255,0.28),transparent_25%),linear-gradient(180deg,rgba(16,30,62,0.2),rgba(4,9,22,0.95))]" />
      <div className="absolute left-1/2 top-[10%] h-[72%] w-[72%] -translate-x-1/2 rounded-full border border-[#f8d67b]/30 bg-[radial-gradient(circle,rgba(255,234,170,0.22),transparent_61%)]" />
      <div className="absolute bottom-[18%] left-1/2 h-[28%] w-[8%] -translate-x-1/2 rounded-t-full bg-gradient-to-b from-[#ffe7a5] via-[#d99a3b] to-[#6f3f1b] shadow-[0_0_80px_rgba(255,197,91,0.65)]" />
      <div className="absolute bottom-[18%] left-1/2 h-[52%] w-[4px] -translate-x-1/2 bg-gradient-to-b from-transparent via-[#fff2bd] to-transparent" />
      <div className="absolute bottom-[13%] left-1/2 h-[8%] w-[62%] -translate-x-1/2 rounded-t-[100%] bg-gradient-to-r from-transparent via-[#f7c76c] to-transparent opacity-90" />
      <div className="absolute bottom-0 left-1/2 h-[20%] w-[84%] -translate-x-1/2 rounded-t-[4rem] bg-gradient-to-b from-[#26385f] to-[#071022]" />
      <div className="absolute bottom-[19%] left-[12%] h-[38%] w-[16%] skew-x-[-8deg] rounded-t-[2rem] bg-gradient-to-b from-[#23436e] to-[#071022]" />
      <div className="absolute bottom-[19%] right-[12%] h-[38%] w-[16%] skew-x-[8deg] rounded-t-[2rem] bg-gradient-to-b from-[#23436e] to-[#071022]" />
      <div className="absolute inset-x-[9%] bottom-[10%] flex justify-between text-[10px] font-black uppercase tracking-[0.42em] text-[#ffe6a1]/70 md:text-sm">
        {pillars.map((pillar) => (
          <span key={pillar}>{pillar}</span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GoogleAdSearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(locations[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  function handleQueryChange(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      setSuggestionsError("");
    }
  }

  function handleSuggestionClick(suggestion: GoogleAdSearchSuggestion) {
    const slug = suggestion.type === "advertiser" ? suggestion.advertiserId : suggestion.domain;

    if (!slug) {
      return;
    }

    router.push(`/${encodeURIComponent(slug)}`);
  }

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    let isCurrentRequest = true;

    const timeoutId = window.setTimeout(async () => {
      setIsLoadingSuggestions(true);
      setSuggestionsError("");

      try {
        const result = await fetchGoogleAdSearchSuggestions(trimmedQuery);

        if (isCurrentRequest) {
          setSuggestions(result.suggestions);
        }
      } catch {
        if (isCurrentRequest) {
          setSuggestions([]);
          setSuggestionsError("Không thể tải gợi ý lúc này.");
        }
      } finally {
        if (isCurrentRequest) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 300);

    return () => {
      isCurrentRequest = false;
      window.clearTimeout(timeoutId);
    };
  }, [query]);
  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-[#fff8e1]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(252,188,78,0.26),transparent_28%),radial-gradient(circle_at_82%_6%,rgba(48,116,255,0.22),transparent_28%),linear-gradient(135deg,#050914_0%,#10192d_45%,#321b0b_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-16 pt-24 sm:px-8 lg:px-10">
        <section className="pt-10 text-center md:pt-20">
          <p className="mx-auto w-fit rounded-full border border-[#f5c76b]/35 bg-[#f5c76b]/10 px-5 py-2 text-xs font-black uppercase tracking-[0.38em] text-[#ffd98b] md:text-sm">
            Đại sảnh minh bạch quảng cáo
          </p>

          <h1 className="mx-auto mt-8 max-w-[1180px] text-5xl font-black leading-[0.92] tracking-[-0.07em] text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.55)] md:text-[116px]">
            Trung tâm minh bạch quảng cáo
          </h1>
          <p className="mx-auto mt-7 max-w-[880px] text-lg leading-8 text-[#d7dfef] md:text-2xl md:leading-10">
            Minh bạch trong quảng cáo vì một môi trường Internet mở và và an toàn
          </p>

          <div className="mx-auto mt-10 flex max-w-[1320px] flex-col items-stretch justify-center gap-4 rounded-[2rem] border border-white/15 bg-[#071226]/70 p-3 shadow-[0_26px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:flex-row lg:items-center lg:rounded-full relative z-10">
         

            <div className="relative flex-1 lg:min-w-0">
              <label className="flex h-[70px] items-center gap-4 rounded-[28px] border border-white/18 bg-white/10 px-5 text-left text-[#ffe6b0] md:h-[78px] lg:rounded-full">
                <SearchIcon />
                <input value={query} onChange={(event) => handleQueryChange(event.target.value)} placeholder="Tìm theo tên nhà quảng cáo, miền hoặc chủ đề..." className="min-w-0 flex-1 bg-transparent text-base font-bold text-white outline-none placeholder:text-[#c7d2ea] md:text-xl" aria-label="Tìm quảng cáo" />
              </label>

              {(isLoadingSuggestions || suggestionsError || suggestions.length > 0) && (
                <div className="absolute left-0 top-[calc(100%+12px)] z-20 min-w-[640px] w-full overflow-hidden rounded-3xl border border-[#f6cf84]/25 bg-[#091329] text-left shadow-2xl hide-scrollbar">
                  {isLoadingSuggestions && <div className="px-6 py-4 text-base font-bold text-[#d7dfef]">Đang tải gợi ý...</div>}
                  {suggestionsError && !isLoadingSuggestions && <div className="px-6 py-4 text-base font-bold text-[#ffcfb8]">{suggestionsError}</div>}
                  {!isLoadingSuggestions && !suggestionsError && (
                    <div className="max-h-[520px] overflow-auto hide-scrollbar">
                      <div className="grid min-w-[640px] grid-cols-[1.5fr_1fr_1fr] gap-4 border-b border-white/10 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#d7dfef]">
                        <div>Nhà quảng cáo</div>
                        <div>Trụ sở ở</div>
                        <div>% số quảng cáo</div>
                      </div>

                      {suggestions.map((suggestion) => {
                        const label = getSuggestionName(suggestion);
                        const headquarters = suggestion.type === "advertiser" ? suggestion.region || "-" : "-";
                        const verified = suggestion.type === "advertiser" && suggestion.verified;

                        return (
                          <button key={`${suggestion.type}-${label}`} type="button" onClick={() => handleSuggestionClick(suggestion)} className="grid min-w-[640px] w-full grid-cols-[1.5fr_1fr_1fr] gap-4 px-6 py-4 text-left transition hover:bg-white/10">
                            <div>
                              <div className="text-base font-black text-[#fff8e1]">{label}</div>
                              {verified && <div className="mt-1 text-sm font-semibold text-[#d7dfef]">Đã xác minh</div>}
                              {suggestion.type === "domain" && <div className="mt-1 text-sm font-semibold text-[#d7dfef]">Tên miền</div>}
                            </div>
                            <div className="self-center text-base font-bold text-[#d7dfef]">{headquarters}</div>
                            <div className="self-center text-base font-bold text-[#d7dfef]">{formatAdsCount(suggestion)}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* <div className="relative lg:w-[390px]">
              <button type="button" onClick={() => setIsDropdownOpen((open) => !open)} className="flex h-[70px] w-full items-center justify-between rounded-[28px] border border-[#f6cf84]/35 bg-[#f6cf84]/10 px-5 text-base font-black text-white md:h-[78px] md:px-7 md:text-lg lg:rounded-full" aria-expanded={isDropdownOpen} aria-haspopup="listbox">
                <span className="flex min-w-0 items-center gap-4"><CheckIcon /><span className="truncate">{selectedLocation}</span></span>
                <ChevronDown open={isDropdownOpen} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-full overflow-hidden rounded-3xl border border-[#f6cf84]/25 bg-[#091329] py-2 text-left shadow-2xl" role="listbox">
                  {locations.map((location) => (
                    <button key={location} type="button" onClick={() => { setSelectedLocation(location); setIsDropdownOpen(false); }} className="flex w-full items-center gap-3 px-6 py-4 text-base font-bold text-[#fff8e1] hover:bg-white/10" role="option" aria-selected={selectedLocation === location}>
                      <span className="w-6 text-[#ffd27a]">{selectedLocation === location ? "✓" : ""}</span>{location}
                    </button>
                  ))}
                </div>
              )}
            </div> */}
          </div>

          <MonumentScene />

          <div className="mx-auto mt-10 grid max-w-[980px] gap-4 md:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.value} className="rounded-[2rem] border border-white/12 bg-white/8 p-6 text-left backdrop-blur">
                <div className="text-4xl font-black text-[#ffd27a] md:text-5xl">{stat.value}</div>
                <div className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#d7dfef]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
