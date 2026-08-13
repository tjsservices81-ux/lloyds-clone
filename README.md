# Lloyds Clone

This project is a clone of the Lloyds banking application. The UI is built with
Expo / React Native (and runs on the web via React Native Web); it is backed by
its own **Node + Express + PostgreSQL** API in this same repository. All banking
data is **simulated** — no real bank, no real money.

> This is a training/simulation app. Everything is fake data.

## Screenshots

|                                                                  |                                                               |                                                                           |
| :--------------------------------------------------------------: | :-----------------------------------------------------------: | :-----------------------------------------------------------------------: |
| ![Home-Everyday](./screenshots/home-everyday.png) Home(Everyday) | ![Home-summary](./screenshots/home-summary.png) Home(Summary) | ![Settings-Profile](./screenshots/settings-profile.png) Settings(Profile) |
|         ![Settings](./screenshots/settings.png) Settings         | ![Card Details](./screenshots/card-details.png) Card details  |             ![View Pin](./screenshots/view-pin.png) View pin              |
|   ![Revealed Pin](./screenshots/revealed-pin.png) Revealed pin   |         ![Payment](./screenshots/payment.png) Payment         |    ![Select Payee](./screenshots/selecting-payee.png) Selecting payee     |

More in the screenshot folder. [Screenshot](./screenshots/)

## Features

- Authentication (JWT access + refresh tokens)
- Real account balances stored in PostgreSQL
- Sending money that actually moves the balance
- Create / list / delete payees
- Card management
- In-app support chat (Claude-powered, with a scripted fallback)
- Staff admin dashboard: create customers, generate one-time invite links
- One-time invite links and an access-code gate

## Architecture

One repository, two halves, plus a shared database schema — the same
single-service model the app deploys as:

- `src/` — the Expo / React Native (Web) client
- `server/` — the Express API and server-rendered admin pages
- `shared/schema.ts` — the Drizzle ORM database schema used by the server

In production, **one** Express process serves both the built web client and the
`/api` on a single port. The client is same-origin, so it calls `/api` directly.

### Technologies

- **Client:** Expo, Expo Router, React Native / React Native Web, TypeScript,
  NativeWind, React Hook Form, Zod, TanStack Query, Axios
- **Server:** Node, Express, PostgreSQL, Drizzle ORM, JSON Web Tokens, bcrypt

## Getting started

### Prerequisites

- Node.js 20+ and pnpm
- A PostgreSQL database (local, Render, or Neon — the server auto-detects the
  driver)

### 1. Install and configure

```sh
pnpm install
cp .env.example .env          # then set DATABASE_URL (and JWT_SECRET)
```

### 2. Create the tables and seed demo data

```sh
pnpm db:push                  # create the tables from shared/schema.ts
pnpm db:seed                  # optional; the server also seeds on first start
```

The seed creates a demo login:

| User ID     | Password   |
| ----------- | ---------- |
| `docren155` | `password` |

### 3. Run it

The simplest way (mirrors production): build the web client, then start the
server, which serves both the client and the API on one port.

```sh
pnpm build:web                # writes the web client to dist/
pnpm dev:server               # API + client on http://localhost:5000
```

Open http://localhost:5000 and log in with the demo credentials.

For native development, `pnpm start` (Expo) still works; point
`EXPO_PUBLIC_API_URL` at your running server.

### Staff dashboard

Visit `/admin-oversight` and enter `ADMIN_PIN` (default `246810`) to create
customers and generate invite links.

## Web build

The client is a single-page web app (`web.output` is `single` in `app.json`).
`pnpm build:web` writes it to `dist/`, and the Express server serves that folder
with an SPA fallback (so deep links such as `/account/<id>` resolve). For a
same-origin deploy, `EXPO_PUBLIC_API_URL` is left empty so the client calls
`/api` on its own host; it is inlined at **build** time, not read at runtime.

### Web-specific implementations

Some native modules have no browser build, so the web bundle substitutes them:

| Native module                                       | Web replacement                        |
| --------------------------------------------------- | -------------------------------------- |
| `react-native-pager-view`                           | `src/web/pager-view.tsx`               |
| `@react-native-segmented-control/segmented-control` | `src/web/segmented-control.tsx`        |
| `@react-native-community/datetimepicker`            | `src/components/ui/DateTimePicker.web.tsx` (`<input type="date">`) |
| `expo-secure-store`                                 | `src/store/storage.web.ts` (`localStorage`) |

The first two are swapped by a `resolveRequest` alias in `metro.config.js`; the
others resolve through metro's `.web` file extension. Native builds are
unaffected and keep using the original modules.

Note that persisted auth tokens live in `localStorage` on web — the browser has
no secure-storage equivalent of the iOS keychain / Android keystore.

## Environment variables

| Name                 | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`       | **Required.** PostgreSQL connection string. The app won't start without it. |
| `JWT_SECRET`         | Signs access tokens. Required in production; a dev fallback is used locally. |
| `APP_ACCESS_CODE`    | Code for the access gate (`/api/check-access`). Default `LLOYDS777777`.   |
| `ADMIN_PIN`          | PIN for the `/admin-oversight` staff dashboard. Default `246810`.         |
| `ANTHROPIC_API_KEY`  | Optional. Enables the Claude-powered chat; scripted replies without it.   |
| `ANTHROPIC_MODEL`    | Optional. Chat model id (default `claude-sonnet-5`).                       |
| `EXPO_PUBLIC_API_URL`| Client → API base URL. Empty for a same-origin deploy. Baked in at build. |
| `PORT`               | Port the server listens on (the host usually sets this).                  |

## Deploying to Render

`render.yaml` is a Render blueprint describing **one web service + a managed
PostgreSQL database**. The web service builds the client, bundles the server,
pushes the schema, and serves everything on one port.

1. In Render, create a new **Blueprint** from this repository.
2. When prompted, set `APP_ACCESS_CODE` and `ADMIN_PIN` (and optionally
   `ANTHROPIC_API_KEY`). `DATABASE_URL` and `JWT_SECRET` are wired up
   automatically by the blueprint.
3. Deploy. On first boot the server seeds the demo customer.

Notes:

- The bundled free PostgreSQL plan expires after ~30 days — switch the database
  to a paid plan for anything long-lived.
- Because the client and API are the same origin, there is **no CORS or mixed
  content** to configure.

## Project Structure

- `src/`: the client
  - `api/`: HTTP clients and API calls
  - `components/`: reusable UI components
  - `libs/`: utilities
  - `schema/`: form + response validation schemas (Zod)
  - `screens/`: application screens
  - `app/`: routing (Expo Router)
  - `web/`: browser implementations of native-only modules
- `server/`: the Express API
  - `routes/`: session, users, accounts, transactions, chat, admin, invite, access
  - `db.ts`, `auth.ts`, `seed.ts`, `serializers.ts`, `index.ts`
- `shared/schema.ts`: the Drizzle database schema

## License

This project is licensed under the MIT License.

[MIT](https://choosealicense.com/licenses/mit/)
