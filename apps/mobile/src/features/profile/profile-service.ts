import { api } from "@/lib/api";
import type { Profile } from "@/types/profile";

export const profileService = {
  me: () => api.get<Profile>("/api/profile"),
  update: (input: Partial<Profile>) => api.put<Profile>("/api/profile", input),
};
