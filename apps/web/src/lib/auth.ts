import { accounts, db, sessions, users, verifications } from "@caduward/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: "reviewer",
    }),
  ],
  secret: process.env.CADUWARD_AUTH_SECRET,
  baseURL: process.env.CADUWARD_BASE_URL ?? "http://localhost:3000",
});
