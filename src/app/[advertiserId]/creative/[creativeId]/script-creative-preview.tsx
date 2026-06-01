"use client";

import { useEffect, useId, useRef, useState } from "react";

type GoogleAdPreviewResponse = string | {
  html?: string;
  body?: string;
  ad?: string;
  creative?: string;
};

function getCallbackName(scriptUrl: string) {
  try {
    return new URL(scriptUrl).searchParams.get("responseCallback") || undefined;
  } catch {
    return undefined;
  }
}

function getParentId(scriptUrl: string, fallbackId: string) {
  try {
    return new URL(scriptUrl).searchParams.get("htmlParentId") || fallbackId;
  } catch {
    return fallbackId;
  }
}

function getPreviewHtml(response: GoogleAdPreviewResponse) {
  if (typeof response === "string") {
    return response;
  }

  return response.html || response.body || response.ad || response.creative || "";
}

function preparePreviewHtml(html: string) {
  return html
    .replace(/https:\/\/tpc\.googlesyndication\.com\/safeframe\/[^"'<>\s]+/g, "/adframe")
    .replace(/(['"])https:\/\/tpc\.googlesyndication\.com\/safeframe\/[^'"<>\s]+\1/g, "$1/adframe$1");
}

export function ScriptCreativePreview({ scriptUrl }: { scriptUrl: string }) {
  const generatedId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const root = containerRef.current;

    if (!root) {
      return;
    }

    const fallbackParentId = `google-ad-preview-${generatedId}`;
    const parentId = getParentId(scriptUrl, fallbackParentId);
    const callbackName = getCallbackName(scriptUrl) ?? `fletchCallback${generatedId}`;
    const previousCallback = (window as unknown as Record<string, unknown>)[callbackName];
    const script = document.createElement("script");

    root.innerHTML = `<div id="${parentId}" class="flex h-full w-full items-center justify-center"></div>`;

    (window as unknown as Record<string, unknown>)[callbackName] = (response: GoogleAdPreviewResponse) => {
      const target = document.getElementById(parentId);
      const html = getPreviewHtml(response);

      if (!target || !html) {
        setFailed(true);
        return;
      }

      target.innerHTML = preparePreviewHtml(html);
      target.querySelectorAll("a").forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noreferrer");
      });
      target.querySelectorAll("iframe").forEach((iframe) => {
        const src = iframe.getAttribute("src") || "";

        if (src.includes("tpc.googlesyndication.com/safeframe")) {
          iframe.setAttribute("src", "/adframe");
        }
      });
    };

    script.src = scriptUrl;
    script.async = true;
    script.onerror = () => setFailed(true);
    document.body.appendChild(script);

    return () => {
      script.remove();

      if (previousCallback) {
        (window as unknown as Record<string, unknown>)[callbackName] = previousCallback;
      } else {
        delete (window as unknown as Record<string, unknown>)[callbackName];
      }
    };
  }, [generatedId, scriptUrl]);

  if (failed) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-xl bg-white text-center text-sm font-bold text-[#5f6368]">
        Không có ảnh xem trước
      </div>
    );
  }

  return (
    <div className="creative-script-preview flex h-[230px] w-full items-center justify-center overflow-hidden rounded bg-white">
      <div ref={containerRef} className="creative-script-preview-inner flex h-full w-full items-center justify-center" />
    </div>
  );
}
