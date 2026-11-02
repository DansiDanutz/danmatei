import { api } from "@/lib/api";
import type { Profile } from "@/types/profile";

export const profileService = {
  me: () => api.get<Profile>("/api/profile"),
  update: (input: { fullName: string }) =>
    api.put<Profile>("/api/profile", input),
};
