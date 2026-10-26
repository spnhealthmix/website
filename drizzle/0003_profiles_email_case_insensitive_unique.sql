DROP INDEX "profiles_email_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_uq" ON "profiles" USING btree (lower("email"));