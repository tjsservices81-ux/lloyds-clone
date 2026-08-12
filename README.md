# Lloyds Clone

This project is a clone of the Lloyds banking application, built using React Native and TypeScript. It includes various features such as authentication, creating a new payee, viewing account details, and making payments.

## Screenshots

|                                                                  |                                                               |                                                                           |
| :--------------------------------------------------------------: | :-----------------------------------------------------------: | :-----------------------------------------------------------------------: |
| ![Home-Everyday](./screenshots/home-everyday.png) Home(Everyday) | ![Home-summary](./screenshots/home-summary.png) Home(Summary) | ![Settings-Profile](./screenshots/settings-profile.png) Settings(Profile) |
|         ![Settings](./screenshots/settings.png) Settings         | ![Card Details](./screenshots/card-details.png) Card details  |             ![View Pin](./screenshots/view-pin.png) View pin              |
|   ![Revealed Pin](./screenshots/revealed-pin.png) Revealed pin   |         ![Payment](./screenshots/payment.png) Payment         |    ![Select Payee](./screenshots/selecting-payee.png) Selecting payee     |

More in the screenshot folder. [Screenshot](./screenshots/)

## Features

- Authentiication
- Create a new payee
- View account details
- Make payments
- Card management

## Technologies Used

- Expo
- Expo Router
- React Native
- TypeScript
- Nativewind
- React Hook Form
- Zod
- Tanstack Query
- Axios
- TabView

## Getting started

### Prerequisites

- Node.js
- pnpm
- Expo CLI
- [Lloyds API Clone](https://github.com/amilmohd155/lloyds-clone-api)

#### API Express Project

Check out this repo to run the express server. ([Express API](https://github.com/amilmohd155/lloyds-clone-api))

#### Environment Variables

To run this project, you will need to add the following environment variables to your .env file

`EXPO_PUBLIC_API_URL` - http://localhost:1205 / http://IP:1205 where the express app mentioned above is running, if port was changed, make appropriate changes.

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/lloyds-clone.git
   ```
2. Navigate to the project directory:
   ```sh
   cd lloyds-clone
   ```
3. Install dependencies:
   ```sh
   pnpm install
   ```

### Running the App

1. Start the Expo development server:

   ```sh
   pnpm start
   ```

2. Use the Expo app on your mobile device or an emulator to scan the QR code and run the application.

### Running in the browser

```sh
pnpm web
```

## Web build

The app runs as a single-page web app (`web.output` is `single` in `app.json`).
To produce a deployable build:

```sh
EXPO_PUBLIC_API_URL=https://your-api.example.com pnpm build:web
```

The static site is written to `dist/`. `EXPO_PUBLIC_API_URL` is inlined at
**build** time, so it has to be set before the export runs, not at serve time.

Because the server only ships one `index.html`, whatever hosts `dist/` must
rewrite unknown paths to `/index.html`, otherwise deep links such as
`/account/<id>` 404.

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

## Deploying to Render

`render.yaml` is a Render blueprint that publishes the app as a static site:
it installs with pnpm, runs `pnpm build:web`, serves `dist/`, and rewrites all
routes to `/index.html`.

1. In Render, create a new **Blueprint** from this repository.
2. Set `EXPO_PUBLIC_API_URL` when prompted (it is declared `sync: false`), e.g.
   `https://lloyds-clone-api.onrender.com` — no trailing slash and no `/api`
   suffix, the clients append that themselves.
3. Deploy.

The API must be reachable from the browser, which adds two requirements the
mobile app did not have:

- **HTTPS** — a page served over HTTPS cannot call an `http://` API; browsers
  block it as mixed content.
- **CORS** — the API has to allow the Render site's origin, since the requests
  are now cross-origin.

## Project Structure

- `src/`: Contains the source code of the application
  - `api/`: API calls and services
  - `components/`: Reusable UI components
  - `libs/`: Utility functions and libraries
  - `schema/`: Form validation schemas
  - `screens/`: Application screens
  - `app/`: Main application logic and routing
  - `web/`: Browser implementations of native-only modules

## License

This project is licensed under the MIT License.

[MIT](https://choosealicense.com/licenses/mit/)
