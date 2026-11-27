CREATE TYPE "public"."collection_status" AS ENUM('OPEN', 'TARGET_REACHED', 'ASSIGNED', 'PICKUP_PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('PENDING', 'CONFIRMED', 'EXPIRED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'RESOLVED_ACCEPT_BUYER', 'RESOLVED_ACCEPT_RESIDENT', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('SCHOOL', 'SHOP', 'ENTERPRISE', 'AIYL_OKMOTU', 'NGO');--> statement-breakpoint
CREATE TYPE "public"."pickup_status" AS ENUM('SCHEDULED', 'AWAITING_CONFIRMATION', 'COMPLETED', 'CANCELLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('DRAFT', 'AVAILABLE', 'RESERVED', 'PICKUP_PENDING', 'COMPLETED', 'CANCELLED', 'DISPUTED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('VISIBLE', 'FLAGGED', 'HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('RESIDENT', 'BUYER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."route_status" AS ENUM('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."wallet_tx_type" AS ENUM('EARN', 'SPEND', 'ADJUST');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" varchar(64),
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bonus_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name_ru" varchar(160) NOT NULL,
	"name_kg" varchar(160) NOT NULL,
	"coins_per_kg" numeric(8, 3) DEFAULT '0' NOT NULL,
	"flat_bonus" integer DEFAULT 0 NOT NULL,
	"collective_bonus" integer DEFAULT 0 NOT NULL,
	"category_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bonus_nonneg" CHECK ("bonus_rules"."coins_per_kg" >= 0 AND "bonus_rules"."flat_bonus" >= 0 AND "bonus_rules"."collective_bonus" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buyer_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"price_per_kg" numeric(12, 2) NOT NULL,
	"min_volume_kg" numeric(10, 3) DEFAULT '0' NOT NULL,
	"terms" text,
	"valid_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_price_nonneg" CHECK ("buyer_prices"."price_per_kg" >= 0),
	CONSTRAINT "buyer_price_minvol_nonneg" CHECK ("buyer_prices"."min_volume_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buyer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_name" varchar(200),
	"contact_phone" varchar(16),
	"description" text,
	"min_batch_kg" numeric(10, 3) DEFAULT '0' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	CONSTRAINT "buyer_min_batch_nonneg" CHECK ("buyer_profiles"."min_batch_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buyer_service_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"locality" varchar(120) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collective_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"category_id" uuid NOT NULL,
	"locality" varchar(120) NOT NULL,
	"target_kg" numeric(10, 3) NOT NULL,
	"planned_date" timestamp with time zone,
	"status" "collection_status" DEFAULT 'OPEN' NOT NULL,
	"buyer_id" uuid,
	"created_by_id" uuid NOT NULL,
	"organization_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_target_pos" CHECK ("collective_collections"."target_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "collective_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_id" uuid,
	"declared_kg" numeric(10, 3) DEFAULT '0' NOT NULL,
	"actual_kg" numeric(10, 3),
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_declared_nonneg" CHECK ("collective_memberships"."declared_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"opened_by_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"resolution" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"name_ru" varchar(120) NOT NULL,
	"name_kg" varchar(120) NOT NULL,
	"name_en" varchar(120) NOT NULL,
	"co2_per_kg" numeric(8, 4) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_co2_nonneg" CHECK ("material_categories"."co2_per_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link" varchar(300),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "org_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "org_type" NOT NULL,
	"locality" varchar(120) NOT NULL,
	"responsible_user_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pickup_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"pin_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"status" "confirmation_status" DEFAULT 'PENDING' NOT NULL,
	"actual_weight_kg" numeric(10, 3) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "confirmation_weight_pos" CHECK ("pickup_confirmations"."actual_weight_kg" > 0),
	CONSTRAINT "confirmation_amount_nonneg" CHECK ("pickup_confirmations"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"collection_id" uuid,
	"scheduled_at" timestamp with time zone,
	"status" "pickup_status" DEFAULT 'SCHEDULED' NOT NULL,
	"price_per_kg" numeric(12, 2),
	"reported_weight_kg" numeric(10, 3),
	"actual_weight_kg" numeric(10, 3),
	"total_amount" numeric(12, 2),
	"completed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_weight_pos" CHECK ("pickups"."actual_weight_kg" IS NULL OR "pickups"."actual_weight_kg" > 0),
	CONSTRAINT "pickup_amount_nonneg" CHECK ("pickups"."total_amount" IS NULL OR "pickups"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recycling_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resident_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"material_type" varchar(120),
	"approx_weight_kg" numeric(10, 3) NOT NULL,
	"actual_weight_kg" numeric(10, 3),
	"description" text,
	"locality" varchar(120) NOT NULL,
	"address" varchar(300) NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"public_lat" numeric(9, 6) NOT NULL,
	"public_lng" numeric(9, 6) NOT NULL,
	"pickup_date" timestamp with time zone,
	"time_from" varchar(5),
	"time_to" varchar(5),
	"desired_price_per_kg" numeric(12, 2),
	"agreed_price_per_kg" numeric(12, 2),
	"allow_collective" boolean DEFAULT false NOT NULL,
	"status" "request_status" DEFAULT 'AVAILABLE' NOT NULL,
	"buyer_id" uuid,
	"collection_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_weight_pos" CHECK ("recycling_requests"."approx_weight_kg" > 0),
	CONSTRAINT "request_actual_weight_pos" CHECK ("recycling_requests"."actual_weight_kg" IS NULL OR "recycling_requests"."actual_weight_kg" > 0),
	CONSTRAINT "request_lat_range" CHECK ("recycling_requests"."lat" BETWEEN -90 AND 90 AND "recycling_requests"."lng" BETWEEN -180 AND 180),
	CONSTRAINT "request_reserved_has_buyer" CHECK ("recycling_requests"."status" NOT IN ('RESERVED','PICKUP_PENDING') OR "recycling_requests"."buyer_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "request_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pickup_id" uuid NOT NULL,
	"resident_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"text" text,
	"status" "review_status" DEFAULT 'VISIBLE' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating_range" CHECK ("reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "route_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"planned_date" timestamp with time zone NOT NULL,
	"status" "route_status" DEFAULT 'PLANNED' NOT NULL,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"route_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"seq" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"csrf_token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"amount_usd" numeric(8, 2),
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"status" "subscription_status" NOT NULL,
	"price_usd" numeric(8, 2) DEFAULT '10.00' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_trial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_period" CHECK ("subscriptions"."ends_at" > "subscriptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"address" varchar(300),
	"about" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(16) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"locality" varchar(120) NOT NULL,
	"language" varchar(2) DEFAULT 'ru' NOT NULL,
	"organization_id" uuid,
	"consent_at" timestamp with time zone NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_format" CHECK ("users"."phone" ~ '^\+996[0-9]{9}$')
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"capacity_kg" numeric(10, 3) NOT NULL,
	CONSTRAINT "vehicle_capacity_pos" CHECK ("vehicles"."capacity_kg" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "wallet_tx_type" NOT NULL,
	"amount" integer NOT NULL,
	"reason" varchar(40) NOT NULL,
	"pickup_id" uuid,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_tx_amount_nonzero" CHECK ("wallet_transactions"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_balance_nonneg" CHECK ("wallets"."balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_rules" ADD CONSTRAINT "bonus_rules_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_prices" ADD CONSTRAINT "buyer_prices_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_prices" ADD CONSTRAINT "buyer_prices_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_service_areas" ADD CONSTRAINT "buyer_service_areas_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_collections" ADD CONSTRAINT "collective_collections_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_collections" ADD CONSTRAINT "collective_collections_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_collections" ADD CONSTRAINT "collective_collections_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_collections" ADD CONSTRAINT "collective_collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_memberships" ADD CONSTRAINT "collective_memberships_collection_id_collective_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collective_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_memberships" ADD CONSTRAINT "collective_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collective_memberships" ADD CONSTRAINT "collective_memberships_request_id_recycling_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."recycling_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_id_users_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_confirmations" ADD CONSTRAINT "pickup_confirmations_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_request_id_recycling_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."recycling_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickups" ADD CONSTRAINT "pickups_collection_id_collective_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collective_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycling_requests" ADD CONSTRAINT "recycling_requests_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycling_requests" ADD CONSTRAINT "recycling_requests_category_id_material_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycling_requests" ADD CONSTRAINT "recycling_requests_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recycling_requests" ADD CONSTRAINT "recycling_requests_collection_id_collective_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collective_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_photos" ADD CONSTRAINT "request_photos_request_id_recycling_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."recycling_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_route_plans_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."route_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_request_id_recycling_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."recycling_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_wallets_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wallets"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_pickup_id_pickups_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."pickups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bonus_rules_code_unique" ON "bonus_rules" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_price_unique" ON "buyer_prices" USING btree ("buyer_id","category_id");--> statement-breakpoint
CREATE INDEX "buyer_prices_category_idx" ON "buyer_prices" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buyer_area_unique" ON "buyer_service_areas" USING btree ("buyer_id","locality");--> statement-breakpoint
CREATE INDEX "collections_status_idx" ON "collective_collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collections_locality_category_idx" ON "collective_collections" USING btree ("locality","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_collection_user_unique" ON "collective_memberships" USING btree ("collection_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_request_unique" ON "collective_memberships" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "collective_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_one_open_per_pickup" ON "disputes" USING btree ("pickup_id") WHERE "disputes"."status" = 'OPEN';--> statement-breakpoint
CREATE UNIQUE INDEX "material_categories_code_unique" ON "material_categories" USING btree ("code");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "organizations_locality_idx" ON "organizations" USING btree ("locality");--> statement-breakpoint
CREATE INDEX "confirmations_pickup_idx" ON "pickup_confirmations" USING btree ("pickup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "confirmations_one_pending" ON "pickup_confirmations" USING btree ("pickup_id") WHERE "pickup_confirmations"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "pickups_request_active_unique" ON "pickups" USING btree ("request_id") WHERE "pickups"."status" <> 'CANCELLED';--> statement-breakpoint
CREATE INDEX "pickups_request_idx" ON "pickups" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "pickups_buyer_status_idx" ON "pickups" USING btree ("buyer_id","status");--> statement-breakpoint
CREATE INDEX "pickups_resident_idx" ON "pickups" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "recycling_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_resident_idx" ON "recycling_requests" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "requests_buyer_idx" ON "recycling_requests" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "requests_collection_idx" ON "recycling_requests" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "requests_locality_category_idx" ON "recycling_requests" USING btree ("locality","category_id");--> statement-breakpoint
CREATE INDEX "request_photos_request_idx" ON "request_photos" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_pickup_unique" ON "reviews" USING btree ("pickup_id");--> statement-breakpoint
CREATE INDEX "reviews_buyer_idx" ON "reviews" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "routes_buyer_idx" ON "route_plans" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "route_stop_seq_unique" ON "route_stops" USING btree ("route_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "route_stop_request_unique" ON "route_stops" USING btree ("route_id","request_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "subscription_events_sub_idx" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_buyer_idx" ON "subscriptions" USING btree ("buyer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_locality_idx" ON "users" USING btree ("locality");--> statement-breakpoint
CREATE INDEX "vehicles_buyer_idx" ON "vehicles" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "wallet_tx_user_idx" ON "wallet_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_tx_once_per_pickup" ON "wallet_transactions" USING btree ("pickup_id","user_id","reason") WHERE "wallet_transactions"."pickup_id" IS NOT NULL;