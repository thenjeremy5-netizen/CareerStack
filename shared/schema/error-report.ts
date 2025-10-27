import { z } from 'zod';

export const ErrorReportStatus = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export type ErrorReportStatusType = typeof ErrorReportStatus[keyof typeof ErrorReportStatus];

export const errorReportSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userEmail: z.string().email().nullable(),
  errorMessage: z.string(),
  errorStack: z.string().nullable(),
  componentStack: z.string().nullable(),
  userDescription: z.string(),
  screenshotUrls: z.array(z.string().url()).optional(),
  status: z.enum([
    ErrorReportStatus.NEW,
    ErrorReportStatus.IN_PROGRESS,
    ErrorReportStatus.RESOLVED,
    ErrorReportStatus.CLOSED,
  ]),
  adminNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
  userAgent: z.string(),
});

export type ErrorReport = z.infer<typeof errorReportSchema>;