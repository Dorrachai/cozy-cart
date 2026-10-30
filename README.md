# 🧺 CozyCart — Cute, Private Shared Household Shopping Lists

A **100% free (`$0`/month)**, lightweight **React 19 + TypeScript + Vite + Tailwind CSS v4** web app designed for **GitHub Pages**, supporting both **smartphone** and **PC** browsers.

## ✨ Highlights

- **Name Lists Anything**: Create monthly lists (*November 2026*), weekly grocery runs, dinner parties (*Taco Friday 🌮*), or any custom name without breaking mobile or desktop layouts.
- **No Login — Two-Tier Friend Codes**:
  - **Household Code (`H-…`)**: Share once with your partner or roommates so everyone sees all household lists automatically.
  - **Single-List Code (`L-…`)**: Share *only* one specific list with friends/guests while keeping the rest of your household private.
- **Privacy by Design (Zero-Knowledge Browser E2EE)**:
  - Friend Codes derive a `64`-char SHA-256 document ID and a `256`-bit `AES-GCM` encryption key via Web Crypto `PBKDF2` (`210,000` iterations) right inside your browser.
  - Invite links place the Friend Code strictly inside the URL `#hash` fragment (`#join=…`), which is **never transmitted over HTTP** to GitHub Pages or any server.
  - Firebase Firestore only ever stores opaque ciphertext (`ct`, `iv`, `rev`, `updatedAt`).
- **Private Multilingual Auto-Sorting**:
  - Powered by a compact distilled **Open Food Facts multilingual taxonomy** (`14.6 KB` gzipped) + **Fuse.js** fuzzy matching + compound-word suffix rules (supporting English, Swedish, German, Spanish, French, and more) with **zero external API calls**.
  - Tapping an item's aisle pill teaches your household's encrypted dictionary for future lists.
- **1-Tap Copy & Paste Notes Checklist**:
  - Heading into a store with poor reception? Tap **Notes** to copy a formatted checklist (`☐` checkboxes, Apple Notes / Google Keep clean lines, or `- [ ]` Markdown), or paste lines from your Notes app right back into CozyCart to auto-sort them.

---

## 🚀 Deploy Free to GitHub Pages (3 Minutes)

1. Push this folder to a GitHub repository on the `main` branch.
2. In your GitHub repo, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
3.*(Optional — for cross-device phone-to-phone sync)* Connect a `$0` **Firebase Spark** project (no credit card required):
   - Go to [console.firebase.google.com](https://console.firebase.google.com/) and create a free project.
   - Enable **Authentication → Sign-in method → Anonymous**.
   - Enable **Firestore Database** and paste the rules from [`firestore.rules`](./firestore.rules) into the **Rules** tab.
   - Register a **Web App** in Project Settings to copy your public `firebaseConfig` values, and add them in GitHub under **Settings → Secrets and variables → Actions → Variables**:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
   - *(Recommended)* In Google Cloud Console → **APIs & Services → Credentials**, restrict the Browser API key's **HTTP referrers** to `https://<your-github-username>.github.io/*`.
4. Trigger or push to `main` — [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) runs `Vitest` unit tests, builds `./dist`, and deploys straight to GitHub Pages!

---

## 🛠️ Local Development

```bash
npm install
npm test -- --run      # Run Vitest unit tests (crypto, CRDT, categorizer, Notes checklist)
npm run dev            # Start local dev server
npm run build          # Type-check & build production static bundle into dist/
```
