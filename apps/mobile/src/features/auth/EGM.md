# features/auth

## Overview

Email/password authentication for the mobile app. This package wraps Supabase Auth calls, defines the zod form schemas used by the `app/auth` screens (validation messages are in Romanian), and provides a `useSession` hook that copies Supabase auth state into the Zustand auth store.

## Interface

- `authService` (`auth-service.ts`)
  - `signIn(email, password)`: calls `supabase.auth.signInWithPassword` and returns its `data`.
  - `signUp(email, password)`: calls `supabase.auth.signUp` and returns its `data`.
  - `signOut(): Promise<void>`
  - `resetPassword(email): Promise<void>`: calls `supabase.auth.resetPasswordForEmail`. On web it passes `redirectTo` `${window.location.origin}/auth/reset-password`; on native it passes none.
  - `hasSession(): Promise<boolean>`: whether `supabase.auth.getSession()` returns a session. On web it returns false when the URL carries an `error` (see `hasRecoveryLinkError` in `recovery-url.ts`), so a stored session of another account is never used.
  - `updatePassword(password): Promise<void>`: calls `supabase.auth.updateUser({ password })`.
- Schemas (`schemas.ts`)
  - `emailSchema`: `z.string().trim().email("Adresă de email invalidă")`
  - `passwordSchema`: `z.string().min(8, "Parola trebuie să aibă cel puțin 8 caractere")`
  - `loginSchema`: `{ email, password }`
  - `registerSchema`: `{ email, password, confirmPassword }`, with a `.refine` check that the two passwords match
  - `forgotPasswordSchema`: `{ email }`
  - `resetPasswordSchema`: `{ password, confirmPassword }`, with the same match check as `registerSchema`
  - Types `LoginInput`, `RegisterInput`, `ForgotPasswordInput` and `ResetPasswordInput`, all from `z.infer`
- `useSession()` (`use-session.ts`): returns `{ session, user, initialized }` read from `useAuthStore`.

## Invariants

- Every `authService` method rethrows the Supabase `error` as-is when one is returned. Errors are not wrapped.
- `emailSchema` trims the input before it checks the email format.
- Passwords need at least 8 characters. There is no maximum length and no complexity rule. `confirmPassword` must also meet the 8-character minimum.
- `registerSchema` requires `password === confirmPassword`. A mismatch is reported on `confirmPassword` with the message "Parolele nu coincid".
- `useSession` sets `initialized` to true only after the first `getSession()` call resolves, and only while the component is still mounted. A local `mounted` flag tracks this; the hook does not use `hooks/useMounted`.
- Each component that calls `useSession` runs its own `getSession()` call and opens its own `onAuthStateChange` subscription. Both `app/_layout.tsx` and `app/index.tsx` call it.

## Side Effects

- `authService` sends network calls to Supabase Auth: sign in, sign up, sign out and the password-reset email. The client in `lib/supabase` persists the session in AsyncStorage.
- `useSession`, in a `useEffect`:
  - calls `supabase.auth.getSession()`, then `setSession` and `setInitialized(true)`;
  - subscribes with `supabase.auth.onAuthStateChange` and calls `setSession` on every auth event;
  - unsubscribes on unmount.

## Verification

- Run: `pnpm --filter @danmatei/mobile check`
