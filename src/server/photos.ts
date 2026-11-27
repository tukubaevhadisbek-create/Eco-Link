import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ServiceError } from "./errors";

export const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTOS = 3;

const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

/** Проверяется содержимое файла (magic bytes), а не заявленный клиентом тип. */
export async function savePhoto(file: File): Promise<string> {
  if (file.size === 0) throw new ServiceError("photo_empty");
  if (file.size > MAX_PHOTO_BYTES) throw new ServiceError("photo_too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  const sig = SIGNATURES.find((s) => s.test(buf));
  if (!sig) throw new ServiceError("photo_type");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}.${sig.ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buf, { flag: "wx" });
  return name;
}

export async function readPhoto(name: string) {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(name)) return null;
  try {
    const data = await readFile(path.join(UPLOAD_DIR, name));
    const mime = SIGNATURES.find((s) => s.ext === name.split(".")[1])!.mime;
    return { data, mime };
  } catch {
    return null;
  }
}
