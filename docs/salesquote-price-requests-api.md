# Sales Quote Price Requests API

เอกสารนี้อธิบายวิธีตั้งค่าและเรียกใช้งาน endpoint สำหรับ external module ที่ต้องการแจ้งระบบ Price List Calculator ว่ามีการขอราคาโดยอ้างอิงจาก Service Order No.

---

## ภาพรวม

API ชุดนี้ใช้สำหรับบันทึก timeline ของงานราคาใน table `dbo.SalesQuotePriceRequests`

ข้อมูลที่จัดเก็บ:

| Column | ความหมาย |
| --- | --- |
| `Id` | ID ของ price request ที่ caller ส่งเข้ามา |
| `ServiceOrderNo` | Service Order No ที่ external module ส่งเข้ามา |
| `Brand` | Brand ของอุปกรณ์หรือสินค้า |
| `Model` | Model ของอุปกรณ์หรือสินค้า |
| `PriceRequestTime` | วันเวลาที่มีการ request ราคา |
| `PriceReportTime` | วันเวลาที่รายงานราคาเสร็จ |

ระบบสร้างหนึ่ง row ต่อหนึ่ง price request เสมอ ถ้า `serviceOrderNo` เดิมถูก request อีกครั้ง ให้ส่ง `id` ใหม่ ระบบจะเพิ่ม row ใหม่ ไม่ update row เดิม

---

## การตั้งค่าก่อนใช้งาน

### 1. Run Database Migration

Run migration นี้กับ Azure SQL database ที่ใช้งาน ทั้ง UAT และ PROD:

```text
database/migrations/add_salesquote_price_requests.sql
```

Migration จะสร้างหรืออัปเดต:

- table `dbo.SalesQuotePriceRequests`
- nullable columns `Brand` และ `Model`
- primary key ที่ `Id`
- non-unique index ที่ `ServiceOrderNo`
- indexes สำหรับ `PriceRequestTime` และ `PriceReportTime`
- drop unique constraint เดิมของ `ServiceOrderNo` ถ้ามี
- drop obsolete stored procedure `dbo.GetNextSalesQuotePriceRequestId` ถ้ามี

### 2. ตั้งค่า API Key

เพิ่ม environment variable ใน App Service Settings หรือ `.env.local` สำหรับ local development:

```text
PRICE_REQUEST_API_KEY=<your-secret-key>
```

ทุก request ต้องส่ง header:

```http
x-price-request-api-key: <your-secret-key>
```

ถ้า server ยังไม่ได้ตั้งค่า `PRICE_REQUEST_API_KEY` endpoint จะตอบ `503` เพื่อป้องกันการเปิด public endpoint โดยไม่ตั้งใจ

---

## Endpoint 1: Create Price Request

ใช้เมื่อ external module ต้องการแจ้งว่า Service Order นี้เริ่ม request ราคาแล้ว

```http
POST /api/salesquotes/price-requests?id=REQ123&serviceOrderNo=SVRY2512-0013&brand=ABB&model=M2QA
```

### Headers

```http
x-price-request-api-key: <your-secret-key>
```

### Query Parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `id` | Yes | ID ของ price request จาก caller, ความยาวไม่เกิน 20 ตัวอักษร |
| `serviceOrderNo` | Yes | Service Order No ที่ต้องการบันทึกว่าเริ่ม request ราคา, ความยาวไม่เกิน 50 ตัวอักษร |
| `brand` | No | Brand, ความยาวไม่เกิน 100 ตัวอักษร |
| `model` | No | Model, ความยาวไม่เกิน 100 ตัวอักษร |

> Endpoint นี้ไม่อ่านค่าจาก request body ให้ส่งทุก field ผ่าน query string เท่านั้น

### Behavior

- ถ้า `id` ว่าง ระบบตอบ `400`
- ถ้า `serviceOrderNo` ว่าง ระบบตอบ `400`
- ถ้า `id`, `serviceOrderNo`, `brand`, หรือ `model` ยาวเกิน limit ระบบตอบ `400`
- ถ้า `id` ยังไม่เคยมีใน table ระบบจะสร้าง row ใหม่และตอบ `201`
- ถ้า `serviceOrderNo` เดิมถูกส่งมาพร้อม `id` ใหม่ ระบบจะสร้าง row ใหม่และตอบ `201`
- ถ้า `id` ซ้ำ ระบบตอบ `409`

### Success Response

```json
{
  "id": "REQ123",
  "serviceOrderNo": "SVRY2512-0013",
  "brand": "ABB",
  "model": "M2QA",
  "priceRequestTime": "2026-04-17T08:30:00.000Z",
  "priceReportTime": null
}
```

### cURL Example

```bash
curl -X POST "https://<your-app-host>/api/salesquotes/price-requests?id=REQ123&serviceOrderNo=SVRY2512-0013&brand=ABB&model=M2QA" \
  -H "x-price-request-api-key: <your-secret-key>"
```

### PowerShell Example

```powershell
$headers = @{
  "x-price-request-api-key" = "<your-secret-key>"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "https://<your-app-host>/api/salesquotes/price-requests?id=REQ123&serviceOrderNo=SVRY2512-0013&brand=ABB&model=M2QA" `
  -Headers $headers
```

---

## Endpoint 2: Mark Price Report Completed

ใช้เมื่อรายงานราคาเสร็จแล้ว และต้องการบันทึก `PriceReportTime`

```http
PATCH /api/salesquotes/price-requests/report-time?id=REQ123&serviceOrderNo=SVRY2512-0013
```

### Headers

```http
x-price-request-api-key: <your-secret-key>
```

### Query Parameters

| Parameter | Required | Description |
| --- | --- | --- |
| `id` | Yes | ID ของ price request จาก caller |
| `serviceOrderNo` | Yes | Service Order No ของ row ที่ต้องการบันทึกว่า report ราคาเสร็จแล้ว |

> Endpoint นี้ใช้ fixed URL และ match row ด้วยทั้ง `id` และ `serviceOrderNo`

### Behavior

- ถ้า `id` ว่าง ระบบตอบ `400`
- ถ้า `serviceOrderNo` ว่าง ระบบตอบ `400`
- ถ้าไม่พบ row ที่ match ทั้ง `id` และ `serviceOrderNo` ระบบตอบ `404`
- ถ้าพบ row ระบบจะ update `PriceReportTime` เป็นเวลาปัจจุบันและตอบ `200`

### Success Response

```json
{
  "id": "REQ123",
  "serviceOrderNo": "SVRY2512-0013",
  "brand": "ABB",
  "model": "M2QA",
  "priceRequestTime": "2026-04-17T08:30:00.000Z",
  "priceReportTime": "2026-04-17T10:15:00.000Z"
}
```

### cURL Example

```bash
curl -X PATCH "https://<your-app-host>/api/salesquotes/price-requests/report-time?id=REQ123&serviceOrderNo=SVRY2512-0013" \
  -H "x-price-request-api-key: <your-secret-key>"
```

### PowerShell Example

```powershell
$headers = @{
  "x-price-request-api-key" = "<your-secret-key>"
}

Invoke-RestMethod `
  -Method Patch `
  -Uri "https://<your-app-host>/api/salesquotes/price-requests/report-time?id=REQ123&serviceOrderNo=SVRY2512-0013" `
  -Headers $headers
```

---

## Error Responses

| Status | สาเหตุ |
| --- | --- |
| `400` | request ไม่ถูกต้อง เช่น ไม่ส่ง required query parameter หรือส่งค่ายาวเกิน limit |
| `401` | ไม่ส่ง API key หรือ API key ไม่ถูกต้อง |
| `404` | ใช้กับ PATCH เมื่อไม่พบ row ที่ match ทั้ง `id` และ `serviceOrderNo` |
| `409` | ใช้กับ POST เมื่อ `id` ซ้ำ |
| `503` | server ยังไม่ได้ตั้งค่า `PRICE_REQUEST_API_KEY` |
| `500` | server หรือ database error |

ตัวอย่าง error:

```json
{
  "error": "Price request already exists"
}
```

---

## Recommended External Module Flow

1. เมื่อ external module ต้องการ request ราคา ให้เรียก:

```http
POST /api/salesquotes/price-requests?id=REQ123&serviceOrderNo=SVRY2512-0013&brand=ABB&model=M2QA
```

2. ถ้า Service Order เดิมถูก request อีกครั้ง ให้ caller สร้าง `id` ใหม่ แล้วเรียก `POST` อีกครั้ง

3. เมื่อจัดทำรายงานราคาเสร็จ ให้เรียก:

```http
PATCH /api/salesquotes/price-requests/report-time?id=REQ123&serviceOrderNo=SVRY2512-0013
```

4. ถ้า caller retry ด้วย `id` เดิม ระบบจะตอบ `409` เพื่อป้องกันการสร้าง row ซ้ำโดยไม่ตั้งใจ

---

## Local Development

ตัวอย่าง `.env.local`:

```text
PRICE_REQUEST_API_KEY=local-price-request-secret
```

ตัวอย่างเรียก local server:

```powershell
$headers = @{
  "x-price-request-api-key" = "local-price-request-secret"
}

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/api/salesquotes/price-requests?id=REQ123&serviceOrderNo=SVRY2512-0013&brand=ABB&model=M2QA" `
  -Headers $headers
```

---

## Implementation Files

- Middleware: `api/src/middleware/priceRequestApiKey.js`
- Routes: `api/src/routes/salesquotes-price-requests.js`
- Server mount: `server.js`
- Migration: `database/migrations/add_salesquote_price_requests.sql`
