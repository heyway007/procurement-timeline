export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: "USER" | "ADMIN";
};

export type AuthIdentity = {
  provider: string;
  externalUserId: string;
  email: string;
  displayName: string;
};
