CREATE TABLE "login_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"failure_reason" varchar,
	"ip_address" varchar NOT NULL,
	"city" varchar,
	"region" varchar,
	"country" varchar,
	"country_code" varchar,
	"timezone" varchar,
	"isp" varchar,
	"latitude" varchar,
	"longitude" varchar,
	"user_agent" text,
	"browser" varchar,
	"browser_version" varchar,
	"os" varchar,
	"os_version" varchar,
	"device_type" varchar,
	"device_vendor" varchar,
	"is_suspicious" boolean DEFAULT false,
	"suspicious_reasons" text[],
	"is_new_location" boolean DEFAULT false,
	"is_new_device" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "next_step_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" varchar NOT NULL,
	"comment" text NOT NULL,
	"created_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "consultants" DROP CONSTRAINT "consultants_display_id_unique";--> statement-breakpoint
ALTER TABLE "consultants" DROP CONSTRAINT "consultants_email_unique";--> statement-breakpoint
ALTER TABLE "interviews" DROP CONSTRAINT "interviews_display_id_unique";--> statement-breakpoint
ALTER TABLE "requirements" DROP CONSTRAINT "requirements_display_id_unique";--> statement-breakpoint
ALTER TABLE "consultants" ALTER COLUMN "display_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consultants" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_accounts" ALTER COLUMN "sync_frequency" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "display_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "timezone" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "timezone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "consultant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "display_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "consultant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "applied_for" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "job_title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "requirements" ALTER COLUMN "complete_job_description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD COLUMN "history_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approval_status" varchar DEFAULT 'pending_approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_by" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_by" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_step_comments" ADD CONSTRAINT "next_step_comments_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_step_comments" ADD CONSTRAINT "next_step_comments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_login_history_user_id" ON "login_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_login_history_status" ON "login_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_login_history_created_at" ON "login_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_login_history_ip_address" ON "login_history" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_login_history_suspicious" ON "login_history" USING btree ("is_suspicious");--> statement-breakpoint
CREATE INDEX "idx_next_step_comments_requirement_id" ON "next_step_comments" USING btree ("requirement_id");--> statement-breakpoint
CREATE INDEX "idx_next_step_comments_created_by" ON "next_step_comments" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_next_step_comments_created_at" ON "next_step_comments" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_accounts_sync" ON "email_accounts" USING btree ("user_id","is_active","sync_enabled");--> statement-breakpoint
CREATE INDEX "idx_email_messages_account_id" ON "email_messages" USING btree ("email_account_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_external_id" ON "email_messages" USING btree ("external_message_id");--> statement-breakpoint
CREATE INDEX "idx_email_messages_account_thread" ON "email_messages" USING btree ("email_account_id","thread_id");--> statement-breakpoint
CREATE INDEX "idx_email_threads_user_archive" ON "email_threads" USING btree ("created_by","is_archived");