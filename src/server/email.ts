import { brand } from "../lib/brand";
export const emailConfigured = Boolean(
  process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM,
);
export async function sendAccountEmail(
  to: string,
  subject: string,
  url: string,
) {
  if (!emailConfigured) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: `${brand.name}: ${subject}`,
      text: `${subject}\n\nOpen this secure link: ${url}\n\nIf you did not request this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error("The email provider did not accept the message.");
  const result = await response.json();
  if (!result.id)
    throw new Error("The email provider did not confirm the message.");
  return result.id as string;
}
