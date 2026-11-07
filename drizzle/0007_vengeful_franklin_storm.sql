CREATE TABLE IF NOT EXISTS "combo_offer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"combo_offer_id" uuid NOT NULL,
	"product_id" uuid,
	"product_variant_id" uuid,
	"item_title" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "slug" text;--> statement-breakpoint
UPDATE "combo_offers" SET "slug" = 'combo-' || id WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "short_description" text;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "offer_badge" text;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "package_label" text;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "category_id" uuid;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "price_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "mrp_paise" integer;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "stock" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "allow_add_to_cart" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "package_highlights" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "combo_offers" ADD COLUMN IF NOT EXISTS "variant_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "combo_offer_items" ADD CONSTRAINT "combo_offer_items_combo_offer_id_combo_offers_id_fk" FOREIGN KEY ("combo_offer_id") REFERENCES "public"."combo_offers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "combo_offer_items" ADD CONSTRAINT "combo_offer_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "combo_offer_items" ADD CONSTRAINT "combo_offer_items_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "combo_offer_items_combo_idx" ON "combo_offer_items" USING btree ("combo_offer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "combo_offer_items_product_idx" ON "combo_offer_items" USING btree ("product_id");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "combo_offers" ADD CONSTRAINT "combo_offers_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "combo_offers" ADD CONSTRAINT "combo_offers_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "combo_offers_slug_uq" ON "combo_offers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "combo_offers_category_idx" ON "combo_offers" USING btree ("category_id");
