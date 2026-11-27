import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["RESIDENT", "BUYER", "ADMIN"]);
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "BLOCKED"]);
export const requestStatusEnum = pgEnum("request_status", [
  "DRAFT",
  "AVAILABLE",
  "RESERVED",
  "PICKUP_PENDING",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);
export const collectionStatusEnum = pgEnum("collection_status", [
  "OPEN",
  "TARGET_REACHED",
  "ASSIGNED",
  "PICKUP_PENDING",
  "COMPLETED",
  "CANCELLED",
]);
export const pickupStatusEnum = pgEnum("pickup_status", [
  "SCHEDULED",
  "AWAITING_CONFIRMATION",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);
export const confirmationStatusEnum = pgEnum("confirmation_status", [
  "PENDING",
  "CONFIRMED",
  "EXPIRED",
  "DISPUTED",
]);
export const walletTxTypeEnum = pgEnum("wallet_tx_type", ["EARN", "SPEND", "ADJUST"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIAL",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
]);
export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "RESOLVED_ACCEPT_BUYER",
  "RESOLVED_ACCEPT_RESIDENT",
  "REJECTED",
]);
export const reviewStatusEnum = pgEnum("review_status", ["VISIBLE", "FLAGGED", "HIDDEN"]);
export const orgTypeEnum = pgEnum("org_type", [
  "SCHOOL",
  "SHOP",
  "ENTERPRISE",
  "AIYL_OKMOTU",
  "NGO",
]);
export const routeStatusEnum = pgEnum("route_status", ["PLANNED", "IN_PROGRESS", "DONE", "CANCELLED"]);

/* ------------------------------------------------------------------ */
/* Users, sessions, security                                           */
/* ------------------------------------------------------------------ */

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    type: orgTypeEnum("type").notNull(),
    locality: varchar("locality", { length: 120 }).notNull(),
    responsibleUserId: uuid("responsible_user_id"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("organizations_locality_idx").on(t.locality)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: varchar("phone", { length: 16 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    locality: varchar("locality", { length: 120 }).notNull(),
    language: varchar("language", { length: 2 }).notNull().default("ru"),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_phone_unique").on(t.phone),
    index("users_role_idx").on(t.role),
    index("users_locality_idx").on(t.locality),
    check("users_phone_format", sql`${t.phone} ~ '^\\+996[0-9]{9}$'`),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  address: varchar("address", { length: 300 }),
  about: text("about"),
});

/** Серверные сессии: в БД хранится только SHA-256 токена. */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    csrfToken: varchar("csrf_token", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Защита от перебора пароля: ключ = телефон или IP. */
export const loginAttempts = pgTable("login_attempts", {
  key: varchar("key", { length: 120 }).primaryKey(),
  failures: integer("failures").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Демонстрационный механизм восстановления доступа (без SMS). */
export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Buyers                                                              */
/* ------------------------------------------------------------------ */

export const buyerProfiles = pgTable(
  "buyer_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    orgName: varchar("org_name", { length: 200 }),
    contactPhone: varchar("contact_phone", { length: 16 }),
    description: text("description"),
    minBatchKg: numeric("min_batch_kg", { precision: 10, scale: 3 }).notNull().default("0"),
    verified: boolean("verified").notNull().default(false),
  },
  (t) => [check("buyer_min_batch_nonneg", sql`${t.minBatchKg} >= 0`)],
);

export const buyerServiceAreas = pgTable(
  "buyer_service_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locality: varchar("locality", { length: 120 }).notNull(),
  },
  (t) => [uniqueIndex("buyer_area_unique").on(t.buyerId, t.locality)],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    capacityKg: numeric("capacity_kg", { precision: 10, scale: 3 }).notNull(),
  },
  (t) => [
    index("vehicles_buyer_idx").on(t.buyerId),
    check("vehicle_capacity_pos", sql`${t.capacityKg} > 0`),
  ],
);

export const materialCategories = pgTable(
  "material_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull(),
    nameRu: varchar("name_ru", { length: 120 }).notNull(),
    nameKg: varchar("name_kg", { length: 120 }).notNull(),
    nameEn: varchar("name_en", { length: 120 }).notNull(),
    /** Оценочный коэффициент, кг CO2-экв. на 1 кг (источник см. docs/CO2.md). */
    co2PerKg: numeric("co2_per_kg", { precision: 8, scale: 4 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("material_categories_code_unique").on(t.code),
    check("category_co2_nonneg", sql`${t.co2PerKg} >= 0`),
  ],
);

export const buyerPrices = pgTable(
  "buyer_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => materialCategories.id),
    pricePerKg: numeric("price_per_kg", { precision: 12, scale: 2 }).notNull(),
    minVolumeKg: numeric("min_volume_kg", { precision: 10, scale: 3 }).notNull().default("0"),
    terms: text("terms"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("buyer_price_unique").on(t.buyerId, t.categoryId),
    index("buyer_prices_category_idx").on(t.categoryId),
    check("buyer_price_nonneg", sql`${t.pricePerKg} >= 0`),
    check("buyer_price_minvol_nonneg", sql`${t.minVolumeKg} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Requests and collective collections                                 */
/* ------------------------------------------------------------------ */

export const collectiveCollections = pgTable(
  "collective_collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => materialCategories.id),
    locality: varchar("locality", { length: 120 }).notNull(),
    targetKg: numeric("target_kg", { precision: 10, scale: 3 }).notNull(),
    plannedDate: timestamp("planned_date", { withTimezone: true }),
    status: collectionStatusEnum("status").notNull().default("OPEN"),
    buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("collections_status_idx").on(t.status),
    index("collections_locality_category_idx").on(t.locality, t.categoryId),
    check("collection_target_pos", sql`${t.targetKg} > 0`),
  ],
);

export const recyclingRequests = pgTable(
  "recycling_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => users.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => materialCategories.id),
    materialType: varchar("material_type", { length: 120 }),
    approxWeightKg: numeric("approx_weight_kg", { precision: 10, scale: 3 }).notNull(),
    actualWeightKg: numeric("actual_weight_kg", { precision: 10, scale: 3 }),
    description: text("description"),
    locality: varchar("locality", { length: 120 }).notNull(),
    address: varchar("address", { length: 300 }).notNull(),
    /** Точные координаты: видны только владельцу и назначенному скупщику. */
    lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
    lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
    /** Публичные приблизительные координаты (округление + смещение). */
    publicLat: numeric("public_lat", { precision: 9, scale: 6 }).notNull(),
    publicLng: numeric("public_lng", { precision: 9, scale: 6 }).notNull(),
    pickupDate: timestamp("pickup_date", { withTimezone: true }),
    timeFrom: varchar("time_from", { length: 5 }),
    timeTo: varchar("time_to", { length: 5 }),
    desiredPricePerKg: numeric("desired_price_per_kg", { precision: 12, scale: 2 }),
    agreedPricePerKg: numeric("agreed_price_per_kg", { precision: 12, scale: 2 }),
    allowCollective: boolean("allow_collective").notNull().default(false),
    status: requestStatusEnum("status").notNull().default("AVAILABLE"),
    buyerId: uuid("buyer_id").references(() => users.id, { onDelete: "set null" }),
    collectionId: uuid("collection_id").references(() => collectiveCollections.id, {
      onDelete: "set null",
    }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("requests_status_idx").on(t.status),
    index("requests_resident_idx").on(t.residentId),
    index("requests_buyer_idx").on(t.buyerId),
    index("requests_collection_idx").on(t.collectionId),
    index("requests_locality_category_idx").on(t.locality, t.categoryId),
    check("request_weight_pos", sql`${t.approxWeightKg} > 0`),
    check("request_actual_weight_pos", sql`${t.actualWeightKg} IS NULL OR ${t.actualWeightKg} > 0`),
    check("request_lat_range", sql`${t.lat} BETWEEN -90 AND 90 AND ${t.lng} BETWEEN -180 AND 180`),
    check(
      "request_reserved_has_buyer",
      sql`${t.status} NOT IN ('RESERVED','PICKUP_PENDING') OR ${t.buyerId} IS NOT NULL`,
    ),
  ],
);

export const requestPhotos = pgTable(
  "request_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => recyclingRequests.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("request_photos_request_idx").on(t.requestId)],
);

export const collectiveMemberships = pgTable(
  "collective_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectiveCollections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").references(() => recyclingRequests.id, {
      onDelete: "set null",
    }),
    /** Заявленный вес участника (если взнос без заявки). */
    declaredKg: numeric("declared_kg", { precision: 10, scale: 3 }).notNull().default("0"),
    actualKg: numeric("actual_kg", { precision: 10, scale: 3 }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("membership_collection_user_unique").on(t.collectionId, t.userId),
    uniqueIndex("membership_request_unique").on(t.requestId),
    index("membership_user_idx").on(t.userId),
    check("membership_declared_nonneg", sql`${t.declaredKg} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Pickups and confirmations                                           */
/* ------------------------------------------------------------------ */

export const pickups = pgTable(
  "pickups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => recyclingRequests.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => users.id),
    collectionId: uuid("collection_id").references(() => collectiveCollections.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: pickupStatusEnum("status").notNull().default("SCHEDULED"),
    pricePerKg: numeric("price_per_kg", { precision: 12, scale: 2 }),
    /** Вес, внесённый скупщиком (до подтверждения жителем). */
    reportedWeightKg: numeric("reported_weight_kg", { precision: 10, scale: 3 }),
    actualWeightKg: numeric("actual_weight_kg", { precision: 10, scale: 3 }),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Одна заявка — один забор: страховка от двойного принятия на уровне БД.
    // Отменённые заборы не учитываются: после спора заявку можно принять заново.
    uniqueIndex("pickups_request_active_unique").on(t.requestId).where(sql`${t.status} <> 'CANCELLED'`),
    index("pickups_request_idx").on(t.requestId),
    index("pickups_buyer_status_idx").on(t.buyerId, t.status),
    index("pickups_resident_idx").on(t.residentId),
    check("pickup_weight_pos", sql`${t.actualWeightKg} IS NULL OR ${t.actualWeightKg} > 0`),
    check("pickup_amount_nonneg", sql`${t.totalAmount} IS NULL OR ${t.totalAmount} >= 0`),
  ],
);

export const pickupConfirmations = pgTable(
  "pickup_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pickupId: uuid("pickup_id")
      .notNull()
      .references(() => pickups.id, { onDelete: "cascade" }),
    /** SHA-256 одноразового PIN. Сам PIN в БД не хранится. */
    pinHash: varchar("pin_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    status: confirmationStatusEnum("status").notNull().default("PENDING"),
    actualWeightKg: numeric("actual_weight_kg", { precision: 10, scale: 3 }).notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("confirmations_pickup_idx").on(t.pickupId),
    // Одновременно может быть только один активный PIN на забор.
    uniqueIndex("confirmations_one_pending")
      .on(t.pickupId)
      .where(sql`${t.status} = 'PENDING'`),
    check("confirmation_weight_pos", sql`${t.actualWeightKg} > 0`),
    check("confirmation_amount_nonneg", sql`${t.totalAmount} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

export const routePlans = pgTable(
  "route_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    plannedDate: timestamp("planned_date", { withTimezone: true }).notNull(),
    status: routeStatusEnum("status").notNull().default("PLANNED"),
    note: text("note"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routes_buyer_idx").on(t.buyerId)],
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => routePlans.id, { onDelete: "cascade" }),
    requestId: uuid("request_id")
      .notNull()
      .references(() => recyclingRequests.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
  },
  (t) => [
    uniqueIndex("route_stop_seq_unique").on(t.routeId, t.seq),
    uniqueIndex("route_stop_request_unique").on(t.routeId, t.requestId),
  ],
);

/* ------------------------------------------------------------------ */
/* EcoWallet                                                           */
/* ------------------------------------------------------------------ */

export const wallets = pgTable(
  "wallets",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("wallet_balance_nonneg", sql`${t.balance} >= 0`)],
);

export const bonusRules = pgTable(
  "bonus_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 40 }).notNull(),
    nameRu: varchar("name_ru", { length: 160 }).notNull(),
    nameKg: varchar("name_kg", { length: 160 }).notNull(),
    /** EcoCoins за 1 кг подтверждённого веса. */
    coinsPerKg: numeric("coins_per_kg", { precision: 8, scale: 3 }).notNull().default("0"),
    /** Фиксированный бонус за завершённую операцию. */
    flatBonus: integer("flat_bonus").notNull().default(0),
    /** Дополнительный бонус за участие в коллективном сборе. */
    collectiveBonus: integer("collective_bonus").notNull().default(0),
    categoryId: uuid("category_id").references(() => materialCategories.id, {
      onDelete: "cascade",
    }),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("bonus_rules_code_unique").on(t.code),
    check(
      "bonus_nonneg",
      sql`${t.coinsPerKg} >= 0 AND ${t.flatBonus} >= 0 AND ${t.collectiveBonus} >= 0`,
    ),
  ],
);

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => wallets.userId, { onDelete: "cascade" }),
    type: walletTxTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    reason: varchar("reason", { length: 40 }).notNull(),
    pickupId: uuid("pickup_id").references(() => pickups.id, { onDelete: "set null" }),
    note: text("note"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wallet_tx_user_idx").on(t.userId, t.createdAt),
    // Защита от двойного начисления: одна причина на одну операцию и пользователя.
    uniqueIndex("wallet_tx_once_per_pickup")
      .on(t.pickupId, t.userId, t.reason)
      .where(sql`${t.pickupId} IS NOT NULL`),
    check("wallet_tx_amount_nonzero", sql`${t.amount} <> 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull(),
    priceUsd: numeric("price_usd", { precision: 8, scale: 2 }).notNull().default("10.00"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isTrial: boolean("is_trial").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_buyer_idx").on(t.buyerId),
    check("subscription_period", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const subscriptionEvents = pgTable(
  "subscription_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    amountUsd: numeric("amount_usd", { precision: 8, scale: 2 }),
    /** Реальных платежей в MVP нет: все транзакции демонстрационные. */
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscription_events_sub_idx").on(t.subscriptionId)],
);

/* ------------------------------------------------------------------ */
/* Notifications, reviews, disputes, audit, settings                   */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Ключ для локализации, напр. "request_accepted". */
    type: varchar("type", { length: 60 }).notNull(),
    params: jsonb("params").$type<Record<string, string | number>>().notNull().default({}),
    link: varchar("link", { length: 300 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pickupId: uuid("pickup_id")
      .notNull()
      .references(() => pickups.id, { onDelete: "cascade" }),
    residentId: uuid("resident_id")
      .notNull()
      .references(() => users.id),
    buyerId: uuid("buyer_id")
      .notNull()
      .references(() => users.id),
    rating: integer("rating").notNull(),
    text: text("text"),
    status: reviewStatusEnum("status").notNull().default("VISIBLE"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("review_pickup_unique").on(t.pickupId),
    index("reviews_buyer_idx").on(t.buyerId),
    check("review_rating_range", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pickupId: uuid("pickup_id")
      .notNull()
      .references(() => pickups.id, { onDelete: "cascade" }),
    openedById: uuid("opened_by_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: disputeStatusEnum("status").notNull().default("OPEN"),
    resolution: text("resolution"),
    resolvedById: uuid("resolved_by_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("disputes_status_idx").on(t.status),
    uniqueIndex("disputes_one_open_per_pickup")
      .on(t.pickupId)
      .where(sql`${t.status} = 'OPEN'`),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt), index("audit_actor_idx").on(t.actorId)],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.userId] })],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.userId] }),
  buyerProfile: one(buyerProfiles, { fields: [users.id], references: [buyerProfiles.userId] }),
  wallet: one(wallets, { fields: [users.id], references: [wallets.userId] }),
  requests: many(recyclingRequests),
  notifications: many(notifications),
}));

export const requestsRelations = relations(recyclingRequests, ({ one, many }) => ({
  resident: one(users, {
    fields: [recyclingRequests.residentId],
    references: [users.id],
    relationName: "request_resident",
  }),
  buyer: one(users, {
    fields: [recyclingRequests.buyerId],
    references: [users.id],
    relationName: "request_buyer",
  }),
  category: one(materialCategories, {
    fields: [recyclingRequests.categoryId],
    references: [materialCategories.id],
  }),
  collection: one(collectiveCollections, {
    fields: [recyclingRequests.collectionId],
    references: [collectiveCollections.id],
  }),
  photos: many(requestPhotos),
  pickup: one(pickups, { fields: [recyclingRequests.id], references: [pickups.requestId] }),
}));

export const collectionsRelations = relations(collectiveCollections, ({ one, many }) => ({
  category: one(materialCategories, {
    fields: [collectiveCollections.categoryId],
    references: [materialCategories.id],
  }),
  buyer: one(users, { fields: [collectiveCollections.buyerId], references: [users.id] }),
  memberships: many(collectiveMemberships),
  requests: many(recyclingRequests),
}));

export const membershipsRelations = relations(collectiveMemberships, ({ one }) => ({
  collection: one(collectiveCollections, {
    fields: [collectiveMemberships.collectionId],
    references: [collectiveCollections.id],
  }),
  user: one(users, { fields: [collectiveMemberships.userId], references: [users.id] }),
  request: one(recyclingRequests, {
    fields: [collectiveMemberships.requestId],
    references: [recyclingRequests.id],
  }),
}));

export const pickupsRelations = relations(pickups, ({ one, many }) => ({
  request: one(recyclingRequests, {
    fields: [pickups.requestId],
    references: [recyclingRequests.id],
  }),
  buyer: one(users, { fields: [pickups.buyerId], references: [users.id], relationName: "pickup_buyer" }),
  resident: one(users, {
    fields: [pickups.residentId],
    references: [users.id],
    relationName: "pickup_resident",
  }),
  confirmations: many(pickupConfirmations),
}));

export const buyerPricesRelations = relations(buyerPrices, ({ one }) => ({
  category: one(materialCategories, {
    fields: [buyerPrices.categoryId],
    references: [materialCategories.id],
  }),
  buyer: one(users, { fields: [buyerPrices.buyerId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];
export type CollectionStatus = (typeof collectionStatusEnum.enumValues)[number];
