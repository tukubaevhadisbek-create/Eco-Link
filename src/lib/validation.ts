import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^\+996\d{9}$/.test(v), { message: "phone_invalid" });

export const LOCALITIES = [
  "Кара-Суу",
  "Ош",
  "Ноокат",
  "Араван",
  "Узген",
  "Кара-Кульджа",
  "Алай",
  "Чон-Алай",
  "Папан",
  "Дароот-Коргон",
] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2, "name_short").max(120),
  phone: phoneSchema,
  password: z
    .string()
    .min(8, "password_short")
    .max(128)
    .refine((v) => /[A-Za-zА-Яа-я]/.test(v) && /\d/.test(v), { message: "password_weak" }),
  locality: z.string().trim().min(2, "locality_required").max(120),
  role: z.enum(["RESIDENT", "BUYER"]),
  consent: z.literal(true, { error: "consent_required" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(128),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  locality: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  language: z.enum(["ru", "kg", "en"]),
});

const decimalStr = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(",", "."))
    .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), { message: "number_invalid" })
    .refine((v) => Number(v) >= min && Number(v) <= max, { message: "number_range" });

export const requestSchema = z.object({
  categoryId: z.uuid(),
  materialType: z.string().trim().max(120).optional().or(z.literal("")),
  approxWeightKg: decimalStr(0.1, 50000),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  locality: z.string().trim().min(2).max(120),
  address: z.string().trim().min(3, "address_required").max(300),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  pickupDate: z.string().optional().or(z.literal("")),
  timeFrom: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  timeTo: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  desiredPricePerKg: z.union([z.string(), z.number()]).optional(),
  allowCollective: z.boolean().default(false),
});
export type RequestInput = z.infer<typeof requestSchema>;

export const weightSchema = decimalStr(0.1, 50000);

export const priceSchema = z.object({
  categoryId: z.uuid(),
  pricePerKg: decimalStr(0, 100000),
  minVolumeKg: decimalStr(0, 50000),
  terms: z.string().trim().max(500).optional().or(z.literal("")),
});

export const collectionSchema = z.object({
  title: z.string().trim().min(3).max(200),
  categoryId: z.uuid(),
  locality: z.string().trim().min(2).max(120),
  targetKg: decimalStr(1, 100000),
  plannedDate: z.string().optional().or(z.literal("")),
});
