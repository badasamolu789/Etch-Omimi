# Etch UI & Experience Design System

Version 2.0

## Product Vision

Etch is not designed to feel like a freelance marketplace, social network, or generic asset library.

Etch is a premium marketplace for commercial creative intellectual property. The interface should make visitors feel that they are browsing work with real business value, not simply downloadable assets.

The product should communicate:

- Professionalism
- Curation
- Commercial readiness
- Trust
- Creative value

The interface communicates confidence through restraint. Instead of visual noise, Etch relies on generous whitespace, editorial typography, strong imagery, concise copy, flat surfaces, and purposeful color.

## Design Principles

### Calm

Avoid visual clutter. Each section should have one clear job and one dominant action.

### Editorial

Pages should read like premium publishing layouts, not dashboards. Typography, spacing, and imagery should carry the experience.

### Flat

Only buttons and button-style CTAs receive drop shadows. Cards, panels, navigation, carousels, and page sections stay flat.

### Spacious

Use large margins and clear section breaks. Do not overcrowd information.

### Purposeful Color

Green and gold accents guide attention. They should not become decoration.

### Real Work

Use images that imply real creative production: scripts, music studios, storyboards, production desks, concept work, and creative review.

## Color Theme

The public site uses the shared Etch tokens from `styles.css`.

| Token | Hex | Use |
| --- | --- | --- |
| `--ink` | `#1A1A1A` | Primary text, dark buttons, strong labels |
| `--mist` | `#F9F9F7` | Soft page surfaces and light backgrounds |
| `--gold` | `#99A96A` | Main brand accent, CTA accents, highlights |
| `--ember` | `#6F7D49` | Eyebrows, secondary accents, editorial labels |
| `--pine` | `#4A5433` | Deep green accent for buttons, chips, and emphasis |
| `--slate` | `#5F654D` | Body copy and muted text |
| `--cloud` | `#D4DBC2` | Soft borders, pale fills, category accents |
| `--white` | `#FFFFFF` | Clean canvas areas and flat section backgrounds |

The current public-site background is a warm off-white close to `#F5F5F0`.

## Shared Public UI Rules

- Header stays compact and rounded.
- Heroes stay compact; avoid oversized vertical hero sections.
- Carousels span edge to edge.
- Cards remain flat.
- Buttons have shadows.
- Avoid decorative gradients except where they communicate product context.
- Use real imagery over abstract illustration.
- Keep copy direct and commercial.

## Public Site Architecture

### Header

Loaded from `components/landing-header.html`.

Includes:

- Brand mark
- Public navigation
- Search input
- Login CTA
- Mobile menu

The header should stay visually quiet and should not compete with the page hero.

## Landing Page

File: `index.html`

### Purpose

Introduce Etch in under thirty seconds.

The visitor should understand:

- What Etch sells
- Why the work is valuable
- Why creators should join
- Where to browse next

### Structure

```text
Header
Compact hero
Category strip
Full-width carousel
How it works
Marketplace pulse
Browse categories
Creator positioning
Featured work
Featured makers
Final callout
Footer
```

### Hero

The hero uses `.landing-hero`.

It contains:

- Eyebrow: `Etch by OMIMI`
- Headline: `Premium Creative IP Marketplace`
- Short value proposition
- Primary CTA: `Explore marketplace`
- Secondary CTA: `Start selling`
- Marketplace preview stage

The hero stage includes floating marketplace signals and a device-like featured listing preview. These should make the marketplace feel active without creating visual clutter.

### Category Strip

The `brand-strip` shows marketplace pillars:

- Scripts
- Storyboards
- Music
- Concept Art
- Motion
- Copy

### Full-Width Carousel

The carousel uses:

- `.carousel-section`
- `.carousel-shell`
- `.carousel-track`
- `.carousel-card`

It must span edge to edge and remain flat.

### How It Works

Explains the buyer workflow:

1. Find the right work
2. Review with context
3. Request access
4. Move to terms

### Marketplace Pulse

Uses `.metric-row` for compact confidence signals:

- Core categories
- Response window
- Unified workspace

### Featured Work

Uses `data-public-listings`.

Hydrated by:

- `scripts/api.js`
- `scripts/main.js`

The section reads public Supabase listings. There is no demo fallback.

### Featured Makers

Uses `data-featured-creators`.

Hydrated by Supabase creator profile reads.

## Marketplace Page

File: `products.html`

### Purpose

Allow buyers to browse creative work efficiently.

### Structure

```text
Header
Compact hero
Full-width carousel
Value section
Marketplace search
Horizontal filters
Results count
Listing grid
Pagination
Buyer paths
Footer
```

### Marketplace Toolbar

The marketplace toolbar uses `data-marketplace-toolbar`.

It includes:

- Large search field
- Category filter
- License filter
- Industry filter
- Price filter
- Sort control
- Results count
- Clear filters button

Filters remain horizontal on desktop and stack on smaller screens.

### Listing Grid

Every listing card should contain:

- Image
- Title
- Creator
- Category
- License or rights summary
- Short description
- Price
- View listing CTA

Cards remain flat. The `View` CTA can have a shadow because it behaves like a button.

### Request Behavior

Marketplace listing requests use Supabase `.select()`.

Filters are passed into `EtchApi.getPublicListings()`:

- `search`
- `category`
- `license`
- `industry`
- `price`
- `sort`

## Search Results Page

File: `search.html`

### Purpose

Fast discovery from query intent.

### Structure

```text
Search hero
Filter summary
Results grid
Search guidance
Footer
```

The page supports:

- Loading state
- Empty state
- Error state

## Listing Details Page

File: `product-detail.html`

### Purpose

Convince buyers that a listing is commercially valuable.

### Structure

```text
Gallery
Title
Creator
License
Price
Primary CTA
Overview
Specifications
Files / deliverables
Creator
Review checklist
Related listings
Footer
```

### Commercial Summary

One clear section should explain:

- Intended usage
- Audience
- Licensing value

### Included Files

Deliverables should be shown plainly, for example:

- PDF
- WAV
- AI
- PSD
- Pitch deck
- Treatment
- Preview files

### Licensing

Licensing should explain:

- Commercial rights
- Exclusivity
- Restrictions
- Review access
- Custom deal path

### Creator

Creator section should show:

- Name
- Role or specialty
- Bio
- Trust signals
- Other listings when available

## Explore Page

File: `explore.html`

### Purpose

Introduce discovery paths and featured creators.

Explore should feel like a curated creative desk, not an endless feed.

Important sections:

- Compact hero
- Full-width carousel
- Why Etch
- Featured creators
- Categories
- Use cases

## About Page

File: `about.html`

### Purpose

Explain why Etch exists and what standards guide the marketplace.

Important sections:

- Compact hero
- Core value cards
- Why it exists
- Pillars
- Operating principles

## Contact Page

File: `contact.html`

### Purpose

Route buyers, creators, and support requests into the right conversation.

Important sections:

- Compact hero
- Contact details
- Inquiry form
- Support lanes
- Message guidance

The contact form submits through `EtchApi.submitContact()` using Supabase `.insert()`.

## Creator Profile

Future public creator profile pages should sell the creator, not just their listings.

Recommended structure:

```text
Cover
Profile
About
Featured Work
Collections
Experience
Contact
```

Profile content should include:

- Avatar
- Name
- Location
- Specialties
- Response rate
- Portfolio

## Creator Dashboard

Dashboard pages use a different visual style. They should still feel premium but more operational.

Implemented structure:

```text
Overview
Listings
Upload
Analytics
Messages
Licensing Requests
Sales
Settings
```

Dashboard cards stay flat. Only action buttons receive shadows.

Current files:

- `user/dashboard.html`
- `user/storefront.html`
- `user/listings.html`
- `user/uploads.html`
- `user/licensing.html`
- `user/messages.html`
- `user/sales-earnings.html`

These pages use `scripts/dashboard.js` and `scripts/api.js` for live Supabase reads, skeleton states, empty states, and listing creation.

## Buyer Dashboard

Future buyer dashboard structure:

```text
Saved
Requests
Downloads
Licenses
Messages
Invoices
```

## Upload Listing

Upload is a critical creator flow.

Implemented file: `user/uploads.html`

Recommended product flow:

```text
Step 1: Basic Information
Step 2: Media
Step 3: Files
Step 4: Pricing
Step 5: Licensing
Step 6: Review
Publish
```

Every step should define:

- Required fields
- Optional fields
- Validation
- Success state

## Messages

Messages are for professional negotiation, not social chat.

Recommended layout:

```text
Conversation List
Message Thread
Offer Panel
Attachments
```

## Notifications

Notifications should be compact and grouped.

Good groups:

- Licensing
- Messages
- Payments
- Reviews
- Account

## Admin Dashboard

Implemented files:

- `admin/dashboard.html`
- `admin/content-review.html`
- `admin/licensing-queue.html`
- `admin/escrow-payouts.html`
- `admin/support-inbox.html`
- `admin/users.html`

Admin pages use Supabase `.select()` work queues through `EtchApi.getAdminDashboard()` and `EtchApi.getAdminWorkQueue()`. They do not use hardcoded operational totals.

## API Expectations

The frontend uses:

- `scripts/config.js`
- `scripts/supabase.js`
- `scripts/api.js`
- `scripts/main.js`

Request types:

- Reads: `.select()`
- Creates: `.insert()`
- Updates: `.update()`
- Deletes: `.delete()`
- Idempotent newsletter subscription: `.upsert()`

There should be no fake success or demo data fallback.

## Maintenance Notes

- Keep heroes compact.
- Keep page sections flat.
- Keep carousels edge to edge.
- Keep listing cards commercially useful.
- Do not add shadows to cards.
- Prefer meaningful product imagery.
- Keep CTAs direct.
