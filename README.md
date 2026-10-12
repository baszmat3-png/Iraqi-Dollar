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

## النشر على Render

1. يتم رفع الكود إلى مستودع GitHub.
2. في لوحة تحكم Render: **New +** → **Blueprint** واختيار المستودع (يستخدم `render.yaml`).
3. إدخال المتغيرات السرية المطلوبة في لوحة Render:
   - `GMAIL`: بريدك في Gmail.
   - `APP_PASS`: كلمة مرور التطبيق (App Password) المكونة من 16 حرفاً من Google.
   - `WPSENDER_API_KEY`: مفتاح WP Sender الخاص بك.
