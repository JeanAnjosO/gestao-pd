import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const calendarModeTypes = sqliteTable("calendar_mode_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const units = sqliteTable("units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  minimumTeachers: integer("minimum_teachers").notNull().default(4),
  calendarModeTypeId: integer("calendar_mode_type_id").notNull().default(1).references(() => calendarModeTypes.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const personTypes = sqliteTable("person_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const accessRoleTypes = sqliteTable("access_role_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const personFunctionTypes = sqliteTable("person_function_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  personTypeId: integer("person_type_id").notNull().references(() => personTypes.id),
  accessRoleTypeId: integer("access_role_type_id").notNull().references(() => accessRoleTypes.id),
  functionTypeId: integer("function_type_id").references(() => personFunctionTypes.id),
  level: integer("level"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const operationalCapabilityTypes = sqliteTable("operational_capability_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const personOperationalCapabilities = sqliteTable("person_operational_capabilities", {
  personId: integer("person_id").notNull().references(() => people.id),
  capabilityTypeId: integer("capability_type_id").notNull().references(() => operationalCapabilityTypes.id),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("uq_person_operational_capabilities").on(table.personId, table.capabilityTypeId)]);

export const calendarClassTypes = sqliteTable("calendar_class_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  displayOrder: integer("display_order").notNull().unique(),
});

export const calendarAssignmentTypes = sqliteTable("calendar_assignment_types", {
  id: integer("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
});

export const calendarPeriods = sqliteTable("calendar_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdBy: integer("created_by").notNull().references(() => people.id),
  publishedBy: integer("published_by").references(() => people.id),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("uq_calendar_periods").on(table.unitId, table.year, table.month)]);

export const calendarDayNotes = sqliteTable("calendar_day_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  date: text("date").notNull(),
  note: text("note").notNull(),
  updatedBy: integer("updated_by").notNull().references(() => people.id),
  updatedAt: text("updated_at").notNull(),
}, (table) => [uniqueIndex("uq_calendar_day_notes").on(table.unitId, table.date)]);

export const calendarAssignments = sqliteTable("calendar_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  date: text("date").notNull(),
  assignmentTypeId: integer("assignment_type_id").notNull().references(() => calendarAssignmentTypes.id),
  classTypeId: integer("class_type_id").references(() => calendarClassTypes.id),
  personId: integer("person_id").notNull().references(() => people.id),
  manuallyAssigned: integer("manually_assigned", { mode: "boolean" }).notNull().default(false),
  createdBy: integer("created_by").notNull().references(() => people.id),
  updatedBy: integer("updated_by").notNull().references(() => people.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_calendar_assignments_unit_date").on(table.unitId, table.date), index("idx_calendar_assignments_person_date").on(table.personId, table.date)]);

export const unitMemberships = sqliteTable("unit_memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  personId: integer("person_id").notNull().references(() => people.id),
}, (table) => [uniqueIndex("uq_unit_memberships").on(table.unitId, table.personId)]);

export const unitOpenDays = sqliteTable("unit_open_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  weekday: integer("weekday").notNull(),
  open: integer("open", { mode: "boolean" }).notNull().default(false),
}, (table) => [uniqueIndex("uq_unit_open_days").on(table.unitId, table.weekday)]);

export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  personId: integer("person_id").notNull().references(() => people.id),
  weekday: integer("weekday").notNull(),
  dailyType: text("daily_type", { enum: ["half", "full", "manager_support"] }).notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
}, (table) => [index("idx_schedules_unit_weekday").on(table.unitId, table.weekday)]);

export const operationExceptions = sqliteTable("operation_exceptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  date: text("date").notNull(),
  open: integer("open", { mode: "boolean" }).notNull(),
  label: text("label"),
}, (table) => [uniqueIndex("uq_operation_exceptions").on(table.unitId, table.date)]);

export const absences = sqliteTable("absences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  personId: integer("person_id").notNull().references(() => people.id),
  date: text("date").notNull(),
  createdBy: integer("created_by").notNull().references(() => people.id),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("uq_absences_person_date").on(table.unitId, table.personId, table.date)]);

export const dailyOverrides = sqliteTable("daily_overrides", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  personId: integer("person_id").notNull().references(() => people.id),
  date: text("date").notNull(),
  dailyType: text("daily_type", { enum: ["half", "full"] }).notNull(),
  createdBy: integer("created_by").notNull().references(() => people.id),
}, (table) => [uniqueIndex("uq_daily_overrides").on(table.unitId, table.personId, table.date)]);

export const substitutions = sqliteTable("substitutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  date: text("date").notNull(),
  substitutePersonId: integer("substitute_person_id").references(() => people.id),
  externalName: text("external_name"),
  externalLevel: integer("external_level"),
  dailyType: text("daily_type", { enum: ["half", "full"] }).notNull(),
  createdBy: integer("created_by").notNull().references(() => people.id),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_substitutions_unit_date").on(table.unitId, table.date)]);

export const managerTeachingDays = sqliteTable("manager_teaching_days", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  managerId: integer("manager_id").notNull().references(() => people.id),
  date: text("date").notNull(),
  createdBy: integer("created_by").notNull().references(() => people.id),
}, (table) => [uniqueIndex("uq_manager_teaching_days").on(table.unitId, table.managerId, table.date)]);

export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  name: text("name").notNull(),
  allowedForHalfDay: integer("allowed_for_half_day", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("uq_classes_unit_name").on(table.unitId, table.name)]);

export const soloClasses = sqliteTable("solo_classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  teacherId: integer("teacher_id").notNull().references(() => people.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  date: text("date").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => people.id),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("uq_solo_classes_teacher_date_class").on(table.unitId, table.teacherId, table.date, table.classId),
  index("idx_solo_classes_status").on(table.unitId, table.status),
]);

export const monthlyPeriods = sqliteTable("monthly_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  closesAt: text("closes_at").notNull(),
  closedAt: text("closed_at"),
  closedBy: integer("closed_by").references(() => people.id),
  reopenedAt: text("reopened_at"),
  reopenedBy: integer("reopened_by").references(() => people.id),
}, (table) => [uniqueIndex("uq_monthly_periods").on(table.unitId, table.year, table.month)]);

export const monthlyPeriodEvents = sqliteTable("monthly_period_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => units.id),
  periodId: integer("period_id").notNull().references(() => monthlyPeriods.id),
  action: text("action", { enum: ["closed", "reopened"] }).notNull(),
  actorId: integer("actor_id").references(() => people.id),
  automated: integer("automated", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
