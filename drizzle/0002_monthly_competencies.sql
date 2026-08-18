ALTER TABLE `monthly_periods` ADD `reopened_at` text;
ALTER TABLE `monthly_periods` ADD `reopened_by` integer REFERENCES `people`(`id`);
CREATE TABLE `monthly_period_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `unit_id` integer NOT NULL REFERENCES `units`(`id`),
  `period_id` integer NOT NULL REFERENCES `monthly_periods`(`id`),
  `action` text NOT NULL,
  `actor_id` integer REFERENCES `people`(`id`),
  `automated` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL
);
CREATE INDEX `idx_monthly_period_events_unit_id` ON `monthly_period_events` (`unit_id`);
CREATE INDEX `idx_monthly_period_events_period_id` ON `monthly_period_events` (`period_id`);
CREATE INDEX `idx_monthly_period_events_actor_id` ON `monthly_period_events` (`actor_id`);
CREATE INDEX `idx_monthly_periods_reopened_by` ON `monthly_periods` (`reopened_by`);
