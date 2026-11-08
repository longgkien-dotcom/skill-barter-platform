# SkillBarter on GitHub and Vercel

The frontend runs independently on Vercel. A reachable NestJS API is used when available; otherwise the browser supplies the full campus experience with persistent local data.

## Before pushing to GitHub

- Commit application source, `frontend/pnpm-lock.yaml`, `backend/pnpm-lock.yaml`, and sanitized `.env.example` templates.
- The root `.gitignore` excludes dependencies, build output, local environment files, and the two large design reference folders. Existing files already tracked by Git would need to be untracked separately; ignore rules do not remove Git history.
- Review `git status --short` before staging. Never commit database credentials, private keys, or local `.env` files.

## Vercel project settings

Import the GitHub repository into Vercel and use these settings:

| Setting                        | Value                                                    |
| ------------------------------ | -------------------------------------------------------- |
| Root Directory                 | `frontend`                                               |
| Framework Preset               | Next.js                                                  |
| Install Command                | Automatic, using the committed pnpm lockfile             |
| Build Command                  | `pnpm run build`                                         |
| Output Directory               | Framework default; leave the override disabled           |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` to honor the pinned `pnpm@10.34.3` in `package.json` |
| `NEXT_PUBLIC_API_URL`          | Leave unset for the standalone browser experience        |

The included `frontend/vercel.json` declares the framework and build command. Root Directory must still be selected in Vercel. Vercel deploys the frontend; this does not deploy NestJS or PostgreSQL.

For details, see [Vercel root directory settings](https://vercel.com/docs/builds/configure-a-build#root-directory) and [package manager selection](https://vercel.com/docs/package-managers).

## API selection and persistence

- The base URL is `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`.
- Local development probes NestJS at `localhost:3001`. With a reachable backend, all original routes and payloads continue to use NestJS.
- On a public hostname, a loopback backend URL immediately selects browser data. A friend's phone must never be asked to connect to its own `localhost`.
- A configured cloud API gets a short connectivity probe. Network failure/timeout selects browser data; HTTP validation, authorization, and server errors remain real errors and do not bypass the backend.
- Browser mode stays selected until reload, preventing account IDs and balances from being mixed between sources. Reload checks backend availability again. Browser changes are never uploaded to NestJS.
- Interrupted backend mutations are **not replayed** into browser data. Refresh before retrying an operation whose result is uncertain.
- Campus state uses `skillbarter.cloud-demo.v1` in localStorage: accounts, skills, Safe Zones, sessions, proof URLs, three-criteria reviews, Trust, disputes, votes, and the credit ledger. Existing account/session and online-room journals retain their separate storage keys.
- Each browser has its own independent state. Friends on different devices do not share sessions or balances. Clearing site storage resets that browser. If storage is unavailable or full, the workspace continues in memory and displays a warning that changes will not survive reload.

## Try the full campus flow

1. Open the deployed URL and choose a `.edu.vn` profile. Duy has ready-to-check-in and overdue sessions; Chi and An have a session in progress. Khuê is unverified and can claim the +1 Standard verification credit once.
2. Post a skill or create a Safe Zone. Book someone else's offered skill with three goals and a future time. Escrow deducts Standard first, then Premium.
3. In the participant account, use the Safe Zone QR to check in. Switch to the teacher account to submit a proof image URL and complete the session. Switch back to submit a three-criteria review.
4. Open a dispute on another escrowed/in-progress session. Switch between three eligible nonparticipant profiles with Trust ≥ 4.5 to vote; the third vote triggers payout or refund. The seeded dispute can be decided by Chi, Hà, and Linh.
5. Try cancelling a future appointment, reporting the seeded overdue session after the 15-minute grace period, Premium top-up, and voucher redemption. Reload to confirm persistence.

Top-ups and vouchers in browser mode use virtual credits. Profile selection/domain verification does not send email or provide production authentication. Existing online partner video/chat behavior remains local; this change does not add WebRTC or shared live messaging.

## Connect a cloud backend later

Set `NEXT_PUBLIC_API_URL` to a publicly reachable **HTTPS** NestJS URL in the Vercel project, configure that backend's CORS for your Vercel/custom domain, and redeploy. Do not place credentials in this variable: `NEXT_PUBLIC_` values are included in browser bundles at build time. See [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Next.js environment variable behavior](https://nextjs.org/docs/app/guides/environment-variables).

## Local verification

```powershell
pnpm --dir frontend run lint
node frontend/scripts/verify-cloud-fallback.mjs
pnpm --dir frontend run build
```

On Windows PowerShell with script execution restrictions, use `pnpm.cmd` in place of `pnpm`. The verification script uses isolated in-memory storage and mocked network responses; it never changes the backend database or starts a dev server.
