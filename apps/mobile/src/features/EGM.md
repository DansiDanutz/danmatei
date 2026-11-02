# features

## Overview

Feature modules for the mobile app. Each subdirectory contains the services, schemas, hooks or static content for one domain. The route screens in `apps/mobile/app` consume them.

## Subdirectories & Boundaries

- auth: [./auth/EGM.md](./auth/EGM.md) - Supabase email/password wrappers (`authService`), zod form schemas with Romanian messages, and the `useSession` hook that syncs Supabase auth state into `useAuthStore`.
- chat: [./chat/EGM.md](./chat/EGM.md) - `chatService`: REST calls to `/api/chat/threads` and `/api/chat/threads/:id/messages` through `lib/api`, served by [api/chat](../../../../api/chat/EGM.md). It also has `markRead` (`POST /api/chat/threads/:id/read`).
- onboarding: [./onboarding/EGM.md](./onboarding/EGM.md) - static `onboardingSlides` content (3 slides).
- profile: [./profile/EGM.md](./profile/EGM.md) - `profileService`: `GET /api/profile` and `PUT /api/profile` through `lib/api`, served by `api/profile.ts`.
