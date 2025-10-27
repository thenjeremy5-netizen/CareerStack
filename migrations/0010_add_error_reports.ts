import { sql } from 'drizzle-orm';

export default async function(db: any) {
  // Create error_reports table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS error_reports (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id VARCHAR REFERENCES users(id),
      user_email TEXT,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      component_stack TEXT,
      user_description TEXT NOT NULL,
      screenshot_urls TEXT[],
      status TEXT NOT NULL DEFAULT 'new',
      admin_notes TEXT,
      url TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS error_reports_user_id_idx ON error_reports(user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS error_reports_status_idx ON error_reports(status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS error_reports_created_at_idx ON error_reports(created_at DESC)`);
}
