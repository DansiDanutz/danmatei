# app

## Overview

The Expo Router route tree. `_layout.tsx` sets up the global providers and a Stack without headers. `index.tsx` is the entry route: it sends the user to the tabs or to onboarding, depending on the Supabase session.

## Interface

- `RootLayout` (`_layout.tsx`, default export):
  - Wraps the app in `GestureHandlerRootView` > `SafeAreaProvider` > `QueryClientProvider`.
  - Inside the providers it renders `StatusBar` and `<Stack screenOptions={{ headerShown: false }} />`.
- `queryClient` (`_layout.tsx`, module level): `new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })`.
- `Index` (`index.tsx`, default export): the `/` route.
- Child route groups:
  - auth: [./auth/EGM.md](./auth/EGM.md) - `/auth/login`, `/auth/register`, `/auth/forgot-password`.
  - onboarding: [./onboarding/EGM.md](./onboarding/EGM.md) - `/onboarding`.
  - tabs: [./tabs/EGM.md](./tabs/EGM.md) - `/tabs/home`, `/tabs/chat`, `/tabs/profile`.
  - chat: [./chat/EGM.md](./chat/EGM.md) - `/chat/[id]`, the thread screen.

## Invariants

- `Index` shows an `ActivityIndicator` until `useSession().initialized` is true. After that it renders `<Redirect href={session ? "/tabs/home" : "/onboarding"} />`.
- `Index` is the only session gate. The tab screens have no auth guard of their own.
- `RootLayout` calls `useSession()`, but its `useEffect` on `initialized` only returns early. It does not gate rendering or hide a splash screen.
- `StatusBar` style is `"light"` when the color scheme is dark, otherwise `"dark"`.
- React Query queries retry once and do not refetch on window focus.

## Side Effects

- `_layout.tsx` imports `../global.css` and `react-native-url-polyfill/auto`, which patches `URL` globally.
- `RootLayout` and `Index` each call `useSession()`. Each call creates its own Supabase `getSession()` call and its own `onAuthStateChange` subscription, both of which update `useAuthStore`.
- `Index` navigates declaratively with `<Redirect>`.
- No app file calls the `SplashScreen` API. `app.json` configures the splash screen through the `expo-splash-screen` plugin only.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
