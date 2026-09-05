# MyPayment by Bamyon

Payments made simple. Business made smarter.

A real (not demo-mode) payment-link, order-management, and receipt platform for
small businesses, event organizers, and student entrepreneurs — built as a
static multi-page site: vanilla HTML/CSS/JS + Tailwind (CDN) + Firebase
(Auth/Firestore) + Cloudinary.

## Before you deploy — 3 things you MUST do

1. **Regenerate your Cloudinary API secret.** It was visible in an earlier
   screenshot in this build conversation. Go to Cloudinary → Settings →
   Security → regenerate. This project never uses the secret client-side, but
   the old one is compromised and should be rotated regardless.

2. **Create an unsigned Cloudinary upload preset**, then paste its name into
   `js/cloudinary.js`:
   ```js
   const CLOUDINARY_UPLOAD_PRESET = "REPLACE_WITH_YOUR_UNSIGNED_PRESET";
   ```
   Cloudinary dashboard → Settings → Upload → Upload presets → Add upload
   preset → Signing Mode: **Unsigned**.

3. **Deploy the Firestore security rules** in `firestore.rules` (Firebase
   Console → Firestore → Rules, or `firebase deploy --only firestore:rules`
   if you have the CLI). Read the warning at the bottom of that file — these
   are hackathon-appropriate starter rules, not a hardened production
   ruleset.

## Set your WhatsApp number

`js/payments.js` has a hardcoded business WhatsApp number for the "pay via
WhatsApp" flow:
```js
const BUSINESS_WHATSAPP = "2348025892143";
```
Change this to your real number (country code, no `+` or leading `0`).

## Firestore composite indexes

The dashboard queries payments/products by `adminId` + orders by `createdAt`.
The first time you load the dashboard, Firestore will throw a console error
with a direct "Create index" link — click it once per query (products,
payments) and wait ~1 minute for the index to build. This is normal Firestore
behavior, not a bug.

## Local preview

No build step. Any static file server works:
```bash
npx serve .
# or
python3 -m http.server 8080
```

## Deploy to Vercel

Connect the repo in Vercel → it auto-detects a static site → deploy. No
build command needed. `vercel.json` sets clean URLs.

## Project structure

```
index.html          landing page (hero, how it works, features, status lookup)
login.html           email/password login
signup.html           business signup → redirects to dashboard with onboarding
dashboard.html        authenticated admin app (overview/products/payments/
                      customers/receipts/analytics/settings) + all modals
product.html          public checkout page  (?id=PRODUCT_ID)
status.html           public payment-status lookup  (?bmz=BMZ_ID)

css/style.css         fonts, design tokens, form control base styles, print CSS
public/images/        Bamyon logo mark + wordmark + generated favicons
firestore.rules       security rules (read the warning at the bottom)
vercel.json

js/firebase-config.js Firebase Auth/Firestore init
js/cloudinary.js       unsigned image upload helper
js/auth.js             signup / login / logout / admin profile
js/bmz.js              BMZ-XXXX-000 ID generation (Firestore transaction)
js/products.js         product CRUD
js/payments.js         payment lifecycle, WhatsApp message builders, CRM grouping
js/ui.js               toasts, modals, formatting, error logging
js/dashboard.js         all admin dashboard sections + modals
js/checkout.js          public checkout + status-lookup rendering
js/landing.js, login-page.js, signup-page.js, dashboard-page.js,
js/product-page.js, status-page.js   — one small bootstrap script per page
```

## What's implemented

Signup/login, product creation with Cloudinary image upload, shareable
payment links, guest checkout (WhatsApp or manual transfer + proof upload),
BMZ ID generation, payment queue with approve/reject/request-proof, WhatsApp
confirmation message generation, printable receipts, joint contribution
progress bars, cross-sell, lost-BMZ-ID requests, a lightweight CRM view,
basic analytics, and business settings.

## Deliberately out of scope for this MVP

Blog, super-admin console, customer reviews, and in-app support chat appear
in the original planning doc but are **not built** — they weren't part of the
core payment flow and were cut to keep the MVP tight, per the "don't build
fake buttons" build philosophy. Happy to add any of them next.

## Debugging

Every caught error logs full detail to the browser console via
`console.error("[MyPayment] ...")` before showing a short toast — open
DevTools → Console if something silently fails.
