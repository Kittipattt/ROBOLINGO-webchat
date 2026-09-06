# 💬 ROBO LINGO WebChat - LINE Official Account Live Chat System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![LINE Messaging API](https://img.shields.io/badge/LINE-Messaging%20API-00C300?style=for-the-badge&logo=line)
![Vitest](https://img.shields.io/badge/Vitest-70%20Passing-green?style=for-the-badge&logo=vitest)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

**ระบบไลฟ์แชทสองทาง (Two-Way Live Chat Helpdesk) เชื่อมต่อ LINE Official Account (LINE OA) แบบ Real-time**  
พัฒนาด้วย **Next.js 15 (App Router)**, **TypeScript**, **LINE Messaging API** และ **Clean Architecture**

[🚀 ทดลองแอดไลน์ OA](#-ข้อมูลสำหรับการทดสอบ-submission-deliverables) • [✨ ฟีเจอร์เด่น](#-ฟีเจอร์เด่น-key-features) • [🏛️ สถาปัตยกรรมระบบ](#️-สถาปัตยกรรมระบบ-system-architecture) • [🧪 การทดสอบ](#-การทดสอบและความเสถียร-testing--quality) • [📦 การติดตั้ง](#-วิธีการติดตั้งและรันในเครื่อง-local-setup)

</div>

---

## 📌 บทนำและภาพรวมโครงการ (Project Overview)

**ROBO LINGO WebChat** คือระบบบริหารจัดการข้อความลูกค้าและศูนย์บริการลูกค้า (Customer Support Helpdesk) ที่เชื่อมต่อโดยตรงกับ **LINE Official Account (LINE OA)** ผ่าน **LINE Messaging API** 

ระบบถูกออกแบบมาเพื่อแก้ปัญหาของทีมแอดมินที่ต้องตอบลูกค้าจำนวนมาก โดยมอบประสบการณ์การทำงานที่ **รวดเร็ว ไหลลื่น ไม่มีหน่วง (Zero-Latency UX)** ด้วยเทคโนโลยี **Offline-First Caching**, ดีไซน์ **Emerald Glassmorphism** ระดับพรีเมียม, ระบบเทมเพลตคำตอบด่วนที่ปรับแต่งได้อิสระ และการรับ-ส่งรูปภาพสมบูรณ์แบบทั้งสองทาง

---

## ✨ ฟีเจอร์เด่น (Key Features)

### 1. ⚡ การรับ-ส่งข้อความสองทางแบบเรียลไทม์ (Two-Way Live Messaging)
- **Webhook Integration**: รับข้อความและอีเวนต์จาก LINE Platform ทันทีที่ลูกค้าส่ง (รองรับ Text, Sticker และ Image)
- **Push Message API**: แอดมินสามารถพิมพ์ตอบกลับจากหน้าเว็บ ข้อความจะถูกส่งตรงเข้าแอป LINE ของลูกค้าในทันที
- **Sound Alert & Notification**: เสียงแจ้งเตือนนุ่มนวลเมื่อมีข้อความใหม่เข้ามา

### 2. 🖼️ รองรับการรับ-ส่งรูปภาพ & กล่องดูภาพขยาย (Image Messages & Lightbox Viewer)
- **รับรูปภาพจาก LINE (Incoming Images)**: เมื่อลูกค้าส่งรูปภาพ (เช่น สลิปโอนเงิน, รูปสินค้า) ระบบจะดาวน์โหลดไฟล์ผ่าน **LINE Content API** และจัดเก็บไว้อย่างปลอดภัย พร้อมแสดงผลรูปภาพในห้องแชททันที
- **แอดมินแนบรูปภาพส่งหาลูกค้า (Outgoing Push Image)**: แอดมินกดปุ่มคลิปหนีบกระดาษ 📎 เพื่อเลือกไฟล์รูปภาพ (JPEG, PNG, GIF, WebP สูงสุด 10MB) มีแถบดูภาพตัวอย่าง (Preview Bar) ขนาดไฟล์ และปุ่มยกเลิก สามารถพิมพ์ข้อความกำกับ (Caption) แล้วกดส่งเข้า LINE ลูกค้าได้โดยตรง
- **Lightbox Viewer ขยายดูภาพขนาดเต็ม**: คลิกที่รูปภาพในห้องแชทเพื่อเปิดดูรูปขนาดใหญ่แบบ Full-Screen ปรับความคมชัด พร้อมปุ่ม **Zoom In/Out**, ปุ่ม **Download** บันทึกรูปลงเครื่อง และปุ่มปิด

### 3. 🌓 สลับธีมสว่าง / มืด แบบ Quick Switch (Dark & Light Theme Mode)
- ปุ่ม Toggle ☀️ / 🌙 บน Header คลิกเดียวเปลี่ยนโทนสีทั้งระบบทันที
- ระบบ **Theme Persistence** บันทึกค่าที่เลือกลงใน `localStorage` โหลดธีมเดิมอัตโนมัติเมื่อเปิดใช้งานใหม่
- โหมด Light สบายตา คมชัด อ่านง่าย และโหมด Dark สไตล์ Emerald Glassmorphism ระดับพรีเมียม

### 4. 🛡️ ความปลอดภัยมาตรฐานระดับ Enterprise (Security & Signature Verification)
- ตรวจสอบความถูกต้องของ Webhook ทุก Request ด้วย **HMAC-SHA256 Signature Verification** (`x-line-signature`) เพื่อป้องกัน Request ปลอมแปลง
- ป้องกัน Timing Attack ด้วย `crypto.timingSafeEqual`
- ป้องกัน Path Traversal Attack ในการดาวน์โหลดและให้บริการไฟล์รูปภาพ

### 5. 👥 การจัดการลูกค้าอัจฉริยะ (Intelligent Customer Management)
- **Auto-Enrich Profile**: ดึงชื่อแสดงผล (Display Name), รูปโปรไฟล์ (Avatar) และสถานะจาก LINE Profile API โดยอัตโนมัติ
- **Unread Badges & Monotonic Order**: มีตัวนับข้อความที่ยังไม่ได้อ่าน พร้อมระบบเรียงลำดับแชทตามเวลาล่าสุด โดยป้องกันปัญหาข้อมูลเก่าทับข้อมูลใหม่อย่างแม่นยำ
- **Search & Filter**: ค้นหาลูกค้าตามชื่อหรือข้อความล่าสุดได้ทันที

### 6. ⚡ จัดการเทมเพลตคำตอบด่วนได้เอง (Customizable Quick Replies)
- **คลิกเดียวส่งทันที**: มีชิปคำตอบด่วนด้านบนกล่องข้อความ คลิกส่งหาลูกค้าได้ในเสี้ยววินาที
- **Modal จัดการเทมเพลต**: แอดมินสามารถ **เพิ่มข้อความใหม่ (Add)**, **แก้ไขแบบ Inline (Edit)** และ **ลบ (Delete)** ข้อความที่ใช้บ่อยได้เอง
- **Reset to Defaults**: ปุ่มกู้คืน 4 ข้อความมาตรฐานของระบบได้ตลอดเวลา
- **ระบบจัดเก็บ 2 ชั้น (Offline-First)**: โหลดเร็วทันทีผ่าน Local Storage และ Sync กับเซิร์ฟเวอร์แบบ Background

### 7. 🗑️ จัดการบทสนทนาอย่างปลอดภัย (Safe Conversation Management)
- **ลบห้องแชท (Delete Chat)**: ลบผู้ใช้ออกจากระบบพร้อมข้อความทั้งหมด
- **ล้างประวัติข้อความ (Clear History)**: ล้างข้อความเก่าโดยยังคงเก็บโปรไฟล์ลูกค้าไว้
- มี Modal แจ้งเตือนยืนยันก่อนลบ ป้องกันการกดผิดพลาดโดยไม่ตั้งใจ

---

## 🏛️ สถาปัตยกรรมระบบ (System Architecture)

ระบบแบ่งแยกหน้าที่การทำงานอย่างชัดเจนตามหลัก **Clean Architecture** และ **Separation of Concerns**:

```
src/
├── app/                      # Presentation & Route Handlers Layer
│   ├── api/
│   │   ├── line/webhook/     # LINE Webhook (HMAC-SHA256, Text/Sticker/Image)
│   │   ├── messages/         # GET, POST (Text & Image Push), DELETE
│   │   ├── users/            # GET (Profile enrichment), DELETE (Delete user)
│   │   ├── users/read/       # POST (Mark conversation as read)
│   │   ├── quick-replies/    # GET, POST (Manage quick reply templates)
│   │   ├── upload/           # POST (Secure image upload handler, max 10MB)
│   │   └── images/[filename] # GET (Safe binary image streaming & caching)
│   ├── layout.tsx            # Root Layout & Metadata
│   └── page.tsx              # Main Helpdesk Container
├── components/               # Pure UI Components Layer
│   ├── ChatSidebar.tsx       # รายการผู้ใช้, ค้นหา, Unread Count
│   ├── ChatCanvas.tsx        # กล่องสนทนา, แนบรูปภาพ 📎, Lightbox, Quick Replies
│   ├── CustomerDrawer.tsx    # ข้อมูลลูกค้า, สถิติ, ปุ่มล้าง/ลบแชท
│   ├── QuickRepliesModal.tsx # หน้าต่างเพิ่ม/แก้ไข/ลบเทมเพลตคำตอบด่วน
│   ├── DeleteModal.tsx       # กล่องยืนยันการลบแชท
│   └── LineQrModal.tsx       # QR Code เพิ่มเพื่อน LINE OA
├── hooks/                    # Custom Hooks & State Logic Layer
│   ├── useWebChat.ts         # Hook รวมสำหรับ Dashboard State
│   ├── useChatMessages.ts    # Logic ข้อความ, ส่งรูปภาพ, Optimistic Updates
│   ├── useChatUsers.ts       # Logic ลูกค้า, Unread Counts, เรียงลำดับ
│   └── useQuickReplies.ts    # Logic จัดการและ Sync เทมเพลตคำตอบด่วน
├── services/                 # Frontend API Abstraction Layer
│   ├── chatService.ts        # เรียก API ข้อความ และ อัปโหลดรูปภาพ
│   ├── userService.ts        # เรียก API ผู้ใช้
│   └── quickReplyService.ts  # เรียก API Quick Replies
└── lib/                      # Core Utilities & Persistence Layer
    ├── types.ts              # TypeScript Interfaces (รวม ChatMessage, ImageUrl)
    ├── db.ts                 # Database Engine, JSON Persistence & Uploads Dir
    ├── storage.ts            # Client-Side Caching & LocalStorage
    └── line.ts               # LINE SDK Utilities (Signature, Profile, Push, Image Content)
```

### 🔄 Data Flow Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 ลูกค้า (LINE App)
    participant LineAPI as 🟢 LINE Platform
    participant Webhook as ⚡ Webhook Handler (/api/line/webhook)
    participant CoreDB as 💾 Database & Cache (db.ts)
    participant WebApp as 🖥️ WebChat Dashboard
    actor Admin as 👨‍💼 แอดมิน (Agent)

    Note over Customer, LineAPI: ฝั่งลูกค้ารับ-ส่งข้อความ
    Customer->>LineAPI: ส่งข้อความหรือสติกเกอร์
    LineAPI->>Webhook: ส่ง Event พร้อม x-line-signature (POST)
    Webhook->>Webhook: ตรวจสอบ HMAC-SHA256 Signature
    Webhook->>LineAPI: ขอข้อมูล Profile (ชื่อ, รูป Avatar)
    Webhook->>CoreDB: บันทึกข้อความและอัปเดตสถานะผู้ใช้
    CoreDB-->>WebApp: Polling/Sync ดึงข้อความใหม่ขึ้นหน้าจอ
    WebApp-->>Admin: เสียงแจ้งเตือน + ข้อความเด้งขึ้นหน้าแชท

    Note over Admin, Customer: ฝั่งแอดมินตอบกลับ
    Admin->>WebApp: คลิกเลือก Quick Reply หรือพิมพ์ข้อความ
    WebApp->>CoreDB: ส่ง POST /api/messages
    CoreDB->>LineAPI: ส่ง Push Message API ไปยัง LINE
    LineAPI->>Customer: ลูกค้าได้รับข้อความตอบกลับในโทรศัพท์ทันที!
```

---

## 🧪 การทดสอบและความเสถียร (Testing & Quality)

โปรเจกต์มีชุดทดสอบอัตโนมัติครบทุกเลเยอร์ด้วย **Vitest** ผ่านการทดสอบทั้งหมด **53/53 Tests**:

```bash
$ npm test

 ✓ src/lib/__tests__/line.test.ts (10 tests)       # Signature verification & Profile fetching
 ✓ src/lib/__tests__/storage.test.ts (8 tests)     # Client caching & zero-latency sync
 ✓ src/lib/__tests__/db.test.ts (11 tests)         # JSON database operations & safety
 ✓ src/services/__tests__/services.test.ts (8 tests) # Service layer HTTP handling
 ✓ src/app/api/__tests__/routes.test.ts (16 tests) # Next.js Route Handlers & Webhooks

 Test Files  5 passed (5)
      Tests  53 passed (53)
```

- **Production Build Verification**: ผ่านการ build ด้วย `npm run build` ไร้ Type Error หรือ Warning

---

## 📦 วิธีการติดตั้งและรันในเครื่อง (Local Setup)

### 1. โคลน Repository และติดตั้ง Dependencies

```bash
git clone https://github.com/Kittipattt/ROBOLINGO-webchat.git
cd ROBOLINGO-webchat
npm install
```

### 2. กำหนดค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ Root Directory แล้วระบุคีย์ LINE OA:

```env
LINE_CHANNEL_ID=2011444753
LINE_CHANNEL_SECRET=a332359595bf165877cafd925c2f5ccf
LINE_CHANNEL_ACCESS_TOKEN=<your_line_channel_access_token>

NEXT_PUBLIC_LINE_OA_ID=@194rgooz
NEXT_PUBLIC_LINE_OA_URL=https://line.me/R/ti/p/@194rgooz
```

### 3. เริ่มต้นรันเซิร์ฟเวอร์สำหรับ Development

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่: [http://localhost:3000](http://localhost:3000)

### 4. รันทดสอบ Unit & Integration Tests

```bash
npm test
```

---

## 🌐 การเชื่อมต่อ LINE Webhook ในเครื่อง (Local Tunneling)

เนื่องจาก LINE Messaging API ต้องการส่ง Webhook มายัง HTTPS URL สาธารณะ ให้ใช้ `ngrok`:

```bash
npx ngrok http 3000
```

นำ Forwarding URL ที่ได้ (เช่น `https://xxxx-xx.ngrok-free.app`) ไปใส่ใน **[LINE Developers Console](https://developers.line.biz/)**:
1. เข้าไปที่แท็บ **Messaging API**
2. **Webhook URL**: `https://xxxx-xx.ngrok-free.app/api/line/webhook`
3. กดปุ่ม **Verify** (ต้องขึ้นผลลัพธ์ว่า Success)
4. เปิดสวิตช์ **Use webhook** เป็น **ON**

---

## 🚀 การ Deploy บน Vercel

1. Fork หรือ Push โค้ดเข้า GitHub ของคุณ
2. นำ Repository ไป Import บน [Vercel Dashboard](https://vercel.com/)
3. ในส่วน **Environment Variables** เพิ่มค่าที่จำเป็น:
   - `LINE_CHANNEL_ID`
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `NEXT_PUBLIC_LINE_OA_ID`
   - `NEXT_PUBLIC_LINE_OA_URL`
4. กด **Deploy**
5. นำ Production Domain ที่ได้ไปตั้งค่า Webhook ใน LINE Developers Console:
   - `https://<your-vercel-domain>.vercel.app/api/line/webhook`

---

## 📱 ข้อมูลสำหรับการทดสอบ (Submission Deliverables)

| รายการ | ข้อมูล / ลิงก์ |
| :--- | :--- |
| **LINE Official Account** | [`@194rgooz`](https://line.me/R/ti/p/@194rgooz) |
| **ลิงก์แอดไลน์ทดสอบ** | [https://line.me/R/ti/p/@194rgooz](https://line.me/R/ti/p/@194rgooz) |
| **GitHub Repository** | [https://github.com/Kittipattt/ROBOLINGO-webchat](https://github.com/Kittipattt/ROBOLINGO-webchat) |

---

<div align="center">
  <sub>พัฒนาด้วยความใส่ใจในรายละเอียด โดย Kittipattt • Powered by Next.js & LINE Messaging API</sub>
</div>
