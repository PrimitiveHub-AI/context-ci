export const dynamic = "force-dynamic"

export function GET() {
  return Response.json({
    status: "ok",
    service: "primitivehub-web",
    version: process.env.npm_package_version ?? "unknown",
    timestamp: new Date().toISOString(),
  })
}
