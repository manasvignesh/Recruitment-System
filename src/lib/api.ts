export async function api<T = any>(
  path: string,
  orgId?: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: {
      ...(orgId ? { "x-organization-id": orgId } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to complete the request.");
  return data;
}
export const date = (s: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(s).toLocaleDateString(
    "en-US",
    options || { month: "short", day: "numeric" },
  );
export const time = (s: string, tz?: string) =>
  new Date(s).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  });
export const days = (s: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86400000));
export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
