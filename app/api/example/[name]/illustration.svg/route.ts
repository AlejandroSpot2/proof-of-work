import { readIllustration } from "@/lib/fixtures/rin";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const svg = readIllustration(name);
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" } });
}
