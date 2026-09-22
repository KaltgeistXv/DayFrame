import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  project: text('project').notNull().default(''),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  date: text('date').notNull().default(''),
  time: text('time').notNull().default(''),
  duration: integer('duration').notNull().default(60),
  notes: text('notes').notNull().default(''),
  tracking: integer('tracking').notNull().default(0),
  checkins: text('checkins').notNull().default('{}'),
  baselineStart: text('baselineStart').notNull().default(''),
  baselineEnd: text('baselineEnd').notNull().default(''),
  startedOn: text('startedOn').notNull().default(''),
  completedOn: text('completedOn').notNull().default(''),
  rolledDays: integer('rolledDays').notNull().default(0),
  tags: text('tags').notNull().default('[]'),
  position: integer('position').notNull().default(0),
});
export const projects = sqliteTable('projects', {
  scheduleMode: text('scheduleMode').notNull().default('auto'),
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default('0'),
  folder: text('folder').notNull().default(''),
  tags: text('tags').notNull().default('[]'),
  start: text('start').notNull().default(''),
  end: text('end').notNull().default(''),
  position: integer('position').notNull().default(0),
});
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
});
export const labels = sqliteTable('labels', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  color: text('color').notNull().default('0'),
});
