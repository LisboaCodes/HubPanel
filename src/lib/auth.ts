import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { PgAdapter } from "./auth-adapter";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

const fromEmail =
  process.env.EMAIL_FROM || "HubPanel <onboarding@resend.dev>";

/**
 * Comma-separated list of emails that are allowed to sign in.
 * If empty or not set, all emails are allowed.
 */
function getAuthorizedEmails(): string[] {
  const raw = process.env.AUTHORIZED_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  adapter: PgAdapter(),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    EmailProvider({
      from: fromEmail,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        try {
          const result = await getResend().emails.send({
            from: fromEmail,
            to: email,
            subject: "Sign in to HubPanel",
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #111;">Sign in to HubPanel</h2>
                <p style="color: #555; line-height: 1.6;">
                  Click the button below to sign in to your HubPanel dashboard. This link is valid for 24 hours.
                </p>
                <a
                  href="${url}"
                  style="
                    display: inline-block;
                    padding: 12px 24px;
                    background: #2563eb;
                    color: #fff;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 16px 0;
                  "
                >
                  Sign in to HubPanel
                </a>
                <p style="color: #999; font-size: 13px;">
                  If you did not request this email, you can safely ignore it.
                </p>
              </div>
            `,
          });

          if (result.error) {
            console.error("[auth] Resend error:", result.error);
            throw new Error(
              `Failed to send verification email: ${result.error.message}`
            );
          }
        } catch (error) {
          console.error("[auth] sendVerificationRequest failed:", error);
          throw error;
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    /**
     * Only allow sign-in if the user's email is in the authorized list.
     * If no authorized list is configured, allow everyone.
     */
    async signIn({ user }) {
      const authorized = getAuthorizedEmails();
      if (authorized.length === 0) {
        return true;
      }
      const email = user.email?.toLowerCase() ?? "";
      if (authorized.includes(email)) {
        return true;
      }
      return false;
    },

    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? null;
      }
      return session;
    },
  },
};
