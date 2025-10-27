import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../schema';

export const errorReports = pgTable('error_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id),
  userEmail: text('user_email'),
  errorMessage: text('error_message').notNull(),
  errorStack: text('error_stack'),
  componentStack: text('component_stack'),
  userDescription: text('user_description').notNull(),
  screenshotUrls: text('screenshot_urls').array(),
  status: text('status').notNull().default('new'),
  adminNotes: text('admin_notes'),
  url: text('url').notNull(),
  userAgent: text('user_agent').notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});