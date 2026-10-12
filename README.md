# Iraqi Dollar – Backend

Single Render **Web Service** (Node + Express) + **PostgreSQL**. It also serves the frontend from `public/index.html`.

## Run locally
```
npm install
cp .env.example .env   # fill values, then export them (or use your own loader)
npm start
```
Tables are created automatically on startup (`db.js`).

## Render
1. Push this folder to GitHub (put `index.html` inside `public/`).
2. Render → New → Blueprint → select the repo (uses `render.yaml`).
3. Set `WA_API_KEY` (rotate your old key first, it was exposed in the frontend).

## API (all JSON, Bearer token except auth)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/signup/request | name, email, phone, password → sends WhatsApp OTP |
| POST | /api/auth/signup/verify | phone, code → creates account, returns token |
| POST | /api/auth/login | email, password |
| POST | /api/auth/password | current, next |
| GET | /api/me | full state (balances, counter) |
| POST | /api/counter/toggle · /claim | start/stop · claim points |
| POST | /api/counters/buy | idx |
| GET | /api/market | listings |
| POST | /api/market/list · unlist · buy | id (+ price) |
| POST | /api/store/purchase | items: [productIndex] |
| POST | /api/transfer | type: friend/gem/usd, amount, to (referral code) |
| GET/POST | /api/withdrawals · /api/withdraw | amount, method, emergency |
| POST | /api/fun/spin | wheel of fortune |
| GET | /healthz | health check |

## Not implemented yet
P2P / agent point purchases (need a real payment-confirmation flow), KYC upload, change phone/email, merchants, support chat, the 4-player game, referral commissions, and wiring `index.html` to these endpoints.
