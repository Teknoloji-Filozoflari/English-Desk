export function createRequestPolicy(origins) {
  if (!Array.isArray(origins) || !origins.length)
    throw Error("En az bir uygulama adresi gerekli.");
  const allowed = origins.map((value) => {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw Error("Uygulama adresi yalnızca HTTP/HTTPS origin olmalı.");
    return url.origin;
  });
  const hosts = new Set(allowed.map((value) => new URL(value).host));
  return (req) =>
    hosts.has(req.headers.host) &&
    (!req.headers.origin ||
      (allowed.includes(req.headers.origin) &&
        new URL(req.headers.origin).host === req.headers.host));
}
export function serverConfig(env = process.env) {
  const port = Number(env.ENGLISH_DESK_LISTEN_PORT ?? 8081);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Sunucu portu geçersiz.");
  const bind = env.ENGLISH_DESK_BIND_ADDRESS ?? "127.0.0.1";
  const origins = (
    env.ENGLISH_DESK_PUBLIC_ORIGINS ?? `http://127.0.0.1:${port}`
  )
    .split(",")
    .map((value) => value.trim());
  createRequestPolicy(origins);
  return { port, bind, origins };
}
