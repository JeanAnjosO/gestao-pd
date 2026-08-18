CREATE TABLE `units` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `minimum_teachers` integer DEFAULT 4 NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `people` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `person_type` text NOT NULL,
  `access_role` text NOT NULL,
  `level` integer,
  `active` integer DEFAULT true NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_memberships` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `person_id` integer NOT NULL REFERENCES `people`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_unit_memberships` ON `unit_memberships` (`unit_id`,`person_id`);
--> statement-breakpoint
CREATE TABLE `unit_open_days` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `weekday` integer NOT NULL, `open` integer DEFAULT false NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_unit_open_days` ON `unit_open_days` (`unit_id`,`weekday`);
--> statement-breakpoint
CREATE TABLE `schedules` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `person_id` integer NOT NULL REFERENCES `people`(`id`), `weekday` integer NOT NULL, `daily_type` text NOT NULL, `starts_on` text NOT NULL, `ends_on` text);
--> statement-breakpoint
CREATE INDEX `idx_schedules_unit_weekday` ON `schedules` (`unit_id`,`weekday`);
--> statement-breakpoint
CREATE TABLE `operation_exceptions` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `date` text NOT NULL, `open` integer NOT NULL, `label` text);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_operation_exceptions` ON `operation_exceptions` (`unit_id`,`date`);
--> statement-breakpoint
CREATE TABLE `absences` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `person_id` integer NOT NULL REFERENCES `people`(`id`), `date` text NOT NULL, `created_by` integer NOT NULL REFERENCES `people`(`id`), `created_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_absences_person_date` ON `absences` (`unit_id`,`person_id`,`date`);
--> statement-breakpoint
CREATE TABLE `daily_overrides` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `person_id` integer NOT NULL REFERENCES `people`(`id`), `date` text NOT NULL, `daily_type` text NOT NULL, `created_by` integer NOT NULL REFERENCES `people`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_daily_overrides` ON `daily_overrides` (`unit_id`,`person_id`,`date`);
--> statement-breakpoint
CREATE TABLE `substitutions` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `date` text NOT NULL, `substitute_person_id` integer REFERENCES `people`(`id`), `external_name` text, `daily_type` text NOT NULL, `created_by` integer NOT NULL REFERENCES `people`(`id`), `created_at` text NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_substitutions_unit_date` ON `substitutions` (`unit_id`,`date`);
--> statement-breakpoint
CREATE TABLE `manager_teaching_days` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `manager_id` integer NOT NULL REFERENCES `people`(`id`), `date` text NOT NULL, `created_by` integer NOT NULL REFERENCES `people`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_manager_teaching_days` ON `manager_teaching_days` (`unit_id`,`manager_id`,`date`);
--> statement-breakpoint
CREATE TABLE `classes` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `name` text NOT NULL, `allowed_for_half_day` integer DEFAULT true NOT NULL, `active` integer DEFAULT true NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_classes_unit_name` ON `classes` (`unit_id`,`name`);
--> statement-breakpoint
CREATE TABLE `solo_classes` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `teacher_id` integer NOT NULL REFERENCES `people`(`id`), `class_id` integer NOT NULL REFERENCES `classes`(`id`), `date` text NOT NULL, `status` text DEFAULT 'pending' NOT NULL, `reviewed_by` integer REFERENCES `people`(`id`), `reviewed_at` text, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_solo_classes_teacher_date_class` ON `solo_classes` (`unit_id`,`teacher_id`,`date`,`class_id`);
--> statement-breakpoint
CREATE INDEX `idx_solo_classes_status` ON `solo_classes` (`unit_id`,`status`);
--> statement-breakpoint
CREATE TABLE `monthly_periods` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `unit_id` integer NOT NULL REFERENCES `units`(`id`), `year` integer NOT NULL, `month` integer NOT NULL, `status` text DEFAULT 'open' NOT NULL, `closes_at` text NOT NULL, `closed_at` text, `closed_by` integer REFERENCES `people`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_periods` ON `monthly_periods` (`unit_id`,`year`,`month`);
