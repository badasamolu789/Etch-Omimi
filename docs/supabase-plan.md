# Supabase integration plan for Etch

## 1. Recommended Supabase setup
- Create a Supabase project and enable Email authentication.
- Run `docs/supabase-schema.sql` in the Supabase SQL Editor.
- Optional storage buckets to create next:
  - `listing-covers`: public read, creator/admin writes.
  - `listing-previews`: signed URLs for protected previews.
  - `profile-avatars`: public read, profile owner/admin writes.

## 2. Frontend integration approach
- Use the existing static HTML pages as views and connect forms to Supabase via a small JavaScript module.
- Add a shared config file that loads the Supabase client from environment variables or a public config object.
- Replace local-only form feedback with real async submissions.

## 3. Suggested data flow
- Auth: sign up, sign in, sign out, and password reset with Supabase Auth.
- Listings: fetch public listings on products, search, product detail, and related listing sections.
- Explore: fetch featured creator profiles.
- Dashboard: load user-specific data for the creator/admin views.
- Contact form: insert into the contacts table.
- Newsletter: save emails to a subscribers table.

## 4. UI/UX notes for the upgrade
- Shared helpers now live in:
  - `scripts/ui.js`: toasts, loading buttons, empty states, skeletons, modal/bottom sheet.
  - `scripts/api.js`: cached Supabase queries and dashboard data loaders.
  - `scripts/supabase.js`: lazy client initialization, auth/profile helpers.
- Dashboard sections should use `data-dashboard-*` hooks so skeletons and empty states are automatic.
- Use count-only Supabase queries for stats, small `limit()` queries for lists, and cache short-lived dashboard reads.
- Do not use demo data or fake success fallbacks. Missing Supabase config or failed requests should surface as errors or empty states.
- Request types are handled through Supabase query builders: `select` for reads, `insert` for creates, `update` for edits, `delete` for deletes, and `upsert` only for idempotent newsletter subscription by email.

## 5. Implementation map
- Auth helpers: `scripts/supabase.js`.
- Auth page handlers: `scripts/auth.js`.
- API/data layer: `scripts/api.js`.
- Public page hydration, contact, newsletter, and sign out: `scripts/main.js`.
- Dashboard hydration: `scripts/dashboard.js`.
- SQL schema and RLS: `docs/supabase-schema.sql`.
- Connected public pages: `index.html`, `products.html`, `search.html`, `explore.html`, `product-detail.html`, `contact.html`.
- Connected dashboard pages: `user/dashboard.html`, `user/listings.html`, `admin/dashboard.html`.

## 6. Information needed from the Supabase project
1. Project URL, used as `window.ETCH_SUPABASE_URL`.
2. Public anon key, used as `window.ETCH_SUPABASE_ANON_KEY`.
3. Final auth redirect URLs for production and local development.
4. Storage bucket names if they differ from the recommended names.
5. Whether payments/payouts will be handled by Stripe, Paystack, Flutterwave, or manual admin workflow.
6. Whether admin users will be promoted manually in SQL or through an internal admin screen.

Supabase config now lives in `scripts/config.js` and is loaded before `scripts/supabase.js` on every page that uses the API layer.

The anon key is public by design, but the service role key must never be added to this static frontend.

## 7. Implementation checklist
1. Create Supabase project and API keys.
2. Run `docs/supabase-schema.sql`.
3. Confirm `scripts/config.js` is included before `scripts/supabase.js` on deployed pages.
4. Seed real listings, creators, and admin users.
5. Connect upload/storage flows for listing cover and preview assets.
6. Connect admin review, users, support, payout, and licensing queues beyond the overview page.
7. Test auth, RLS, empty states, loading states, and failed request toasts.
