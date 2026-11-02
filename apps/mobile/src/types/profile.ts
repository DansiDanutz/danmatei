export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: "owner" | "super_admin" | "trainer" | "parent";
  createdAt: string;
};
