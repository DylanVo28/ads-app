# Tính năng Export Excel quảng cáo theo nhà quảng cáo

## Mục tiêu

Tích hợp nút export Excel trong page chi tiết creative tại route `src/app/[advertiserId]/creative/[creativeId]/page.tsx`. Khi người dùng click nút Excel, hệ thống xuất toàn bộ creative của nhà quảng cáo hiện tại và thông tin traffic tổng quan của domain thành một file Excel.

Mỗi row trong file Excel gồm các cột:

- Tên creative
- Domain creative
- Time lần đầu
- Time lần cuối

File Excel cũng cần có phần thông tin chung của domain gồm:

- Monthly visit
- Bounce rate
- Pages per visit
- Visit duration
- Domain created
- Domain expires
- Google ads
- SERP
- DR
- Visit over time
- Traffic sources
- Top keywords
- Top regions

## Phạm vi

- Thêm nút `Excel` trên page chi tiết creative.
- Export toàn bộ creative thuộc `advertiserId` hiện tại, không chỉ danh sách đang render trên UI.
- Export thêm thông tin traffic tổng quan của `domain` bằng API `/api/traffic`.
- File tải về có định dạng `.xlsx` hoặc `.csv` nếu muốn triển khai nhẹ hơn.
- Dữ liệu thời gian hiển thị theo timezone `Asia/Ho_Chi_Minh` để đồng nhất với UI hiện tại.

## Luồng sử dụng

1. User mở page `/[advertiserId]/creative/[creativeId]`.
2. User click nút `Excel`.
3. Client gọi API export với `advertiserId` hiện tại.
4. Server fetch toàn bộ creative của nhà quảng cáo bằng API Google Ads Transparency hiện có.
5. Server fetch thông tin traffic tổng quan của domain bằng API `/api/traffic`.
6. Server build file Excel gồm nhiều sheet và trả về response download.
7. Browser tự động tải file về máy.

## Dữ liệu export creative

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Tên creative | `creative.advertiserName` hoặc fallback `creative.creativeId` | Hiện type `GoogleAdCreative` chưa có field tên creative riêng, nên cần xác nhận nguồn dữ liệu chính xác. |
| Domain creative | `creative.domain` | Nếu không có thì để `-`. |
| Time lần đầu | `creative.firstShownAt` | Format theo `vi-VN`, timezone `Asia/Ho_Chi_Minh`. |
| Time lần cuối | `creative.lastShownAt` | Format theo `vi-VN`, timezone `Asia/Ho_Chi_Minh`. |

## Dữ liệu export thông tin chung

Nguồn dữ liệu: API server-side đã có tại `GET /api/traffic`.

Ví dụ request:

```txt
GET /api/traffic?domain=soundeo.com&timestamp=1780560383237&source=extension&clientId=ab11def3ae47cc5cfd9f667b0bf35392c08815a8b39dda29___&sign=8a1cce7a33ab697a8504bc690e9ec626
```

### Sheet `Overview`

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Domain | `traffic.SiteName` | Domain đang export. |
| Description | `traffic.Description` | Mô tả domain. |
| Category | `traffic.Category` hoặc `traffic.CategoryRank.Category` | Nếu rỗng thì để `-`. |
| Monthly visit | `traffic.Engagments.Visits` | Có thể parse sang number để format. |
| Bounce rate | `traffic.Engagments.BounceRate` | Format phần trăm, ví dụ `23.78%`. |
| Pages per visit | `traffic.Engagments.PagePerVisit` | Làm tròn 2 chữ số. |
| Visit duration | `traffic.Engagments.TimeOnSite` | Đơn vị giây, có thể format `mm:ss`. |
| Domain created | `traffic.DateData.registration` | Format ngày. |
| Domain expires | `traffic.DateData.expiration` | Format ngày. |
| Global rank | `traffic.GlobalRank.Rank` | Nếu không có thì để `-`. |
| Country rank | `traffic.CountryRank.Rank` | Kèm `traffic.CountryRank.CountryCode` nếu có. |
| Snapshot date | `traffic.SnapshotDate` | Ngày snapshot dữ liệu. |
| From cache | `traffic.fromCache` | `true` hoặc `false`. |

### Sheet `Visit over time`

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Month | key của `traffic.EstimatedMonthlyVisits` | Ví dụ `2026-04-01`. |
| Visits | value của `traffic.EstimatedMonthlyVisits` | Số lượt visit theo tháng. |

### Sheet `Traffic sources`

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Source | key của `traffic.TrafficSources` | Ví dụ `Direct`, `Search`, `Social`. |
| Share | value của `traffic.TrafficSources` | Format phần trăm. |

### Sheet `Top keywords`

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Keyword | `keyword.Name` | Từ khóa. |
| Volume | `keyword.Volume` | Search volume. |
| CPC | `keyword.Cpc` | Nếu `null` thì để `-`. |
| Estimated value | `keyword.EstimatedValue` | Giá trị ước tính. |

### Sheet `Top regions`

| Cột Excel | Field đề xuất | Ghi chú |
| --- | --- | --- |
| Country code | `region.CountryCode` | Ví dụ `US`, `CL`. |
| Country | `region.Country` | Mã quốc gia dạng number từ API. |
| Share | `region.Value` | Format phần trăm. |

### Các chỉ số chưa có trong response mẫu

Các field sau được yêu cầu export nhưng chưa xuất hiện trong response mẫu của `/api/traffic`:

| Chỉ số | Field hiện có | Hướng xử lý đề xuất |
| --- | --- | --- |
| Google ads | Chưa có | Lấy từ số lượng creative Google Ads đã fetch, hoặc bổ sung API riêng nếu cần metric khác. |
| SERP | Chưa có | Để `-` tạm thời, hoặc bổ sung nguồn dữ liệu SERP riêng. |
| DR | Chưa có | Để `-` tạm thời, hoặc bổ sung nguồn dữ liệu domain rating riêng. |

## Thay đổi đề xuất

### 1. Tạo API export

File đề xuất: `src/app/api/google-ads/creatives/export/route.ts`

API nhận query:

```txt
GET /api/google-ads/creatives/export?advertiserId=AR...&domain=soundeo.com
```

Trách nhiệm:

- Validate `advertiserId`.
- Validate `domain` nếu cần export thông tin traffic tổng quan.
- Gọi `fetchGoogleAdCreatives(advertiserId, ...)` nhiều lần theo `nextPageToken` cho đến khi hết dữ liệu.
- Gọi `/api/traffic` hoặc tách helper server-side dùng chung để lấy traffic data theo `domain`.
- Chống vòng lặp vô hạn bằng `maxPages` hoặc `maxRows`.
- Map dữ liệu creative và traffic sang nhiều sheet Excel.
- Trả file download với header phù hợp.

Ví dụ header response:

```ts
return new Response(fileBuffer, {
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="google-ads-${advertiserId}.xlsx"`,
  },
});
```

### 2. Cài thư viện tạo Excel

Có thể dùng `xlsx` để tạo file `.xlsx`:

```bash
npm install xlsx
```

Nếu muốn tránh thêm dependency, có thể export `.csv` trước. Tuy nhiên yêu cầu là Excel nên `.xlsx` là lựa chọn đúng hơn.

### 3. Thêm nút Excel trên page chi tiết creative

File liên quan: `src/app/[advertiserId]/creative/[creativeId]/page.tsx`

Vị trí đề xuất:

- Đặt trong section header, cùng cấp khu vực tiêu đề nhà quảng cáo.
- Nút là link/download đến API export.

Ví dụ:

```tsx
<Link
  href={`/api/google-ads/creatives/export?advertiserId=${encodeURIComponent(advertiserId)}&domain=${encodeURIComponent(domain || creative?.domain || "")}`}
  className="..."
>
  Excel
</Link>
```

Nếu muốn loading state đẹp hơn, tách thành client component `ExportExcelButton` và dùng `fetch` + `URL.createObjectURL()` để tải file.

### 4. Hàm fetch toàn bộ creative

Nên tạo helper riêng trong API route hoặc module server-only:

```ts
async function fetchAllAdvertiserCreatives(advertiserId: string) {
  const creatives = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = await fetchGoogleAdCreatives(advertiserId, {
      limit: 40,
      pageSize: 40,
      nextPageToken,
    });

    creatives.push(...result.creatives);
    nextPageToken = result.nextPageToken;

    if (!nextPageToken) {
      break;
    }
  }

  return creatives;
}
```

### 5. Hàm fetch traffic overview

Nên tách logic fetch traffic thành helper server-side để API export có thể dùng lại, thay vì gọi vòng qua HTTP nội bộ nếu không cần thiết.

```ts
async function fetchTrafficOverview(domain: string) {
  const url = new URL("/api/traffic", process.env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("domain", domain);
  url.searchParams.set("timestamp", Date.now().toString());
  url.searchParams.set("source", "extension");
  url.searchParams.set("clientId", process.env.TRAFFIC_CLIENT_ID || "");
  url.searchParams.set("sign", process.env.TRAFFIC_SIGN || "");

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Cannot fetch traffic overview");
  }

  return response.json() as Promise<TrafficApiResponse>;
}
```

Nếu `clientId` và `sign` là credential cố định, nên đưa vào `.env.local` thay vì hard-code trong URL export.

### 6. Cấu trúc sheet trong file Excel

File `.xlsx` nên có các sheet sau:

| Sheet | Nội dung |
| --- | --- |
| `Overview` | Thông tin chung: monthly visit, bounce rate, pages per visit, visit duration, domain created/expires, global rank, country rank, Google ads, SERP, DR. |
| `Creatives` | Danh sách toàn bộ creative của nhà quảng cáo. |
| `Visit over time` | Dữ liệu `EstimatedMonthlyVisits`. |
| `Traffic sources` | Dữ liệu `TrafficSources`. |
| `Top keywords` | Dữ liệu `TopKeywords`. |
| `Top regions` | Dữ liệu `TopCountryShares`. |

## Format thời gian

Dùng cùng logic với page hiện tại để tránh lệch hiển thị:

```ts
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
```

## Tiêu chí hoàn thành

- Page `src/app/[advertiserId]/creative/[creativeId]/page.tsx` có nút `Excel` dễ thấy.
- Click nút `Excel` tải về file Excel của nhà quảng cáo hiện tại.
- File export chứa toàn bộ creative lấy được qua pagination, không chỉ 40 item đầu tiên.
- Mỗi row có đủ 4 cột: tên creative, domain creative, time lần đầu, time lần cuối.
- File export có sheet `Overview` chứa monthly visit, bounce rate, pages per visit, visit duration, domain created, domain expires, Google ads, SERP, DR.
- File export có sheet `Visit over time`, `Traffic sources`, `Top keywords`, `Top regions` dựa trên response `/api/traffic`.
- Nếu creative thiếu field, cell tương ứng hiển thị `-`.
- Nếu metric traffic thiếu field, cell tương ứng hiển thị `-`.
- API xử lý lỗi rõ ràng khi thiếu `advertiserId`, thiếu `domain`, Google Ads API lỗi hoặc Traffic API lỗi.

## Ghi chú kỹ thuật

- Cần đọc guide liên quan trong `node_modules/next/dist/docs/` trước khi chỉnh code Next.js vì project đang dùng phiên bản Next.js có thay đổi breaking.
- Không nên build file Excel ở client vì cần fetch toàn bộ page từ server và tránh lộ logic gọi Google Ads.
- Nên giới hạn số page hoặc số row export để tránh request quá lâu.
- Tên file nên sanitize `advertiserId` hoặc `advertiserName` trước khi đưa vào `Content-Disposition`.
- Nếu API Google Ads trả dữ liệu trùng giữa các page, nên dedupe theo `creative.creativeId` trước khi export.
- Không hard-code `clientId` và `sign` trong code export nếu đây là token thật; nên chuyển sang biến môi trường.
- Field `Engagments` trong Traffic API đang sai chính tả theo response thật, khi type và map dữ liệu cần giữ đúng key này.
