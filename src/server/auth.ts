import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";
import { brand } from "../lib/brand";
import { emailConfigured, sendAccountEmail } from "./email";
export const auth = betterAuth({
  appName: brand.name,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: emailConfigured,
    revokeSessionsOnPasswordReset: true,
    ...(emailConfigured
      ? {
          sendResetPassword: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            await sendAccountEmail(user.email, "Reset your password", url);
          },
        }
      : {}),
  },
  ...(emailConfigured
    ? {
        emailVerification: {
          sendOnSignUp: true,
          sendVerificationEmail: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            await sendAccountEmail(
              user.email,
              "Verify your email address",
              url,
            );
          },
        },
      }
    : {}),
  advanced: { database: { generateId: () => crypto.randomUUID() } },
  rateLimit: { enabled: true, window: 60, max: 30, storage: "database" },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
});
