const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Add it to your .env file (see .env.example).`,
    );
  }
  return value;
};

export const config = {
  supabaseUrl: required(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    "EXPO_PUBLIC_SUPABASE_URL",
  ),
  supabaseAnonKey: required(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ),
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://danmatei.example.com",
} as const;

export type AppConfig = typeof config;
