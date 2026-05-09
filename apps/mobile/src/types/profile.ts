export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: "parent" | "trainer" | "admin" | "player";
  avatarUrl: string | null;
  createdAt: string;
};
