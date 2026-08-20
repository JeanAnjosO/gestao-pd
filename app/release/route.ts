declare const __APP_RELEASE__: string;

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ release: __APP_RELEASE__ }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
}
