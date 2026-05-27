"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchGoogleAdSearchSuggestions } from "./actions";
import type { GoogleAdSearchSuggestion } from "./actions";

const locations = ["Quảng cáo ở Mọi vị trí", "Việt Nam", "Hoa Kỳ", "Nhật Bản"];

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

export function SearchControls() {
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

    if (!trimmedQuery) {
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
    <div className="mx-auto mt-10 flex max-w-[1320px] flex-col items-stretch justify-center gap-4 rounded-[2rem] border border-white/15 bg-[#071226]/70 p-3 shadow-[0_26px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl lg:flex-row lg:items-center lg:rounded-full relative z-10">
      {/* <div className="flex h-[70px] overflow-hidden rounded-[28px] border border-[#f6cf84]/30 text-sm font-black leading-tight text-white md:h-[78px] md:text-lg lg:rounded-full">
        <button type="button" className="flex-1 bg-gradient-to-br from-[#ffd27a] to-[#b7641f] px-5 text-[#1b1206] md:w-[170px] md:flex-none">
          Tất cả<br />chủ đề
        </button>
        <button type="button" className="flex-1 bg-white/8 px-5 md:w-[210px] md:flex-none">
          Quảng cáo<br />chính trị
        </button>
      </div> */}

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

      <div className="relative lg:w-[390px]">
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
      </div>
    </div>
  );
}
