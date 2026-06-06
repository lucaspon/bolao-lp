CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished');--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "api_match_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "status" "match_status" DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_api_match_id_unique" UNIQUE("api_match_id");