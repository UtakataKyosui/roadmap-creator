export async function cloudflare(path, { method = "GET", body, allowMissing = false } = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required");
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
  if (allowMissing && response.status === 404) return undefined;
  const text = await response.text();
  if (response.ok && method === "DELETE" && !text) return null;
  const data = JSON.parse(text);
  // Never log upstream bodies: settings responses may contain secrets.
  if (!response.ok || !data.success)
    throw new Error(`Cloudflare ${method} failed (${response.status})`);
  return data.result;
}
