"use client";

import { useState } from "react";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === "left" ? "M15 5 8 12l7 7" : "m9 5 7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getImageProxyUrl(imageUrl?: string) {
  return imageUrl ? `/api/ad-image?url=${encodeURIComponent(imageUrl)}` : undefined;
}

export type CreativeSlide = {
  type: "image" | "script";
  url: string;
  width?: string;
  height?: string;
};

export function CreativeSlides({
  slides,
  advertiserName,
}: {
  slides: CreativeSlide[];
  advertiserName: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];
  const proxiedImageUrl = activeSlide?.type === "image" ? getImageProxyUrl(activeSlide.url) : undefined;
  const scriptPreviewHtml = activeSlide?.type === "script" ? buildScriptPreviewHtml(activeSlide.url) : undefined;

  function goToPrevious() {
    setActiveIndex((current) => (current === 0 ? slides.length - 1 : current - 1));
  }

  function goToNext() {
    setActiveIndex((current) => (current === slides.length - 1 ? 0 : current + 1));
  }

  return (
    <div className="relative min-h-[680px] bg-[radial-gradient(circle_at_50%_12%,rgba(255,210,122,0.20),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] px-5 py-20 md:px-20">
      <div className="absolute right-10 top-10 rounded-full bg-[#8c9298]/90 px-5 py-1 text-lg font-black text-white">
        {slides.length > 0 ? `${activeIndex + 1}/${slides.length}` : "0/0"} biến thể
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-0 top-1/2 hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/18 text-white shadow-2xl backdrop-blur transition hover:bg-white/25 md:flex"
            aria-label="Xem biến thể trước"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-0 top-1/2 hidden h-24 w-24 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white text-[#5c626b] shadow-2xl transition hover:scale-105 md:flex"
            aria-label="Xem biến thể tiếp theo"
          >
            <Chevron direction="right" />
          </button>
        </>
      )}

      <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-[1.7rem] border border-white/80 bg-white text-[#20242c] shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#050914] text-xs font-black uppercase text-[#ffd27a] shadow-lg">
            AD
          </div>
          <div className="min-w-0">
            <div className="truncate text-2xl font-semibold leading-tight text-[#242832]">{advertiserName}</div>
            <div className="truncate text-lg text-[#505866]">Google Ads Transparency preview</div>
          </div>
        </div>

        {proxiedImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxiedImageUrl}
            alt=""
            width={activeSlide?.width ? Number(activeSlide.width) : undefined}
            height={activeSlide?.height ? Number(activeSlide.height) : undefined}
            className="mx-auto max-h-[540px] w-full bg-white object-contain"
          />
        ) : scriptPreviewHtml ? (
          <iframe
            key={activeSlide?.url}
            title={`Biến thể quảng cáo ${activeIndex + 1}`}
            srcDoc={scriptPreviewHtml}
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-[540px] w-full bg-white"
          />
        ) : (
          <div className="flex min-h-[360px] items-center justify-center bg-[#f4ead7] px-10 text-center text-4xl font-black leading-tight text-[#1f5bd8]">
            Chưa có ảnh xem trước
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-8 flex justify-center gap-3">
          {slides.map((slide, index) => (
            <button
              key={`${slide.url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-3 rounded-full transition ${index === activeIndex ? "w-12 bg-[#ffd27a]" : "w-3 bg-white/35 hover:bg-white/60"}`}
              aria-label={`Xem biến thể ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildScriptPreviewHtml(scriptUrl: string) {
  const url = new URL(scriptUrl);
  const parentId = url.searchParams.get("htmlParentId") ?? "fletch-render-root";
  const callbackName = url.searchParams.get("responseCallback") ?? "fletchCallback";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="https://displayads-formats.googleusercontent.com/" />
    <style>
      html, body { margin: 0; min-height: 100%; overflow: hidden; background: #fff; }
      body { display: grid; place-items: center; padding: 24px; box-sizing: border-box; }
      #${parentId} { max-width: 100%; }
      iframe, img { max-width: 100%; border: 0; }
    </style>
  </head>
  <body>
    <div id="${parentId}"></div>
    <script>
      window.__originalCreateElement = document.createElement.bind(document);
      document.createElement = function(tagName) {
        var element = window.__originalCreateElement(tagName);
        if (String(tagName).toLowerCase() === 'iframe') {
          element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
          element.setAttribute('referrerpolicy', 'no-referrer');
        }
        return element;
      };
      window.${callbackName} = function(response) {
        var root = document.getElementById(${JSON.stringify(parentId)});
        if (!root) return;
        var html = '';
        if (typeof response === 'string') html = response;
        if (response && typeof response.html === 'string') html = response.html;
        if (!html) return;
        root.innerHTML = html;
        root.querySelectorAll('iframe').forEach(function(frame) {
          frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
          frame.setAttribute('referrerpolicy', 'no-referrer');
          var src = frame.getAttribute('src');
          if (src && src.charAt(0) === '/') {
            frame.setAttribute('src', 'https://displayads-formats.googleusercontent.com' + src);
          }
        });
      };
    </script>
    <script src="${scriptUrl}"></script>
  </body>
</html>`;
}
