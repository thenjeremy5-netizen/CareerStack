import { logger } from '../utils/logger';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { EmailService } from './email';

export class NotificationService {
  static async notifyAdminsOfErrorReport(reportId: string, errorMessage: string, userEmail?: string) {
    try {
      // Get all admin users
      const admins = await db.select()
        .from(users)
        .where(eq(users.role, 'admin'));

      // Log notification
      logger.info({
        reportId,
        errorMessage: errorMessage.substring(0, 100),
        userEmail,
        adminCount: admins.length
      }, 'New error report submitted - notifying admins');

      // Send email notifications to all admins
      if (admins.length > 0) {
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);
        if (adminEmails.length > 0) {
          await EmailService.sendErrorReportNotification(
            adminEmails,
            reportId,
            errorMessage,
            userEmail
          );
        }
      }
      
    } catch (error) {
      logger.error({ error, reportId }, 'Failed to notify admins of error report');
    }
  }
}