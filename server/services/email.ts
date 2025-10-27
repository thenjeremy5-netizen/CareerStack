import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  private static getTransporter() {
    if (!this.transporter) {
      const emailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      };

      // Skip email setup if not configured
      if (!emailConfig.host || !emailConfig.auth.user) {
        logger.warn('Email configuration missing - email notifications disabled');
        return null;
      }

      this.transporter = nodemailer.createTransporter(emailConfig);
    }
    return this.transporter;
  }

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      logger.warn('Email not configured - skipping email notification');
      return false;
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
      return true;
    } catch (error) {
      logger.error({ error, to: options.to }, 'Failed to send email');
      return false;
    }
  }

  static async sendErrorReportNotification(
    adminEmails: string[],
    reportId: string,
    errorMessage: string,
    userEmail?: string
  ): Promise<void> {
    const subject = `🚨 New Error Report - ${errorMessage.substring(0, 50)}...`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 New Error Report Submitted</h2>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Error Details:</h3>
          <p><strong>Report ID:</strong> ${reportId}</p>
          <p><strong>Error Message:</strong> ${errorMessage}</p>
          <p><strong>User Email:</strong> ${userEmail || 'Anonymous'}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="margin: 20px 0;">
          <a href="${process.env.APP_URL || 'http://localhost:5000'}/admin/error-reports" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Error Report
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          This is an automated notification from CareerStack. Please review and address this error report promptly.
        </p>
      </div>
    `;

    const text = `
New Error Report Submitted

Report ID: ${reportId}
Error Message: ${errorMessage}
User Email: ${userEmail || 'Anonymous'}
Timestamp: ${new Date().toLocaleString()}

View the full report at: ${process.env.APP_URL || 'http://localhost:5000'}/admin/error-reports
    `;

    await this.sendEmail({
      to: adminEmails,
      subject,
      html,
      text,
    });
  }
}