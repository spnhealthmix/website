# SPN Health Mix — Project-Wide Unused Files and Code Audit Report

**Date:** 28 October 2026  
**Status:** Phase 1: Audit Only (Strictly Read-Only — No files modified or deleted)  
**Scope:** Repository-wide audit covering assets, dependencies, components, dead code, and configuration.

---

## Executive Summary

A comprehensive repository audit of the SPN Health Mix project was performed to identify unnecessary files, unused images, duplicate assets, dead code, obsolete components, and redundant dependencies.

| Category | Total Checked | High-Confidence Cleanup Candidates | Review Needed / Keep |
| :--- | :--- | :--- | :--- |
| **Static Images & Media** | 74 files across `images/`, `public/`, `public/images/`, `public/categories/`, `public/products/` | **51 files (~38.4 MB)** | 23 files (Active Storefront / Bento / Category / Slider) |
| **Source Components & UI** | 44 components across `src/components/` | **3 components** (`badge.tsx`, `button.tsx`, `skeleton.tsx`) | 41 components (Active UI) |
| **Dependencies** | 16 runtime + 10 dev dependencies | **2 packages** (`@radix-ui/react-separator`, `@radix-ui/react-dialog`) | 24 packages |
| **Configuration & Artifacts** | Root configs & temp files | **2 files** (`wrangler.example.jsonc`, `tsconfig.tsbuildinfo`) | Core configs (`next.config.ts`, `drizzle.config.ts`, etc.) |

---

## 1. High-Confidence Cleanup Candidates

### A. Redundant Root `images/` Directory (34 Files — ~21 MB)
- **Path:** `images/` (root folder)
- **Category:** Static Assets
- **Evidence:** 
  - The application is a Next.js App Router application. Next.js serves static assets exclusively from the [`public/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public) directory.
  - The root `images/` directory is **not reachable via HTTP** in Next.js.
  - A global codebase search confirms **zero references** to `images/` outside of documentation or duplicate files.
  - Product images in `images/*.jpg` are duplicated inside [`public/products/<slug>/main.jpg`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public/products).
  - Hero images in `images/hero*.jpeg` are duplicated in `public/`.
  - Logos (`images/logo.png`, `images/logo1.png`) are duplicated in `public/logo.png`.
- **Potential Impact if Removed:** None. Storefront and admin continue serving all assets from `public/`.
- **Recommended Action:** `SAFE TO REMOVE` (High confidence).

---

### B. Duplicate `public/images/` Directory (13 Files — ~9.8 MB)
- **Path:** `public/images/`
- **Category:** Static Assets
- **Evidence:**
  - Files:
    - `hero1.jpeg`, `hero2.jpeg`, `hero3.jpeg`, `hero4.jpeg`, `hero5.jpeg`
    - `hero1-desktop.jpeg`, `hero2-desktop.jpeg`, `hero3-desktop.jpeg`
    - `hero1-desktop.png`, `hero2-desktop.png`, `hero3-desktop.png`, `hero4-desktop.png`, `hero5-desktop.png`
  - The active hero slider in [`src/components/home/hero-slider.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/home/hero-slider.tsx#L15-L37) explicitly references `/hero1.jpeg`, `/hero1-desktop.jpeg`, `/hero2.jpeg`, `/hero2-desktop.jpeg`, `/hero3.jpeg`, `/hero3-desktop.jpeg` which reside directly in [`public/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public).
  - Codebase search for `/images/hero` or `public/images` yielded zero results.
- **Potential Impact if Removed:** None. All hero slides load from `/hero*.jpeg`.
- **Recommended Action:** `SAFE TO REMOVE` (High confidence).

---

### C. Unused Hero Variants & Obsolete Graphics in `public/` (4 Files — ~7.6 MB)
- **Path:**
  - `public/hero1-desktop.png` (1.43 MB)
  - `public/hero2-desktop.png` (1.48 MB)
  - `public/hero3-desktop.png` (1.45 MB)
  - `public/hero4-desktop.png` (1.39 MB)
  - `public/hero5-desktop.png` (1.46 MB)
  - `public/hero1-landscape.jpg` (365 KB)
  - `public/hero2-landscape.jpg` (368 KB)
  - `public/hero3-landscape.jpg` (364 KB)
  - `public/hero4-landscape.jpg` (354 KB)
  - `public/hero5-landscape.jpg` (367 KB)
  - `public/hero 4.jpeg` & `public/hero 5.jpeg` (space in filename duplicates)
  - `public/hero4.jpeg` & `public/hero5.jpeg` (active slider only uses slides 1, 2, 3)
  - `public/hero-visual.png` & `public/hero-composition.png` (1.22 MB each — identical byte-for-byte binary duplicates, zero code references)
- **Category:** Static Assets
- **Evidence:**
  - Codebase search for `hero-visual.png`, `hero-composition.png`, `landscape`, and `.png` hero versions returned zero references.
  - Active hero slider uses `.jpeg` versions for slides 1 to 3.
- **Potential Impact if Removed:** Huge reduction in git repository size (~15+ MB) with zero visual impact.
- **Recommended Action:** `SAFE TO REMOVE` (High confidence).

---

### D. Duplicate / Orphaned Product Folders in `public/products/`
- **Paths:**
  - `public/products/karuveppilai-saadam-podi/` (Duplicate of `karuveppilai-sadham-podi/`)
  - `public/products/moringa-leaves-saadam-podi/` (Duplicate of `moringa-leaves-sadham-podi/`)
  - `public/products/sambar-powder/` (Duplicate of `sambar-masala/`)
- **Category:** Static Assets
- **Evidence:**
  - Active database seed and catalogue code use `karuveppilai-sadham-podi`, `moringa-leaves-sadham-podi`, and `sambar-masala`.
  - The `-saadam-` and `-powder` variations have zero references in database schemas, seeds, or components.
- **Potential Impact if Removed:** Saves disk space and eliminates confusion when updating product imagery.
- **Recommended Action:** `SAFE TO REMOVE` (High confidence).

---

### E. Unused Radix UI Packages in `package.json`
- **Package Names:**
  - `@radix-ui/react-separator` (`^1.1.16`)
  - `@radix-ui/react-dialog` (`^1.2.0`)
- **Category:** Dependencies
- **Evidence:**
  - Full codebase search across `src/` and `tests/` found **zero imports** of `@radix-ui/react-separator` or `@radix-ui/react-dialog`.
  - Dialogs in admin and storefront are implemented using custom Tailwind modals and HTML `<dialog>`/state.
  - Separators are styled via CSS borders (`border-t`, `border-b`, `<hr>`).
- **Potential Impact if Removed:** Reduces `node_modules` size and bundle dependency tree.
- **Recommended Action:** `SAFE TO REMOVE` in Phase 2.

---

### F. Unused Shadcn Primitive Stubs in `src/components/ui/`
- **Paths:**
  - [`src/components/ui/badge.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/ui/badge.tsx)
  - [`src/components/ui/button.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/ui/button.tsx)
  - [`src/components/ui/skeleton.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/ui/skeleton.tsx)
- **Category:** Code / Component
- **Evidence:**
  - Neither `badge.tsx`, `button.tsx`, nor `skeleton.tsx` is imported anywhere in the project.
  - The project uses custom semantic Tailwind buttons (`<button className="...">`) across all storefront and admin components.
  - Note: [`src/components/ui/toast.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/ui/toast.tsx) **IS ACTIVELY USED** by checkout and account address forms and **MUST BE KEPT**.
- **Potential Impact if Removed:** If `button.tsx` is removed, `@radix-ui/react-slot` and `class-variance-authority` also become unused.
- **Recommended Action:** `SAFE TO REMOVE` (or keep if user plans to adopt standard Shadcn components in the future).

---

## 2. Candidates Requiring Manual Review

### A. Redirect Stubs in Storefront Routes
- **Paths:**
  - [`src/app/(storefront)/privacy/page.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/app/(storefront)/privacy/page.tsx) (redirects to `/privacy-policy`)
  - [`src/app/(storefront)/shipping/page.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/app/(storefront)/shipping/page.tsx) (redirects to `/shipping-policy`)
  - [`src/app/(storefront)/returns/page.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/app/(storefront)/returns/page.tsx) (redirects to `/cancellation-refund-policy`)
- **Evidence:** These 3 routes only contain 4 lines of code calling `redirect(...)`.
- **Review Reason:** Useful for preserving legacy customer bookmarks or external links, or they can be moved into `next.config.ts` `redirects()` to eliminate the route folders.
- **Recommended Action:** `KEEP` as URL aliases or consolidate into `next.config.ts`.

---

### B. Cloudflare Worker Stub & Example Config
- **Paths:**
  - [`src/worker/scheduled.ts`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/worker/scheduled.ts)
  - `wrangler.example.jsonc`
- **Evidence:** Cron trigger implementation for expiring pending orders via Cloudflare Workers.
- **Review Reason:** If the application is hosted on Vercel or Node.js rather than Cloudflare Pages/Workers, this worker entry point is unused.
- **Recommended Action:** `INVESTIGATE` deployment target. If deploying on Vercel, use Vercel Cron (`vercel.json`) instead.

---

### C. Category Image Sets in `public/categories/`
- **Paths:**
  - `public/categories/health-mix.jpg` (746 KB) vs `cat-health-mix.jpg` (53 KB)
  - `public/categories/masalas-and-powders.jpg` (861 KB) vs `cat-masalas.jpg` (53 KB)
  - `public/categories/podi-varieties.jpg` (841 KB) vs `cat-podi.jpg` (49 KB)
  - `public/categories/snacks.jpg` (896 KB) vs `cat-snacks.jpg` (55 KB)
- **Evidence:** The larger files (~800KB) are used on the About/Contact pages, while `cat-*.jpg` (~50KB) are used for category bento and admin manager cards.
- **Recommended Action:** `KEEP`. Both sets serve distinct aspect ratios and resolutions.

---

## 3. Files and Folders That MUST BE PRESERVED

Under no circumstances should any of the following be deleted or altered during cleanup:
1. **Core Storefront & Catalogue:**
   - All 28 active product directories in [`public/products/<slug>/main.jpg`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public/products).
   - Category banners in [`public/categories/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public/categories).
   - Hero slider slides in `public/hero1.jpeg`, `public/hero1-desktop.jpeg`, etc.
   - Decorative leaf asset [`public/hero-leaves.png`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public/hero-leaves.png).
   - Brand logo [`public/logo.png`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/public/logo.png).
2. **Database & Migrations:**
   - [`drizzle/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/drizzle) schema history and migration files (`0000` to `0005`).
   - [`src/lib/db/schema.ts`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/lib/db/schema.ts) and [`src/lib/db/seed.ts`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/lib/db/seed.ts).
3. **Security & Order Management:**
   - Print address slip feature in [`src/components/admin/order-detail-view.tsx`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/components/admin/order-detail-view.tsx).
   - Rate limiting, CSRF/origin checks, and session cookies in [`src/lib/security/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/src/lib/security).
   - Razorpay verification and Shiprocket shipping providers.
   - All 16 automated test suites in [`tests/`](file:///c:/Users/acer/Downloads/SPN-Foods-main/SPN-Foods-main/tests).

---

## 4. Suggested Cleanup Order (For Future Phase 2)

When ready to proceed with actual removal:
1. **Step 1 (Zero-Risk Static Asset Cleanup):**
   - Delete root `images/` directory.
   - Delete `public/images/` directory.
   - Delete duplicate `.png` and `landscape` hero files from `public/`.
   - Delete orphaned product directories (`karuveppilai-saadam-podi`, `moringa-leaves-saadam-podi`, `sambar-powder`).
2. **Step 2 (Unused Component Cleanup):**
   - Remove unused UI primitives: `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/skeleton.tsx`.
3. **Step 3 (Dependency Pruning):**
   - Remove `@radix-ui/react-dialog` and `@radix-ui/react-separator` from `package.json`.
   - If `button.tsx` was removed, also prune `@radix-ui/react-slot` and `class-variance-authority`.
4. **Step 4 (Validation):**
   - Run `npm run typecheck` and `npm test`.
   - Verify storefront and admin panel rendering in browser.
