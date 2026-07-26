# Dependency audit boundary

Run `pnpm audit:production` as a blocking release gate for every production
workspace. It rejects every critical or high advisory in the root web/API graph
and the Expo mobile graph. Vercel runs this gate before its web build, and mobile
releases must run the same command before an EAS build.

The mobile workspace targets Expo SDK 57 with React Native 0.86 and the New
Architecture. After changing any Expo or React Native package, run Expo's
compatibility resolver and `expo-doctor` before producing a device build.
