import Link from "next/link";

import { fetchGoogleAdCreatives } from "../actions";
import { SearchControls } from "../search-controls";

const DEFAULT_ADVERTISER_ID = "AR02768355324216737793";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

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

function hostnameFromUrl(value?: string) {
  if (!value) {
    return "googleads.g.doubleclick.net";
  }

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "googleads.g.doubleclick.net";
  }
}

function dedupeCreativesByAdvertiserName<T extends { advertiserName?: string; creativeId: string }>(creatives: T[]) {
  const seenAdvertiserNames = new Set<string>();

  return creatives.filter((creative) => {
    const advertiserNameKey = creative.advertiserName?.trim().toLowerCase();

    if (!advertiserNameKey) {
      return true;
    }

    if (seenAdvertiserNames.has(advertiserNameKey)) {
      return false;
    }

    seenAdvertiserNames.add(advertiserNameKey);
    return true;
  });
}

function AdPreview({ imageUrl }: { imageUrl?: string }) {
  const host = hostnameFromUrl(imageUrl);
  const proxiedImageUrl = imageUrl
    ? `/api/ad-image?url=${encodeURIComponent(imageUrl)}`
    : undefined;

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

function VerifiedAdvertiserCard({
  name,
  legalName,
  headquarters,
}: {
  name: string;
  legalName: string;
  headquarters: string;
}) {
  return (
    <section className="relative mx-auto mt-10 max-w-[1500px] overflow-hidden rounded-[2.6rem] border border-[#f6cf84]/25 bg-[#071226]/80 p-1 shadow-[0_36px_140px_rgba(0,0,0,0.52)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,210,122,0.34),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(52,116,255,0.24),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#ffd27a] to-transparent" />

      <div className="relative grid gap-8 rounded-[2.35rem] border border-white/10 bg-[#08152c]/70 px-6 py-7 md:px-9 md:py-9 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="w-fit rounded-full border border-[#ffd27a]/30 bg-[#ffd27a]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.32em] text-[#ffd98b]">
            Hồ sơ đã thẩm định
          </p>
          <h1 className="mt-5 text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] text-white drop-shadow-[0_16px_42px_rgba(0,0,0,0.62)] md:text-7xl">
            {name}
          </h1>
          <div className="mt-7 grid gap-3 text-lg font-bold leading-tight text-[#d7dfef] md:text-2xl">
            <p className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
              <span className="text-[#ffd27a]">Tên pháp lý:</span> {legalName}
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4">
              <span className="text-[#ffd27a]">Trụ sở ở:</span> {headquarters}
            </p>
          </div>
        </div>

        <div className="flex max-w-[620px] items-center gap-4 rounded-full border border-[#ffd27a]/35 bg-[#ffd27a]/10 px-6 py-4 text-lg font-black text-[#fff8e1] shadow-[0_0_60px_rgba(255,210,122,0.16)] md:px-7 md:text-2xl">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd27a] to-[#b7641f] text-[#1b1206] shadow-[0_12px_36px_rgba(255,194,90,0.32)]">
            <svg className="h-7 w-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="13" cy="8" r="3.5" stroke="currentColor" strokeWidth="2.4" />
              <path d="M6 22c.8-4.2 3.2-6.3 7-6.3 1.9 0 3.4.5 4.6 1.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <path d="m18 22 4 4 7-8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Nhà quảng cáo đã xác minh danh tính của mình</span>
        </div>
      </div>
    </section>
  );
}

function TransparencyNotices() {
  const notices = [
    {
      message:
        "Một số nhà quảng cáo hiển thị quảng cáo có nội dung bị giới hạn độ tuổi. Hãy đăng nhập để xác định xem chúng tôi có thể hiển thị những quảng cáo này cho bạn không.",
      actions: ["Đóng", "Đăng nhập"],
    },
    {
      message:
        "Các kết quả này chỉ bao gồm những quảng cáo xuất hiện ở Châu Âu và Thổ Nhĩ Kỳ.",
      link: "Tìm hiểu thêm",
      actions: ["Đóng"],
    },
  ];

  return (
    <div className="mx-auto mt-8 grid max-w-[1500px] gap-4">
      {notices.map((notice) => (
        <div
          key={notice.message}
          className="group relative overflow-hidden rounded-[1.7rem] border border-[#ffd27a]/20 bg-[#101f3a]/78 px-5 py-5 text-[#e7edf8] shadow-[0_22px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl md:px-7"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_5%_50%,rgba(255,210,122,0.18),transparent_24%),linear-gradient(90deg,rgba(74,135,255,0.16),rgba(255,210,122,0.06))] opacity-90" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#ffd27a]/70 to-transparent" />

          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 gap-4">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#7fb1ff]/45 bg-[#7fb1ff]/12 text-[#8dbaff] shadow-[0_0_38px_rgba(91,150,255,0.18)]">
                <svg className="h-7 w-7" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <circle cx="14" cy="14" r="10.5" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M14 12.6v6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx="14" cy="8.8" r="1.35" fill="currentColor" />
                </svg>
              </span>
              <p className="text-base font-extrabold leading-7 text-[#eef4ff] md:text-xl md:leading-8">
                {notice.message}{" "}
                {notice.link && (
                  <button className="font-black text-[#8dbaff] transition hover:text-[#ffd27a]" type="button">
                    {notice.link}
                  </button>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-end md:self-auto">
              {notice.actions.map((action) => (
                <button
                  key={action}
                  className="rounded-full border border-[#8dbaff]/20 bg-white/6 px-5 py-2.5 text-sm font-black text-[#8dbaff] transition hover:border-[#ffd27a]/50 hover:bg-[#ffd27a]/10 hover:text-[#ffd27a] md:text-base"
                  type="button"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const advertiserId = slug[0] || DEFAULT_ADVERTISER_ID;
  const result = await fetchGoogleAdCreatives(advertiserId, { pageSize: 40 }).catch((error) => {
    console.error(error);

    return { creatives: [], raw: null };
  });
  const decodedTarget = decodeURIComponent(advertiserId);
  const primaryAdvertiser = result.creatives[0]?.advertiserName || decodedTarget;
  const advertiserDomain = result.creatives[0]?.domain;
  const creatives = dedupeCreativesByAdvertiserName(result.creatives);
  const hasCreatives = creatives.length > 0;

  function getCreativeHref(creative: (typeof result.creatives)[number]) {
    const targetAdvertiserId = creative.advertiserId || advertiserId;
    const href = new URL(
      `/${encodeURIComponent(targetAdvertiserId)}/creative/${encodeURIComponent(creative.creativeId)}`,
      "http://localhost",
    );
    const advertiserName = creative.advertiserName || primaryAdvertiser;

    if (advertiserName) {
      href.searchParams.set("advertiserName", advertiserName);
    }

    if (creative.domain) {
      href.searchParams.set("domain", creative.domain);
    }

    return `${href.pathname}${href.search}`;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-[#fff8e1]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_8%,rgba(255,190,91,0.28),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(46,108,255,0.22),transparent_30%),linear-gradient(145deg,#050914_0%,#111b33_45%,#3a1d08_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:80px_80px]" />

      <div className="relative px-4 pb-20 pt-1 sm:px-8 lg:px-10">
        <SearchControls />

        <VerifiedAdvertiserCard
          name={advertiserDomain || primaryAdvertiser}
          legalName={primaryAdvertiser}
          headquarters="Việt Nam"
        />

        <TransparencyNotices />

        <section className="mx-auto mt-10 max-w-[1500px]">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Advertiser Details</h2>
            </div>
            <div className="rounded-full border border-[#f6cf84]/20 bg-white/8 px-5 py-3 text-sm font-bold text-[#d7dfef] backdrop-blur">
              Cập nhật theo dữ liệu Google Ads Transparency
            </div>
          </div>

          {hasCreatives ? (
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {creatives.map((creative, index) => (
              <Link
                key={creative.creativeId || index}
                href={getCreativeHref(creative)}
                className="group/link min-w-0 rounded-[2rem] outline-none focus-visible:ring-4 focus-visible:ring-[#ffd27a]/60"
              >
                <AdPreview imageUrl={creative.imageUrl} />
                <div className="px-2 pt-4">
                  <h3 className="truncate text-lg font-black uppercase leading-6 text-white">
                    {creative.advertiserName || primaryAdvertiser}
                  </h3>
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
          ) : (
            <div className="rounded-[2rem] border border-[#ffd27a]/25 bg-[#071226]/86 px-6 py-10 text-center text-[#d7dfef] shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur">
              <h3 className="text-2xl font-black text-white">Google đang giới hạn lượt tải dữ liệu</h3>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8">
                Không thể tải danh sách quảng cáo lúc này do Google Ads Transparency trả về 429. Vui lòng chờ một lát rồi tải lại trang.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
