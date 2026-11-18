# TodoShoppingExtention

A web app that shows your **Microsoft To Do** shopping list **grouped by supermarket section**: vegetables together, dairy together, meat together, and so on. The UI is in Hebrew (right-to-left) and works like To Do.

- **Two-way sync.** Checking off, adding, renaming or deleting an item here does the same in To Do. Changes made in To Do, or by family members, appear within about 20 seconds.
- **Smart sorting.** A Groq LLM picks the section for each *new* item name. The answer is saved in Redis, so an item name is sent to the LLM only once and every later load comes from the DB.
- **Corrections for the whole family.** Tap an item and choose "העברה למחלקה" to fix its section. The fix is remembered for everyone and wins over the LLM.
- **Your store's layout.** Menu → "סדר המחלקות בסופר" sets the order of sections to match the way you walk through your store.
- **Built for use in the store.** Big tap targets, a keep-screen-on button (☀), paste a whole list at once, and it can be added to the phone's home screen.

Stack: Next.js 16 (App Router) · Tailwind · Microsoft Graph · Groq · Upstash Redis · Vercel.

---

## 1. Register the app with Microsoft (one time, ~10 min)

1. Go to <https://entra.microsoft.com> → **App registrations** → **New registration**.
   (With a personal outlook.com/hotmail account you may first need a free Azure account to get a directory: <https://azure.microsoft.com/free>.)
2. Name: `Shopping list`. **Supported account types:** *Accounts in any organizational directory and personal Microsoft accounts*.
3. **Redirect URI:** platform **Web**, `http://localhost:3000/api/auth/callback`. Register.
4. Copy the **Application (client) ID** → `MS_CLIENT_ID`.
5. **Certificates & secrets** → **New client secret** → copy the **Value** → `MS_CLIENT_SECRET`. It expires; put a reminder in your calendar.
6. **API permissions** → **Add a permission** → Microsoft Graph → **Delegated** → `Tasks.ReadWrite`, `User.Read`, `offline_access` (plus `openid`, `profile`, `email`).
7. After deploying (step 3), add a second redirect URI: `https://<your-app>.vercel.app/api/auth/callback`.

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # fill in MS_CLIENT_ID, MS_CLIENT_SECRET, GROQ_API_KEY
npm run dev                  # http://localhost:3000
```

Without Redis env vars, local data (category DB, sessions) is kept in `.data/kv.json`.

**Try it before the Microsoft setup:** run with `DEMO_MODE=1` (e.g. `DEMO_MODE=1 npm run dev`) to get a fake shopping list. Sorting still uses the real Groq.

## 3. Deploy to Vercel

1. Push the repo to GitHub, then on <https://vercel.com/new> import it (framework: Next.js, no settings to change).
2. Project → **Storage** → **Upstash for Redis** (free) → connect. This adds the Redis env vars.
3. Project → **Settings → Environment Variables**: add `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT=common`, `GROQ_API_KEY`, and `ALLOWED_EMAILS` (your family's Microsoft emails, recommended).
4. Deploy, then add the production redirect URI to the Microsoft app (step 1.7).
5. Open the site on each phone → sign in → pick the shared list → **Add to Home Screen**.

## How it works

```
Phone ──► Next.js route handlers on Vercel ──► Microsoft Graph /me/todo/...
                       ├──► Upstash Redis: item → section DB, sessions, section order
                       └──► Groq: only for item names not yet in the DB
```

- Item names are normalized before lookup (`"2 חלב 3%"`, `"חלב x2"` → `חלב`), so quantity variants share one DB entry.
- New names are sent to Groq in one batched request (up to 50 per call). Simultaneous requests for the same names share a single call.
- If Groq fails or hits a rate limit, the item is shown under "אחר" and retried a few seconds later. Nothing wrong is saved.
- Microsoft tokens live only on the server (Redis), never in the browser.

| Path | Purpose |
| --- | --- |
| `lib/classify.ts` | DB-first classification + Groq prompt |
| `lib/categories.ts` | Sections (names, emoji, default order) |
| `lib/graph.ts` | Microsoft To Do client |
| `lib/session.ts`, `lib/auth.ts` | Microsoft sign-in, sessions, token refresh |
| `app/api/*` | API routes used by the UI |
| `components/ShoppingList.tsx` | Main screen (optimistic updates + polling) |

## Scripts

```bash
npm test               # unit tests (vitest)
npm run typecheck
npm run lint
npm run try-classify   # sort a sample Hebrew list with the real Groq model
npm run icons          # regenerate PNG icons from public/icon.svg
```
