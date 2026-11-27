import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { MAX_PHOTO_BYTES, savePhoto, readPhoto } from "@/server/photos";
import { buyerAvailableRequests, collectionDetail, publicMapPoints } from "@/server/queries";
import { createCollection, joinCollection } from "@/server/collections";
import { createRequest } from "@/server/requests";
import { givePrice, makeUser, requestInput, resetDb, seedBasics } from "./helpers";

let cats: Awaited<ReturnType<typeof seedBasics>>;
beforeEach(async () => {
  await resetDb();
  cats = await seedBasics();
});

describe("приватность", () => {
  it("публичная карта не содержит адреса, телефона и точных координат", async () => {
    const r = await makeUser("RESIDENT");
    const req = await createRequest(r.id, requestInput(cats.pet.id, { address: "СЕКРЕТНЫЙ АДРЕС 77" }) as never);
    const pts = await publicMapPoints();
    expect(pts).toHaveLength(1);
    const json = JSON.stringify(pts);
    expect(json).not.toContain("СЕКРЕТНЫЙ");
    expect(json).not.toContain(r.phone);
    expect(json).not.toContain(req.lat);
    expect(Object.keys(pts[0])).not.toContain("address");
  });
  it("список доступных заявок для скупщика не раскрывает адрес, телефон и точные координаты", async () => {
    const r = await makeUser("RESIDENT");
    const b = await makeUser("BUYER");
    await givePrice(b.id, cats.pet.id);
    const req = await createRequest(r.id, requestInput(cats.pet.id, { address: "СЕКРЕТНЫЙ АДРЕС 77" }) as never);
    const list = await buyerAvailableRequests(b.id);
    const json = JSON.stringify(list);
    expect(json).not.toContain("СЕКРЕТНЫЙ");
    expect(json).not.toContain(r.phone);
    expect(json).not.toContain(req.lat);
  });
  it("в деталях коллективного сбора нет адресов и телефонов, имена сокращены", async () => {
    const a = await makeUser("RESIDENT");
    const col = await createCollection(a.id, { title: "Тест", categoryId: cats.pet.id, locality: "Кара-Суу", targetKg: "100" });
    const req = await createRequest(a.id, requestInput(cats.pet.id, { address: "СЕКРЕТНЫЙ АДРЕС 77", allowCollective: true }) as never);
    await joinCollection(a.id, col.id, req.id);
    const d = await collectionDetail(col.id);
    const json = JSON.stringify(d);
    expect(json).not.toContain("СЕКРЕТНЫЙ");
    expect(json).not.toContain(a.phone);
    expect(d!.members).toHaveLength(1);
  });
  it("после отмены заявка исчезает с публичной карты", async () => {
    const r = await makeUser("RESIDENT");
    const req = await createRequest(r.id, requestInput(cats.pet.id) as never);
    await db.update(schema.recyclingRequests).set({ status: "CANCELLED" }).where(and(eq(schema.recyclingRequests.id, req.id)));
    expect(await publicMapPoints()).toHaveLength(0);
  });
});

describe("загрузка файлов", () => {
  const file = (bytes: number[] | Buffer, type = "image/png", name = "a.png") => new File([new Uint8Array(bytes)], name, { type });
  it("принимает настоящее PNG-изображение", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const name = await savePhoto(file(png));
    expect(name).toMatch(/\.png$/);
    expect((await readPhoto(name))?.mime).toBe("image/png");
  });
  it("отклоняет исполняемый/текстовый файл с поддельным типом", async () => {
    await expect(savePhoto(file(Buffer.from("<script>alert(1)</script>"), "image/png", "x.png"))).rejects.toMatchObject({ code: "photo_type" });
  });
  it("отклоняет пустой и слишком большой файл", async () => {
    await expect(savePhoto(file([]))).rejects.toMatchObject({ code: "photo_empty" });
    const big = Buffer.alloc(MAX_PHOTO_BYTES + 1, 0xff);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    await expect(savePhoto(file(big, "image/jpeg", "b.jpg"))).rejects.toMatchObject({ code: "photo_too_large" });
  });
  it("не читает файлы по произвольному пути (path traversal)", async () => {
    expect(await readPhoto("../../etc/passwd")).toBeNull();
    expect(await readPhoto("..%2f..%2fetc%2fpasswd.png")).toBeNull();
  });
});
