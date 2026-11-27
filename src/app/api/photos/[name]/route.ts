import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { readPhoto } from "@/server/photos";
import { getCurrentUser } from "@/server/session";

/** Фото заявки видят только владелец, назначенный скупщик и администратор. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { name } = await params;
  const [row] = await db
    .select({ residentId: schema.recyclingRequests.residentId, buyerId: schema.recyclingRequests.buyerId })
    .from(schema.requestPhotos)
    .innerJoin(schema.recyclingRequests, eq(schema.recyclingRequests.id, schema.requestPhotos.requestId))
    .where(eq(schema.requestPhotos.url, name));
  const allowed = row && (user.role === "ADMIN" || row.residentId === user.id || row.buyerId === user.id);
  if (!allowed) return new Response("Not found", { status: 404 });
  const file = await readPhoto(name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "Content-Type": file.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
