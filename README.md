# Iraqi Dollar – Application & Backend

تطبيق الدولار العراقي (Iraqi Dollar) مبني باستخدام:
- **Backend**: Node.js + Express + PostgreSQL.
- **Frontend**: واجهة مستخدم متجاوبة باللغة العربية (RTL) تُقدَّم من `public/index.html`.
- **OTP Verification**: دعم التحقق بالبريد الإلكتروني عبر **Nodemailer**، ورسائل واتساب عبر **WP Sender API**.

---

## تشغيل المشروع محلياً (Run Locally)

### 1. تثبيت الحزم:
```bash
npm install
```

### 2. إعداد ملف البيئة:
انسخ ملف الإعدادات وأدخل القيم الخاصة بك:
```bash
cp .env.example .env
```

محتويات ملف `.env`:
```env
# قاعدة البيانات
DATABASE_URL=postgres://user:password@localhost:5432/iraqi_dollar
DATABASE_SSL=false
JWT_SECRET=your-random-32-char-jwt-secret

# خدمة التحقق عبر البريد الإلكتروني (Gmail SMTP)
GMAIL=your-account@gmail.com
APP_PASS=your-gmail-app-password

# خدمة رسائل واتساب (WP Sender API)
WPSENDER_API_KEY=your-wpsender-api-key
WPSENDER_API_URL=https://backendapi.wpsenderx.com/api/messages/send

# لوحة تحكم إدارة المتجر
ADMIN_PASSWORD=your-admin-password

# وضع التطوير
PORT=3000
NODE_ENV=development
OTP_DEBUG=true   # عند التفعيل يطبع رموز OTP في الطرفية لتسهيل الاختبار المحلي
```

### 3. إنشاء الجداول وتطبيق الهجرة:
```bash
npm run migrate
```

### 4. فحص الشيفرة والتشغيل:
```bash
npm test
npm start
```

---

## مسارات الـ API (Endpoints)

| الطريقة | المسار | التوثيق | الوصف |
|---|---|---|---|
| GET | `/healthz` | عام | فحص جاهزية الخادم وقاعدة البيانات |
| POST | `/api/auth/signup/request` (أو `/send-otp`) | عام (محدد بالمعدل) | إرسال رمز OTP إلى البريد الإلكتروني وواتساب للتسجيل |
| POST | `/api/auth/signup/verify` (أو `/verify-otp`) | عام (محدد بالمعدل) | التحقق من رمز OTP وإنشاء الحساب وإرجاع JWT |
| POST | `/api/auth/login` | عام (محدد بالمعدل) | تسجيل الدخول بالبريد وكلمة المرور |
| POST | `/api/admin/verify` | عام | التحقق من كلمة مرور لوحة تحكم المنتجات |
| GET | `/api/products` | عام | قائمة منتجات المتجر |
| POST | `/api/auth/password` | Bearer Token | تغيير كلمة المرور |
| GET | `/api/me` | Bearer Token | جلب بيانات الحساب والرصيد والعداد |
| POST | `/api/counter/toggle` | Bearer Token | تشغيل أو إيقاف العداد |
| POST | `/api/counter/claim` | Bearer Token | استلام أرباح العداد بعد 24 ساعة |
| POST | `/api/counters/buy` | Bearer Token | شراء عداد جديد |
| GET | `/api/market` | Bearer Token | سوق العدادات المعروضة للبيع |
| POST | `/api/market/list` / `unlist` / `buy` | Bearer Token | عرض أو إلغاء أو شراء عداد من السوق |
| POST | `/api/store/purchase` | Bearer Token | شراء منتجات من المتجر |
| POST | `/api/transfer` | Bearer Token | تحويل نقاط لصديق أو تحويلها لجواهر/دولار |
| GET / POST | `/api/withdrawals` / `/api/withdraw` | Bearer Token | طلب وسجل سحب الرصيد |
| POST | `/api/fun/spin` | Bearer Token | تدوير عجلة الحظ (100 جوهرة) |

---

# API Endpoints Documentation

## 1. Health Check

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/healthz` | Public | Check server and database readiness |

## 2. Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup/request` | Public (Rate Limited) | Send OTP via Email and WhatsApp for registration |
| POST | `/api/auth/signup/verify` | Public (Rate Limited) | Verify OTP, create account, and return JWT |
| POST | `/api/auth/login` | Public (Rate Limited) | Login using email and password |
| POST | `/api/auth/password` | Bearer Token | Change account password |

**Alternative Endpoint Names:**
- `/api/auth/send-otp`
- `/api/auth/verify-otp`

## 3. Admin & Products

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/admin/verify` | Public | Verify the product dashboard password |
| GET | `/api/products` | Public | Retrieve the store products list |

## 4. User Account

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/me` | Bearer Token | Retrieve account details, balance, and counter status |

## 5. Counters

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/counter/toggle` | Bearer Token | Start or stop a counter |
| POST | `/api/counter/claim` | Bearer Token | Claim counter earnings after 24 hours |
| POST | `/api/counters/buy` | Bearer Token | Purchase a new counter |

## 6. Counter Marketplace

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/market` | Bearer Token | Retrieve counters listed for sale |
| POST | `/api/market/list` | Bearer Token | List a counter for sale |
| POST | `/api/market/unlist` | Bearer Token | Remove a counter from the marketplace |
| POST | `/api/market/buy` | Bearer Token | Purchase a listed counter |

## 7. Store & Purchases

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/store/purchase` | Bearer Token | Purchase products from the store |

## 8. Transfers

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/transfer` | Bearer Token | Transfer points to another user or convert them into gems or dollars |

## 9. Withdrawals

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/withdrawals` | Bearer Token | Retrieve withdrawal history |
| POST | `/api/withdrawals` | Bearer Token | Submit a withdrawal request |
| POST | `/api/withdraw` | Bearer Token | Alternative withdrawal request endpoint |

## 10. Fun & Rewards

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/fun/spin` | Bearer Token | Spin the wheel of fortune for 100 gems |

---

## General Notes

- **Public:** No authentication token is required.
- **Bearer Token:** Requires a valid JWT access token in the `Authorization` header.
- **Rate Limited:** Requests are subject to rate limits.
- These endpoints describe the planned API interface. Their actual availability and behavior depend on backend implementation.


## النشر على Render

1. يتم رفع الكود إلى مستودع GitHub.
2. في لوحة تحكم Render: **New +** → **Blueprint** واختيار المستودع (يستخدم `render.yaml`).
3. إدخال المتغيرات السرية المطلوبة في لوحة Render:
   - `GMAIL`: بريدك في Gmail.
   - `APP_PASS`: كلمة مرور التطبيق (App Password) المكونة من 16 حرفاً من Google.
   - `WPSENDER_API_KEY`: مفتاح WP Sender الخاص بك.

---

## تعليمات التشغيل والتحديث (محدَّثة)

### الملفات الإضافية المطلوبة بجانب `server.js`
`poke-ext.js` (مزامنة فورية) · `cloud-state-ext.js` (حفظ حالة الحساب والأرصدة على السيرفر) · `account-delete-ext.js` (حذف الحساب) · `google-auth-ext.js` (دخول Google) ·
`public/counters-sync.js` · `public/account-delete.js` · `public/privacy-policy.html` · `public/delete-account.html`

### أسطر الربط (يجب بقاؤها عند استبدال الملفات)
في `server.js`:
```js
const CLOUD = require('./cloud-state-ext'); CLOUD.parsers(app, express);   // بعد app.set('trust proxy', 1)
require('./poke-ext')(app);                                               // بعد app.set('trust proxy', 1)
CLOUD.routes(app, { pool, wrap, fail });                                  // بعد تعريف fail
require('./account-delete-ext')(app, { pool, wrap, fail });
```
في `public/index.html` بعد `user-ext.js`:
```html
<script src="/account-delete.js?v=1"></script><script src="/counters-sync.js?v=1"></script>
```
إن استبدلتَ `server.js` أو `index.html` بنسخة جديدة فأعد هذه الأسطر (أو أرسل الملفات ليُعاد دمجها).

### متغيرات Render
`DATABASE_URL` · `JWT_SECRET` · `GOOGLE_CLIENT_ID` (عميل الويب فقط، وليس عميل Android) · بقية المتغيرات كما كانت.

### كيف تُحفظ البيانات الآن
- **الأرصدة (نقاط/جواهر/دولار):** المرجع قاعدة البيانات (`sync_accounts`). كل جهاز يرسل فرق ما كسبه أو أنفقه فيُجمع مع رصيد السيرفر (جدول `dev_bal`)، فلا يضيع شحن لوحة التحكم ولا أرباح جهاز آخر، ويظهر الرصيد نفسه في المتصفح والتطبيق.
- **العدادات:** المرجع `sync_accounts.cl`. شحن/تصفير الإدارة وشراء المستخدم يظهران في كل الأجهزة خلال ثوانٍ.
- **حالة الحساب (المؤقت، السجل…):** جدول `cloud_state` عبر `/api/v1/login` و`/api/v1/state`.
- **الصورة الشخصية:** من السيرفر فقط (`/api/m/avatar`)، ولا تُعرض أي صورة مخزّنة محلياً على الجهاز.
- **المضاعفة:** تعرض عدد العدادات الفعّالة.

### التحقق بعد النشر
1) افتح الحساب نفسه في المتصفح والتطبيق: النقاط والجواهر والدولار والعدادات متطابقة.
2) من لوحة التحكم اشحن نقاطاً أو عداداً: يصل التطبيق خلال ثوانٍ.
3) في Render > Logs: لا أخطاء `mergeBal` أو `cloud_state`.

### Google Play
AAB موقّع بمفتاح الرفع · رابط الخصوصية `/privacy-policy.html` · رابط الحذف `/delete-account.html` · الحذف داخل التطبيق من «حسابي ← حذف حسابي».
