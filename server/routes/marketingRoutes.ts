import { Router } from 'express';
import { db, queryWithTimeout, executeTransaction } from '../db';
import { 
  sql, 
  count,
  eq, 
  desc, 
  asc, 
  and, 
  or, 
  like, 
  gte, 
  lte 
} from 'drizzle-orm';
import { isAuthenticated } from '../localAuth';
import {
  apiRateLimiter as marketingRateLimiter,
  apiRateLimiter as writeOperationsRateLimiter,
  bulkOperationsRateLimiter,
  emailSendRateLimiter as emailRateLimiter
} from '../middleware/rateLimiter';
// CSRF is enforced globally in localAuth via session-based double-submit.
// Avoid per-route CSRF here to prevent token mismatches and duplicate validation.

// No-op CSRF middleware: rely on global CSRF enforcement from localAuth
const conditionalCSRF = (_req: any, _res: any, next: any) => next();
import { EmailService } from '../services/emailService';
import { ImapService } from '../services/imapService';
import { EnhancedGmailOAuthService } from '../services/enhancedGmailOAuthService';
import { OutlookOAuthService } from '../services/outlookOAuthService';
import { MultiAccountEmailService } from '../services/multiAccountEmailService';
import { EmailSyncService } from '../services/emailSyncService';
import { EmailSearchService } from '../services/emailSearchService';
import { EmailDeliverabilityService } from '../services/emailDeliverabilityService';
import { EmailRateLimiter } from '../services/emailRateLimiter';
import { encrypt, decrypt, maskSSN } from '../utils/encryption';
import { logCreate, logUpdate, logDelete, logView } from '../utils/auditLogger';
import { 
  sanitizeConsultantData, 
  sanitizeRequirementData, 
  sanitizeInterviewData 
} from '../utils/sanitizer';
import multer from 'multer';
import { 
  consultants,
  consultantProjects,
  requirements, 
  interviews,
  nextStepComments,
  emailThreads, 
  emailMessages, 
  emailAttachments,
  emailAccounts,
  users,
  insertConsultantSchema,
  insertConsultantProjectSchema,
  insertRequirementSchema,
  insertInterviewSchema,
  insertNextStepCommentSchema,
  insertEmailThreadSchema,
  insertEmailMessageSchema,
  insertEmailAttachmentSchema,
  insertEmailAccountSchema,
  type Consultant,
  type ConsultantProject,
  type Requirement,
  type Interview,
  type NextStepComment,
  type InsertNextStepComment,
  type EmailThread,
  type EmailMessage,
  type EmailAccount,
  type MarketingComment
} from '@shared/schema';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// Import necessary Express types
import { Request, Response } from 'express';

// Type for request with authenticated user
interface AuthRequest extends Request {
  user: Express.User;
  params: {
    [key: string]: string;
  };
}

// Helper type for route handlers
type AsyncRequestHandler = (req: AuthRequest, res: Response) => Promise<void | Response>;

// Helper function to wrap async route handlers
const asyncHandler = (fn: AsyncRequestHandler) => (req: Request, res: Response) => {
  return Promise.resolve(fn(req as AuthRequest, res)).catch((error) => {
    logger.error(String(error));
    res.status(500).json({ error: 'Internal server error' });
  });
};

// Email threads routes
router.get('/emails/threads/sent', isAuthenticated, marketingRateLimiter, asyncHandler(async (req, res) => {
  try {
    const threads = await db.select()
      .from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user.id),
        eq(emailMessages.messageType, 'sent')
      ))
      .orderBy(desc(emailMessages.sentAt));
    res.json(threads);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching sent threads');
    res.status(500).json({ error: 'Failed to fetch sent threads' });
  }
}));

router.get('/emails/threads/snoozed', isAuthenticated, marketingRateLimiter, asyncHandler(async (req, res) => {
  try {
    const threads = await db.select()
      .from(emailThreads)
      .innerJoin(emailMessages, eq(emailThreads.id, emailMessages.threadId))
      .where(and(
        eq(emailMessages.createdBy, req.user.id),
        sql`${emailThreads.labels}::text[] @> ARRAY['snoozed']`
      ))
      .orderBy(desc(emailThreads.lastMessageAt));
    res.json(threads);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching snoozed threads');
    res.status(500).json({ error: 'Failed to fetch snoozed threads' });
  }
}));

router.get('/emails/threads/drafts', isAuthenticated, marketingRateLimiter, asyncHandler(async (req, res) => {
  try {
    const threads = await db.select()
      .from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user.id),
        eq(emailMessages.messageType, 'draft')
      ))
      .orderBy(desc(emailMessages.updatedAt));
    res.json(threads);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching draft threads');
    res.status(500).json({ error: 'Failed to fetch draft threads' });
  }
}));

router.get('/emails/threads/starred', isAuthenticated, marketingRateLimiter, asyncHandler(async (req, res) => {
  try {
    const threads = await db.select()
      .from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user.id),
        eq(emailMessages.isStarred, true)
      ))
      .orderBy(desc(emailMessages.updatedAt));
    res.json(threads);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching starred threads');
    res.status(500).json({ error: 'Failed to fetch starred threads' });
  }
}));

// Delete email thread
router.delete('/emails/threads/:threadId', isAuthenticated, writeOperationsRateLimiter, conditionalCSRF, asyncHandler(async (req, res) => {
  try {
    const { threadId } = req.params;
    
    // Check if there's a thread or message with this ID
    const [thread, message] = await Promise.all([
      db.select()
        .from(emailThreads)
        .where(and(
          eq(emailThreads.id, threadId),
          eq(emailThreads.createdBy, req.user.id)
        ))
        .limit(1),
      db.select()
        .from(emailMessages)
        .where(and(
          eq(emailMessages.threadId, threadId),
          eq(emailMessages.createdBy, req.user.id)
        ))
        .limit(1)
    ]);

    // If neither exists, return 404
    if (!thread.length && !message.length) {
      return res.status(404).json({ error: 'Thread not found or access denied' });
    }

    // Delete the thread and all associated messages
    await executeTransaction(async (tx) => {
      // Delete any associated messages first
      await tx.delete(emailMessages)
        .where(eq(emailMessages.threadId, threadId));
      
      // Then delete the thread if it exists
      if (thread.length) {
        await tx.delete(emailThreads)
          .where(eq(emailThreads.id, threadId));
      }
    });

    await logDelete(req.user.id, 'emailThread', threadId, { id: threadId });
    res.json({ success: true });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting thread');
    res.status(500).json({ error: 'Failed to delete thread' });
  }
}));

// Public OAuth callbacks (do NOT require authentication)
// These use the OAuth 'state' parameter (set to userId during auth URL generation)
router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const userId = String(req.query.state || '');
    if (!code || !userId) {
      return res
        .status(400)
        .send('<html><body>Missing authorization code or state</body></html>');
    }

    const result = await EnhancedGmailOAuthService.handleCallback(code, userId);
    const success = !!result.success;
    const msg = success
      ? 'Gmail account connected successfully'
      : (result.error || 'Failed to connect Gmail account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Gmail OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'GMAIL_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error handling public Gmail callback');
    res.status(500).send('<html><body>Failed to process Gmail authorization</body></html>');
  }
});

router.get('/oauth/outlook/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const userId = String(req.query.state || '');
    if (!code || !userId) {
      return res
        .status(400)
        .send('<html><body>Missing authorization code or state</body></html>');
    }

    const result = await OutlookOAuthService.handleCallback(code, userId);
    const success = !!result.success;
    const msg = success
      ? 'Outlook account connected successfully'
      : (result.error || 'Failed to connect Outlook account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Outlook OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OUTLOOK_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error handling public Outlook callback');
    res.status(500).send('<html><body>Failed to process Outlook authorization</body></html>');
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 25_000_000),
    files: Number(process.env.MAX_FILES_PER_REQUEST || 3),
  }
});

// Middleware to check if user has marketing role
const requireMarketingRole = async (req: any, res: any, next: any) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has 'marketing' or 'admin' role
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
      columns: {
        id: true,
        role: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Allow marketing and admin roles
    if (!user.role || !['marketing', 'admin'].includes(user.role)) {
      return res.status(403).json({ 
        message: 'Marketing role required',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: ['marketing', 'admin'],
        currentRole: user.role || 'none'
      });
    }

    next();
  } catch (error) {
    logger.error({ error: String(error) }, 'Marketing role check error');
    return res.status(500).json({ message: 'Authorization check failed' });
  }
};

// Apply authentication and authorization to all routes
router.use(isAuthenticated);
router.use(requireMarketingRole);

// Do NOT regenerate or overwrite CSRF token here; handled globally in localAuth

// Apply global rate limiting to all marketing routes
router.use(marketingRateLimiter);

// Helper functions for generating display IDs
async function generateConsultantDisplayId(): Promise<string> {
  // Get the maximum ID number currently in use
  const result = await db.select({ 
    maxId: sql<number>`COALESCE(MAX(CAST(SUBSTRING(display_id FROM 11) AS INTEGER)), 0)` 
  }).from(consultants);
  const nextNumber = result[0]?.maxId + 1;
  return `CONST ID - ${nextNumber}`;
}

async function generateRequirementDisplayId(): Promise<string> {
  // Get the maximum ID number currently in use
  const result = await db.select({ 
    maxId: sql<number>`COALESCE(MAX(CAST(SUBSTRING(display_id FROM 9) AS INTEGER)), 0)` 
  }).from(requirements);
  const nextNumber = result[0]?.maxId + 1;
  return `REQ ID - ${nextNumber}`;
}

async function generateInterviewDisplayId(): Promise<string> {
  // Get the maximum ID number currently in use
  const result = await db.select({ 
    maxId: sql<number>`COALESCE(MAX(CAST(SUBSTRING(display_id FROM 9) AS INTEGER)), 0)` 
  }).from(interviews);
  const nextNumber = result[0]?.maxId + 1;
  return `INT ID - ${nextNumber}`;
}

// CONSULTANTS ROUTES

// Get all consultants with filters (with pagination)
router.get('/consultants', async (req, res) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;
    
    // Enforce maximum limit of 100 records per request
    const limitNum = Math.min(parseInt(limit as string), 100);
    const pageNum = parseInt(page as string);
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(consultants.status, status as string));
    }
    if (search) {
      whereConditions.push(
        or(
          like(consultants.name, `%${search}%`),
          like(consultants.email, `%${search}%`),
          like(consultants.visaStatus, `%${search}%`),
          like(consultants.countryOfOrigin, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    // Get total count for pagination
    const [{ count: totalCount }] = await queryWithTimeout(
      () => db.select({ count: sql<number>`count(*)` }).from(consultants).where(whereClause),
      5000 // 5 second timeout for count query
    );
    
    const allConsultants = await queryWithTimeout(
      () => db.query.consultants.findMany({
        where: whereClause,
        with: {
          projects: {
            orderBy: [desc(consultantProjects.createdAt)],
          },
          createdByUser: {
            columns: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: [desc(consultants.createdAt)],
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      }),
      10000 // 10 second timeout for main query
    );

    res.json({
      data: allConsultants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / limitNum),
      }
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching consultants');
    res.status(500).json({ message: 'Failed to fetch consultants' });
  }
});

// Get consultant by ID
router.get('/consultants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const consultant = await db.query.consultants.findFirst({
      where: eq(consultants.id, id),
      with: {
        projects: {
          orderBy: [desc(consultantProjects.createdAt)],
        },
        requirements: {
          orderBy: [desc(requirements.createdAt)],
          limit: 10,
        },
        interviews: {
          orderBy: [desc(interviews.createdAt)],
          limit: 10,
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!consultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }

    res.json(consultant);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching consultant');
    res.status(500).json({ message: 'Failed to fetch consultant' });
  }
});

// Create consultant with projects (OPTIMIZED with transaction and batch insert)
router.post('/consultants', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { consultant: consultantData, projects = [] } = req.body;
    
    // Sanitize input data
    const sanitizedData = sanitizeConsultantData(consultantData);
    
    // Encrypt SSN if provided
    if (sanitizedData.ssn) {
      sanitizedData.ssn = encrypt(sanitizedData.ssn);
    }
    
    // Generate display ID
    const displayId = await generateConsultantDisplayId();
    
    // Validate consultant data
    const validatedConsultant = insertConsultantSchema.parse({
      ...sanitizedData,
      displayId,
      createdBy: req.user!.id
    });
    
    // Use transaction for atomic operation
    const result = await executeTransaction(async (tx) => {
      // Create consultant
      const [newConsultant] = await tx.insert(consultants).values(validatedConsultant).returning();
      
      // ✅ FIXED N+1: Batch insert all projects in a single query
      let createdProjects: any[] = [];
      if (projects.length > 0) {
        const validatedProjects = projects.map((project: any) => 
          insertConsultantProjectSchema.parse({
            ...project,
            consultantId: newConsultant.id
          })
        );
        
        // Single batch insert for all projects
        createdProjects = await tx.insert(consultantProjects).values(validatedProjects).returning();
      }
      
      return { newConsultant, createdProjects };
    });
    
    // Log audit trail
    await logCreate(
      req.user!.id,
      'consultant',
      result.newConsultant.id,
      result.newConsultant,
      req
    );
    
    // Mask SSN before sending response
    const responseData = { ...result.newConsultant, projects: result.createdProjects };
    if (responseData.ssn) {
      responseData.ssn = maskSSN(responseData.ssn);
    }
    
    res.status(201).json(responseData);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error creating consultant');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create consultant' });
  }
});

// Update consultant (OPTIMIZED with transaction and batch insert)
router.patch('/consultants/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { consultant: consultantData, projects = [] } = req.body;
    
    // Get old data for audit log
    const oldConsultant = await db.query.consultants.findFirst({
      where: eq(consultants.id, id),
    });
    
    if (!oldConsultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }
    
    // Sanitize input data
    const sanitizedData = sanitizeConsultantData(consultantData);
    
    // Encrypt SSN if provided
    if (sanitizedData.ssn) {
      sanitizedData.ssn = encrypt(sanitizedData.ssn);
    }
    
    // Use transaction for atomic operation
    const result = await executeTransaction(async (tx) => {
      // Update consultant
      const updateData = insertConsultantSchema.partial().parse(consultantData);
      const [updatedConsultant] = await tx
        .update(consultants)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(consultants.id, id))
        .returning();

      if (!updatedConsultant) {
        throw new Error('Consultant not found');
      }

      // Delete existing projects
      await tx.delete(consultantProjects).where(eq(consultantProjects.consultantId, id));
      
      // ✅ FIXED N+1: Batch insert all projects in a single query
      let createdProjects: any[] = [];
      if (projects.length > 0) {
        const validatedProjects = projects.map((project: any) => 
          insertConsultantProjectSchema.parse({
            ...project,
            consultantId: id
          })
        );
        
        // Single batch insert for all projects
        createdProjects = await tx.insert(consultantProjects).values(validatedProjects).returning();
      }

      return { updatedConsultant, createdProjects };
    });
    
    // Log audit trail
    await logUpdate(
      req.user!.id,
      'consultant',
      id,
      oldConsultant,
      result.updatedConsultant,
      req
    );
    
    // Mask SSN before sending response
    const responseData = { ...result.updatedConsultant, projects: result.createdProjects };
    if (responseData.ssn) {
      responseData.ssn = maskSSN(responseData.ssn);
    }

    res.json(responseData);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating consultant');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    if (error instanceof Error && error.message === 'Consultant not found') {
      return res.status(404).json({ message: 'Consultant not found' });
    }
    res.status(500).json({ message: 'Failed to update consultant' });
  }
});

// Delete consultant
router.delete('/consultants/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if consultant has associated requirements or interviews
    const consultant = await db.query.consultants.findFirst({
      where: eq(consultants.id, id),
      with: {
        requirements: { limit: 1 },
        interviews: { limit: 1 },
      }
    });
    
    if (!consultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }
    
    if (consultant.requirements.length > 0 || consultant.interviews.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete consultant with associated requirements or interviews. Please reassign or remove them first.' 
      });
    }
    
    const [deletedConsultant] = await db
      .delete(consultants)
      .where(eq(consultants.id, id))
      .returning();
    
    // Log audit trail
    await logDelete(
      req.user!.id,
      'consultant',
      id,
      consultant,
      req
    );

    res.json({ message: 'Consultant deleted successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting consultant');
    res.status(500).json({ message: 'Failed to delete consultant' });
  }
});

// REQUIREMENTS ROUTES

// Get all requirements with filters (with pagination)
router.get('/requirements', async (req, res) => {
  try {
    const { status, consultantId, clientCompany, dateFrom, dateTo, search, page = '1', limit = '50' } = req.query;
    
    // Enforce maximum limit
    const limitNum = Math.min(parseInt(limit as string), 100);
    const pageNum = parseInt(page as string);
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(requirements.status, status as string));
    }
    // Consultant filtering removed
    if (clientCompany) {
      whereConditions.push(like(requirements.clientCompany, `%${clientCompany}%`));
    }
    if (dateFrom) {
      whereConditions.push(gte(requirements.createdAt, new Date(dateFrom as string)));
    }
    if (dateTo) {
      whereConditions.push(lte(requirements.createdAt, new Date(dateTo as string)));
    }
    if (search) {
      whereConditions.push(
        or(
          like(requirements.jobTitle, `%${search}%`),
          like(requirements.clientCompany, `%${search}%`),
          like(requirements.primaryTechStack, `%${search}%`),
          like(requirements.vendorCompany, `%${search}%`),
          like(requirements.completeJobDescription, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    // Get total count
    const [{ count: totalCount }] = await queryWithTimeout(
      () => db.select({ count: sql<number>`count(*)` }).from(requirements).where(whereClause),
      5000
    );
    
    const allRequirements = await queryWithTimeout(
      () => db.query.requirements.findMany({
        where: whereClause,
        with: {
          interviews: true,
          createdByUser: {
            columns: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: [desc(requirements.createdAt)],
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      }),
      10000
    );

    res.json({
      data: allRequirements,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / limitNum),
      }
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching requirements');
    res.status(500).json({ message: 'Failed to fetch requirements' });
  }
});

// Get requirement by ID
router.get('/requirements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
      with: {
        interviews: true,
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    res.json(requirement);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching requirement');
    res.status(500).json({ message: 'Failed to fetch requirement' });
  }
});

// Create requirement (single or bulk)
router.post('/requirements', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { requirements: reqArray, single } = req.body;
    
    if (single) {
      // Single requirement - sanitize input
      const sanitizedData = sanitizeRequirementData(req.body);
      
      // Generate display ID
      const displayId = await generateRequirementDisplayId();
      
      const requirementData = insertRequirementSchema.parse({
        ...sanitizedData,
        displayId,
        createdBy: req.user!.id,
        marketingComments: []
      });
      
      const [newRequirement] = await db.insert(requirements).values(requirementData).returning();
      
      // Log audit trail
      await logCreate(req.user!.id, 'requirement', newRequirement.id, newRequirement, req);
      
      res.status(201).json(newRequirement);
    } else {
      // Bulk requirements
      if (!Array.isArray(reqArray) || reqArray.length === 0) {
        return res.status(400).json({ message: 'Requirements array is required for bulk creation' });
      }

      // Sanitize all requirements and generate display IDs
      const requirementDataArray = await Promise.all(reqArray.map(async (reqData) => {
        const sanitizedData = sanitizeRequirementData(reqData);
        const displayId = await generateRequirementDisplayId();
        return insertRequirementSchema.parse({
          ...sanitizedData,
          displayId,
          createdBy: req.user!.id,
          marketingComments: []
        });
      }));

      const newRequirements = await db.insert(requirements).values(requirementDataArray).returning();
      
      // Log bulk creation
      for (const newReq of newRequirements) {
        await logCreate(req.user!.id, 'requirement', newReq.id, newReq, req);
      }
      
      res.status(201).json(newRequirements);
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Error creating requirements');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create requirements' });
  }
});

// Update requirement
router.patch('/requirements/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get old data for audit log
    const oldRequirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });
    
    if (!oldRequirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }
    
    // Sanitize input
    const sanitizedData = sanitizeRequirementData(req.body);
    const updateData = insertRequirementSchema.partial().parse(sanitizedData);
    
    const [updatedRequirement] = await db
      .update(requirements)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(requirements.id, id))
      .returning();
    
    // Log audit trail
    await logUpdate(req.user!.id, 'requirement', id, oldRequirement, updatedRequirement, req);

    res.json(updatedRequirement);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating requirement');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update requirement' });
  }
});

// Add comment to requirement
router.post('/requirements/:id/comments', conditionalCSRF, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string') {
      return res.status(400).json({ message: 'Comment is required' });
    }

    // Get current requirement
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Add new comment to the array
    const newComment: MarketingComment = {
      comment,
      timestamp: new Date(),
      userId: req.user!.id,
      userName: (req.user as any).firstName ? `${(req.user as any).firstName} ${(req.user as any).lastName || ''}`.trim() : req.user!.email
    };

    const currentComments = Array.isArray(requirement.marketingComments) ? requirement.marketingComments as MarketingComment[] : [];
    const updatedComments = [...currentComments, newComment];

    const [updatedRequirement] = await db
      .update(requirements)
      .set({ 
        marketingComments: updatedComments as any,
        updatedAt: new Date() 
      })
      .where(eq(requirements.id, id))
      .returning();

    res.json(updatedRequirement);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error adding comment');
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Delete requirement
router.delete('/requirements/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get requirement data for audit log
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }
    
    const [deletedRequirement] = await db
      .delete(requirements)
      .where(eq(requirements.id, id))
      .returning();
    
    // Log audit trail
    await logDelete(req.user!.id, 'requirement', id, requirement, req);

    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting requirement');
    res.status(500).json({ message: 'Failed to delete requirement' });
  }
});

// INTERVIEWS ROUTES

// NEXT STEP COMMENTS ROUTES

// Get next step comments for a requirement
router.get('/requirements/:id/next-step-comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify requirement exists
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });
    
    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }
    
    const comments = await db.query.nextStepComments.findMany({
      where: eq(nextStepComments.requirementId, id),
      with: {
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: [desc(nextStepComments.createdAt)],
    });

    res.json(comments);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching next step comments');
    res.status(500).json({ message: 'Failed to fetch next step comments' });
  }
});

// Add next step comment to a requirement
router.post('/requirements/:id/next-step-comments', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment is required and cannot be empty' });
    }

    // Verify requirement exists
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Create new next step comment
    const commentData = insertNextStepCommentSchema.parse({
      requirementId: id,
      comment: comment.trim(),
      createdBy: req.user!.id,
    });

    const [newComment] = await db.insert(nextStepComments).values(commentData).returning();
    
    // Fetch the comment with user details
    const commentWithUser = await db.query.nextStepComments.findFirst({
      where: eq(nextStepComments.id, newComment.id),
      with: {
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    // Log audit trail
    await logCreate(req.user!.id, 'next_step_comment', newComment.id, newComment, req);

    res.status(201).json(commentWithUser);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error adding next step comment');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to add next step comment' });
  }
});

// Update next step comment
router.patch('/next-step-comments/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment is required and cannot be empty' });
    }

    // Get old data for audit log and verify ownership
    const oldComment = await db.query.nextStepComments.findFirst({
      where: eq(nextStepComments.id, id),
    });

    if (!oldComment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only allow the creator to edit their own comment
    if (oldComment.createdBy !== req.user!.id) {
      return res.status(403).json({ message: 'You can only edit your own comments' });
    }

    const [updatedComment] = await db
      .update(nextStepComments)
      .set({ 
        comment: comment.trim(),
        updatedAt: new Date() 
      })
      .where(eq(nextStepComments.id, id))
      .returning();

    // Fetch the comment with user details
    const commentWithUser = await db.query.nextStepComments.findFirst({
      where: eq(nextStepComments.id, updatedComment.id),
      with: {
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    // Log audit trail
    await logUpdate(req.user!.id, 'next_step_comment', id, oldComment, updatedComment, req);

    res.json(commentWithUser);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating next step comment');
    res.status(500).json({ message: 'Failed to update next step comment' });
  }
});

// Delete next step comment
router.delete('/next-step-comments/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;

    // Get comment data for audit log and verify ownership
    const comment = await db.query.nextStepComments.findFirst({
      where: eq(nextStepComments.id, id),
    });

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Only allow the creator to delete their own comment
    if (comment.createdBy !== req.user!.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await db.delete(nextStepComments).where(eq(nextStepComments.id, id));

    // Log audit trail
    await logDelete(req.user!.id, 'next_step_comment', id, comment, req);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting next step comment');
    res.status(500).json({ message: 'Failed to delete next step comment' });
  }
});


// Get all interviews with filters (with pagination)
router.get('/interviews', async (req, res) => {
  try {
    const { status, consultantId, requirementId, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    
    const limitNum = Math.min(parseInt(limit as string), 100);
    const pageNum = parseInt(page as string);
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(interviews.status, status as string));
    }
    // Consultant filtering removed
    if (requirementId) {
      whereConditions.push(eq(interviews.requirementId, requirementId as string));
    }
    if (dateFrom) {
      whereConditions.push(gte(interviews.interviewDate, new Date(dateFrom as string)));
    }
    if (dateTo) {
      whereConditions.push(lte(interviews.interviewDate, new Date(dateTo as string)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    // Get total count
    const [{ count: totalCount }] = await queryWithTimeout(
      () => db.select({ count: sql<number>`count(*)` }).from(interviews).where(whereClause),
      5000
    );
    
    const allInterviews = await queryWithTimeout(
      () => db.query.interviews.findMany({
        where: whereClause,
        with: {
          requirement: true,
          marketingPerson: {
            columns: { firstName: true, lastName: true, email: true }
          },
          createdByUser: {
            columns: { firstName: true, lastName: true, email: true }
          }
        },
        orderBy: [desc(interviews.interviewDate)],
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      }),
      10000
    );

    res.json({
      data: allInterviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / limitNum),
      }
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching interviews');
    res.status(500).json({ message: 'Failed to fetch interviews' });
  }
});

// Get interview by ID
router.get('/interviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
      with: {
        requirement: true,
        marketingPerson: {
          columns: { firstName: true, lastName: true, email: true }
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.json(interview);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching interview');
    res.status(500).json({ message: 'Failed to fetch interview' });
  }
});

// Create interview
router.post('/interviews', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    // Sanitize input
    const sanitizedData = sanitizeInterviewData(req.body);
    
    // Generate display ID
    const displayId = await generateInterviewDisplayId();
    
    const interviewData = insertInterviewSchema.parse({
      ...sanitizedData,
      displayId,
      createdBy: req.user!.id
    });
    
    const [newInterview] = await db.insert(interviews).values(interviewData).returning();
    
    // Log audit trail
    await logCreate(req.user!.id, 'interview', newInterview.id, newInterview, req);
    
    res.status(201).json(newInterview);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error creating interview');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create interview' });
  }
});

// Update interview
router.patch('/interviews/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get old data for audit log
    const oldInterview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });
    
    if (!oldInterview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    // Sanitize input
    const sanitizedData = sanitizeInterviewData(req.body);
    const updateData = insertInterviewSchema.partial().parse(sanitizedData);
    
    const [updatedInterview] = await db
      .update(interviews)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(interviews.id, id))
      .returning();
    
    // Log audit trail
    await logUpdate(req.user!.id, 'interview', id, oldInterview, updatedInterview, req);

    res.json(updatedInterview);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating interview');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update interview' });
  }
});

// Delete interview
router.delete('/interviews/:id', conditionalCSRF, writeOperationsRateLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get interview data for audit log
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
    });
    
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    
    const [deletedInterview] = await db
      .delete(interviews)
      .where(eq(interviews.id, id))
      .returning();
    
    // Log audit trail
    await logDelete(req.user!.id, 'interview', id, interview, req);

    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting interview');
    res.status(500).json({ message: 'Failed to delete interview' });
  }
});

// OAUTH2 ROUTES REMOVED - Use /api/email routes instead


// Gmail OAuth2 - Handle callback (legacy POST support if popup posts code)
router.post('/oauth/gmail/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const result = await EnhancedGmailOAuthService.handleCallback(code, req.user!.id);
    
    if (result.success) {
      res.json({ 
        success: true, 
        account: result.account,
        message: 'Gmail account connected successfully' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error || 'Failed to connect Gmail account' 
      });
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Error handling Gmail callback');
    res.status(500).json({ message: 'Failed to process Gmail authorization' });
  }
});

// Outlook OAuth2 - Get authorization URL
router.get('/oauth/outlook/auth', async (req, res) => {
  try {
    const authUrl = OutlookOAuthService.getAuthUrl(req.user!.id);
    res.json({ authUrl });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error generating Outlook auth URL');
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
});

// Outlook OAuth2 - Handle callback (GET for OAuth redirect with query params)
router.get('/oauth/outlook/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) {
      return res.status(400).send('<html><body>Missing authorization code</body></html>');
    }

    const result = await OutlookOAuthService.handleCallback(code, req.user!.id);

    const success = !!result.success;
    const msg = success ? 'Outlook account connected successfully' : (result.error || 'Failed to connect Outlook account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Outlook OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OUTLOOK_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error handling Outlook callback (GET)');
    res.status(500).send('<html><body>Failed to process Outlook authorization</body></html>');
  }
});

// Outlook OAuth2 - Handle callback (legacy POST support)
router.post('/oauth/outlook/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const result = await OutlookOAuthService.handleCallback(code, req.user!.id);
    
    if (result.success) {
      res.json({ 
        success: true, 
        account: result.account,
        message: 'Outlook account connected successfully' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error || 'Failed to connect Outlook account' 
      });
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Error handling Outlook callback');
    res.status(500).json({ message: 'Failed to process Outlook authorization' });
  }
});

// EMAIL ACCOUNT ROUTES

// Get user's email accounts
router.get('/email-accounts', async (req, res) => {
  try {
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.userId, req.user!.id),
      orderBy: [desc(emailAccounts.isDefault), desc(emailAccounts.createdAt)],
    });

    // Don't return sensitive data
    const safeAccounts = accounts.map(account => ({
      ...account,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    }));

    res.json(safeAccounts);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching email accounts');
    res.status(500).json({ message: 'Failed to fetch email accounts' });
  }
});

// Create email account
router.post('/email-accounts', conditionalCSRF, async (req, res) => {
  try {
    const accountData = insertEmailAccountSchema.parse({
      ...req.body,
      userId: req.user!.id,
    });

    // If this is the first account or marked as default, make it default
    if (accountData.isDefault) {
      // Remove default from other accounts
      await db.update(emailAccounts)
        .set({ isDefault: false })
        .where(eq(emailAccounts.userId, req.user!.id));
    }

    const [newAccount] = await db.insert(emailAccounts).values(accountData).returning();

    // Don't return sensitive data
    const safeAccount = {
      ...newAccount,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    };

    res.status(201).json(safeAccount);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error creating email account');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create email account' });
  }
});

// Update email account
router.patch('/email-accounts/:id', conditionalCSRF, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = insertEmailAccountSchema.partial().parse(req.body);

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // If setting as default, remove default from other accounts
    if (updateData.isDefault) {
      await db.update(emailAccounts)
        .set({ isDefault: false })
        .where(and(
          eq(emailAccounts.userId, req.user!.id),
          sql`${emailAccounts.id} != ${id}`
        ));
    }

    const [updatedAccount] = await db
      .update(emailAccounts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(emailAccounts.id, id))
      .returning();

    // Don't return sensitive data
    const safeAccount = {
      ...updatedAccount,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    };

    res.json(safeAccount);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating email account');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update email account' });
  }
});

// Delete email account
router.delete('/email-accounts/:id', conditionalCSRF, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    await db.delete(emailAccounts).where(eq(emailAccounts.id, id));

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error deleting email account');
    res.status(500).json({ message: 'Failed to delete email account' });
  }
});

// Test email account connection
router.post('/email-accounts/:id/test', conditionalCSRF, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Test connection using multi-account service
    const testResult = await MultiAccountEmailService.testAccountConnection(id);
    
    res.json({ 
      success: testResult.success, 
      message: testResult.success ? 'Connection test successful' : testResult.error,
      provider: account.provider 
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error testing email account');
    res.status(500).json({ message: 'Failed to test email account' });
  }
});

// Sync emails from account
router.post('/email-accounts/:id/sync', conditionalCSRF, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ message: 'Account is not active' });
    }

    // Sync emails using multi-account service
    const syncResult = await EmailSyncService.syncAccountOnDemand(id, req.user!.id);
    
    if (syncResult.success) {
      res.json({ 
        success: true,
        message: `Synced ${syncResult.syncedCount} new emails`,
        syncedCount: syncResult.syncedCount,
        lastSyncAt: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: syncResult.error || 'Sync failed'
      });
    }
  } catch (error) {
    logger.error({ error: String(error) }, 'Error syncing emails');
    res.status(500).json({ 
      message: 'Failed to sync emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get account mailboxes
router.get('/email-accounts/:id/mailboxes', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Get mailboxes
    const mailboxes = await ImapService.getMailboxes(account as any);
    
    res.json({ mailboxes });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error getting mailboxes');
    res.status(500).json({ message: 'Failed to get mailboxes' });
  }
});

// Sync management routes
router.get('/sync/status', async (req, res) => {
  try {
    const status = EmailSyncService.getSyncStatus();
    res.json(status);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error getting sync status');
    res.status(500).json({ message: 'Failed to get sync status' });
  }
});

router.post('/sync/start', conditionalCSRF, async (req, res) => {
  try {
    await EmailSyncService.startBackgroundSync();
    res.json({ message: 'Background sync started successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error starting background sync');
    res.status(500).json({ message: 'Failed to start background sync' });
  }
});

router.post('/sync/stop', conditionalCSRF, async (req, res) => {
  try {
    await EmailSyncService.stopBackgroundSync();
    res.json({ message: 'Background sync stopped successfully' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error stopping background sync');
    res.status(500).json({ message: 'Failed to stop background sync' });
  }
});

router.get('/email-accounts/:id/sync-stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    const stats = await EmailSyncService.getAccountSyncStats(id);
    res.json(stats);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error getting sync stats');
    res.status(500).json({ message: 'Failed to get sync stats' });
  }
});

// EMAIL ROUTES

// Search emails with optimized search service
router.get('/emails/search', async (req, res) => {
  try {
    const { q, page = '1', limit = '50', offset = '0', accountId } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    // Support both page-based and offset-based pagination
    const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per request
    const offsetNum = offset !== '0' ? parseInt(offset as string) : (parseInt(page as string) - 1) * limitNum;
    
    // Use the optimized EmailSearchService
    const searchOptions = {
      query: q,
      accountIds: accountId ? [accountId as string] : undefined,
      limit: limitNum,
      offset: offsetNum
    };
    
    const searchResult = await EmailSearchService.searchEmails(req.user!.id, searchOptions);
    
    // Get unique thread IDs from search results
    const threadIds = [...new Set(searchResult.messages.map(m => m.threadId))];
    
    // Get thread info for these messages with preview
    const threads = threadIds.length > 0 ? await db.query.emailThreads.findMany({
      where: and(
        eq(emailThreads.createdBy, req.user!.id),
        sql`${emailThreads.id} = ANY(ARRAY[${sql.join(threadIds.map(id => sql`${id}`), sql`, `)}])`
      ),
      with: {
        messages: {
          limit: 1,
          orderBy: [desc(emailMessages.sentAt)]
        }
      }
    }) : [];
    
    // Add preview to threads
    const threadsWithPreview = threads.map(thread => {
      const latestMessage = thread.messages?.[0];
      let preview = '';
      if (latestMessage) {
        const text = latestMessage.textBody || latestMessage.htmlBody?.replace(/<[^>]*>/g, '') || '';
        preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');
      }
      return { ...thread, preview };
    });
    
    const hasMore = (offsetNum + limitNum) < searchResult.totalCount;
    res.json({ 
      threads: threadsWithPreview, 
      total: searchResult.totalCount,
      nextCursor: hasMore ? offsetNum + limitNum : undefined,
      searchTime: searchResult.searchTime,
      suggestions: searchResult.suggestions || []
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error searching emails');
    res.status(500).json({ message: 'Failed to search emails', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get email threads with optimized query and pagination metadata
router.get('/emails/threads', async (req, res) => {
  try {
    const { type = 'inbox', page = '1', limit = '50', offset = '0', accountId } = req.query;
    
    // Support both page-based and offset-based pagination
    const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per request
    const offsetNum = offset !== '0' ? parseInt(offset as string) : (parseInt(page as string) - 1) * limitNum;
    
    let whereConditions: any[] = [eq(emailThreads.createdBy, req.user!.id)];
    
    // Add conditions based on email type
    if (type === 'archived') {
      whereConditions.push(eq(emailThreads.isArchived, true));
    } else if (type === 'sent') {
      // For sent emails, get threads where the latest message is from user
      whereConditions.push(eq(emailThreads.isArchived, false));
    } else if (type === 'drafts') {
      // Drafts are handled separately
      return res.json([]);
    } else {
      // inbox - not archived
      whereConditions.push(or(
        eq(emailThreads.isArchived, false),
        sql`${emailThreads.isArchived} IS NULL`
      )!);
    }
    
    // Filter by account if specified
    if (accountId && accountId !== 'null') {
      whereConditions.push(sql`EXISTS (
        SELECT 1 FROM email_messages m 
        WHERE m.thread_id = ${emailThreads.id} 
        AND m.email_account_id = ${accountId}
      )`);
    }

    const whereClause = and(...whereConditions);

    // OPTIMIZED: Run count and data queries in parallel for faster response
    const [countResult, threads] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(emailThreads)
        .where(whereClause),
      // Use a single optimized query instead of N+1 with relations
      db.select({
        id: emailThreads.id,
        subject: emailThreads.subject,
        participantEmails: emailThreads.participantEmails,
        lastMessageAt: emailThreads.lastMessageAt,
        messageCount: emailThreads.messageCount,
        isArchived: emailThreads.isArchived,
        labels: emailThreads.labels,
        createdAt: emailThreads.createdAt,
        // Get the latest message data in a single query using LATERAL join
        latestFromEmail: sql<string>`(
          SELECT from_email FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestSubject: sql<string>`(
          SELECT subject FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestSentAt: sql<Date>`(
          SELECT sent_at FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestIsRead: sql<boolean>`(
          SELECT is_read FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestIsStarred: sql<boolean>`(
          SELECT is_starred FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestTextBody: sql<string>`(
          SELECT text_body FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
        latestHtmlBody: sql<string>`(
          SELECT html_body FROM email_messages m
          WHERE m.thread_id = ${emailThreads.id}
          ORDER BY m.sent_at DESC LIMIT 1
        )`,
      })
      .from(emailThreads)
      .where(whereClause)
      .orderBy(desc(emailThreads.lastMessageAt))
      .limit(limitNum)
      .offset(offsetNum)
    ]);

    const totalCount = countResult[0]?.count || 0;

    // Transform the optimized query results into the expected format
    const threadsWithPreview = threads.map((thread: any) => {
      // Generate preview from latest message
      const text = thread.latestTextBody || thread.latestHtmlBody?.replace(/<[^>]*>/g, '') || '';
      const preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');

      return {
        id: thread.id,
        subject: thread.subject,
        participantEmails: thread.participantEmails,
        lastMessageAt: thread.lastMessageAt,
        messageCount: thread.messageCount,
        isArchived: thread.isArchived,
        labels: thread.labels,
        createdAt: thread.createdAt,
        preview,
        // Include latest message info for UI
        messages: thread.latestFromEmail ? [{
          id: '', // Not needed for list view
          fromEmail: thread.latestFromEmail,
          subject: thread.latestSubject,
          sentAt: thread.latestSentAt,
          isRead: thread.latestIsRead,
          isStarred: thread.latestIsStarred,
          messageType: 'received' as const,
        }] : []
      };
    });

    // Support both old and new response formats
    const hasMore = (offsetNum + limitNum) < totalCount;
    res.json({
      threads: threadsWithPreview,
      total: totalCount,
      nextCursor: hasMore ? offsetNum + limitNum : undefined,
      // Legacy pagination for backward compatibility
      pagination: {
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        total: totalCount,
        hasMore
      }
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching email threads');
    res.status(500).json({ message: 'Failed to fetch email threads', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get total unread messages count for inbox and per-account breakdown
router.get('/emails/unread-count', async (req, res) => {
  try {
    const { emailMessages, emailThreads, emailAccounts } = await import('@shared/schema');

    // Total unread messages for non-archived threads
    const totalResult = await db.select({ count: sql`COUNT(*)` }).from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.isRead, false),
        sql`EXISTS (select 1 from email_threads t where t.id = ${emailMessages.threadId} and t.created_by = ${req.user!.id} and (t.is_archived = FALSE or t.is_archived IS NULL))`
      ));

    const totalRow: any = totalResult && totalResult[0];
    const rawTotal = totalRow?.count ?? 0;
    const totalUnread = typeof rawTotal === 'string' ? parseInt(rawTotal, 10) : Number(rawTotal || 0);

    // Per-account unread counts
    // Group by email_account_id
    const perAccountRows: any[] = await db.select({ accountId: emailMessages.emailAccountId, count: sql`COUNT(*)` })
      .from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.isRead, false),
        sql`EXISTS (select 1 from email_threads t where t.id = ${emailMessages.threadId} and t.created_by = ${req.user!.id} and (t.is_archived = FALSE or t.is_archived IS NULL))`
      ))
      .groupBy(emailMessages.emailAccountId);

    // Map to include account metadata
    const accountIds = perAccountRows.map(r => r.accountId).filter(Boolean);
    let accountsById: Record<string, any> = {};
    if (accountIds.length > 0) {
      // Fetch all accounts for the user and map locally to avoid driver-specific 'in' helpers
      const accountRows = await db.select().from(emailAccounts).where(eq(emailAccounts.userId, req.user!.id));
      accountsById = (accountRows || []).reduce((acc: any, a: any) => ({ ...acc, [a.id]: a }), {});
    }

    const perAccount = perAccountRows.map((r: any) => {
      const raw = r.count;
      const c = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw || 0);
      const acct = r.accountId ? accountsById[r.accountId] : null;
      return {
        accountId: r.accountId || null,
        accountName: acct?.accountName || acct?.emailAddress || null,
        emailAddress: acct?.emailAddress || null,
        unreadCount: c,
      };
    });

    res.json({ unreadCount: totalUnread, perAccount });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching unread count');
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// Get messages in a thread - OPTIMIZED with timeout
router.get('/emails/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;

    // Verify thread ownership first
    const thread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.createdBy, req.user!.id)
      ),
      columns: { id: true }
    });

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    // Fetch messages with timeout protection
    const messages = await queryWithTimeout(
      () => db.query.emailMessages.findMany({
        where: eq(emailMessages.threadId, threadId),
        with: {
          attachments: {
            columns: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              // Don't fetch fileContent for performance
            }
          }
        },
        orderBy: [asc(emailMessages.sentAt)],
      }),
      8000 // 8 second timeout
    );

    res.json(messages);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching messages');
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Mark message as read/unread
router.patch('/emails/messages/:messageId/read', conditionalCSRF, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { isRead } = req.body;
    
    if (typeof isRead !== 'boolean') {
      return res.status(400).json({ message: 'isRead must be a boolean' });
    }
    
    // Verify ownership through thread
    const message = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.id, messageId),
      with: {
        thread: true
      }
    });
    
    if (!message || message.createdBy !== req.user!.id) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    const [updatedMessage] = await db
      .update(emailMessages)
      .set({ isRead, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId))
      .returning();
    
    res.json(updatedMessage);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating message read status');
    res.status(500).json({ message: 'Failed to update message' });
  }
});

// Mark all messages in thread as read
router.patch('/emails/threads/:threadId/read', conditionalCSRF, async (req, res) => {
  try {
    const { threadId } = req.params;
    
    // Verify ownership
    const thread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.createdBy, req.user!.id)
      )
    });
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    // Mark all messages in thread as read
    await db
      .update(emailMessages)
      .set({ isRead: true, updatedAt: new Date() })
      .where(eq(emailMessages.threadId, threadId));
    
    res.json({ message: 'All messages marked as read' });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error marking thread as read');
    res.status(500).json({ message: 'Failed to mark thread as read' });
  }
});

// Star/unstar message
router.patch('/emails/messages/:messageId/star', conditionalCSRF, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { isStarred } = req.body;
    
    if (typeof isStarred !== 'boolean') {
      return res.status(400).json({ message: 'isStarred must be a boolean' });
    }
    
    // Verify ownership
    const message = await db.query.emailMessages.findFirst({
      where: eq(emailMessages.id, messageId)
    });
    
    if (!message || message.createdBy !== req.user!.id) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    const [updatedMessage] = await db
      .update(emailMessages)
      .set({ isStarred, updatedAt: new Date() })
      .where(eq(emailMessages.id, messageId))
      .returning();
    
    res.json(updatedMessage);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error updating message star status');
    res.status(500).json({ message: 'Failed to update message' });
  }
});

// Archive/unarchive thread
router.patch('/emails/threads/:threadId/archive', conditionalCSRF, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { isArchived } = req.body;
    
    if (typeof isArchived !== 'boolean') {
      return res.status(400).json({ message: 'isArchived must be a boolean' });
    }
    
    // Verify ownership
    const thread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.createdBy, req.user!.id)
      )
    });
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    const [updatedThread] = await db
      .update(emailThreads)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(emailThreads.id, threadId))
      .returning();
    
    res.json(updatedThread);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error archiving thread');
    res.status(500).json({ message: 'Failed to archive thread' });
  }
});

// Check email deliverability (spam score)
router.post('/emails/check-deliverability', conditionalCSRF, async (req, res) => {
  try {
    const { subject, htmlBody, textBody, fromEmail } = req.body;
    
    if (!subject || !htmlBody || !fromEmail) {
      return res.status(400).json({ message: 'Subject, body, and from email are required' });
    }

    // Sanitize HTML
    const sanitizedHtml = EmailDeliverabilityService.sanitizeHtmlForEmail(htmlBody);

    // Check spam score
    const spamCheck = EmailDeliverabilityService.checkSpamScore(
      subject,
      sanitizedHtml,
      textBody || '',
      fromEmail
    );

    // Get provider-specific tips
    const fromDomain = fromEmail.split('@')[1];
    const isGmail = fromDomain?.includes('gmail');
    const isOutlook = fromDomain?.includes('outlook') || fromDomain?.includes('hotmail');
    const provider = isGmail ? 'gmail' : isOutlook ? 'outlook' : 'smtp';

    // Generate full report
    const report = EmailDeliverabilityService.generateDeliverabilityReport(
      spamCheck,
      fromDomain || '',
      provider
    );

    res.json({
      spamScore: spamCheck.score,
      isSafe: spamCheck.isSafe,
      issues: spamCheck.issues,
      recommendations: spamCheck.recommendations,
      sanitizedHtml,
      report
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error checking deliverability');
    res.status(500).json({ message: 'Failed to check deliverability' });
  }
});

// Validate recipient email
router.post('/emails/validate-recipient', conditionalCSRF, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const validation = EmailDeliverabilityService.validateRecipientEmail(email);
    res.json(validation);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error validating recipient');
    res.status(500).json({ message: 'Failed to validate recipient' });
  }
});

// Get email sending rate limits and usage
router.get('/emails/rate-limits', async (req, res) => {
  try {
    const stats = EmailRateLimiter.getUsageStats(req.user!.id);
    res.json(stats);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error getting rate limits');
    res.status(500).json({ message: 'Failed to get rate limits' });
  }
});

// Send email
router.post('/emails/send', conditionalCSRF, emailRateLimiter, upload.array('attachments'), async (req, res) => {
  try {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      htmlBody,
      textBody,
      threadId,
      accountId, // New: specify which account to send from
    } = req.body;

    // Parse recipients
    const toEmails = Array.isArray(to) ? to : [to];
    const ccEmails = Array.isArray(cc) ? cc : (cc ? [cc] : []);
    const bccEmails = Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []);

    // Validate recipients
    const invalidRecipients: string[] = [];
    [...toEmails, ...ccEmails, ...bccEmails].forEach(email => {
      const validation = EmailDeliverabilityService.validateRecipientEmail(email);
      if (!validation.isValid) {
        invalidRecipients.push(email);
      }
    });

    if (invalidRecipients.length > 0) {
      return res.status(400).json({ 
        message: 'Invalid recipient email addresses',
        invalidRecipients
      });
    }

    // Get sending account (use specified or default) - MOVED BEFORE USAGE
    let sendingAccount;
    if (accountId) {
      sendingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, req.user!.id)
        )
      });
    } else {
      sendingAccount = await MultiAccountEmailService.getDefaultAccount(req.user!.id);
    }

    // Check rate limit FIRST to prevent spam behavior
    const provider = sendingAccount?.provider || 'smtp';
    const rateLimitCheck = EmailRateLimiter.canSendEmail(
      req.user!.id, 
      provider as 'gmail' | 'outlook' | 'smtp'
    );

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        message: 'Rate limit exceeded',
        error: rateLimitCheck.reason,
        resetAt: rateLimitCheck.resetAt,
        remaining: rateLimitCheck.remaining
      });
    }

    // Check spam score before sending (CRITICAL - Prevent spam)
    const fromEmail = sendingAccount?.emailAddress || req.user!.email;
    const spamCheck = EmailDeliverabilityService.checkSpamScore(
      subject || '',
      htmlBody || '',
      textBody || '',
      fromEmail
    );

    // BLOCK sending if spam score is too high
    if (spamCheck.score >= 7) {
      return res.status(400).json({
        message: 'Email blocked: High spam score detected',
        spamScore: spamCheck.score,
        issues: spamCheck.issues,
        recommendations: spamCheck.recommendations,
        error: 'Your email has a very high spam score and will likely be marked as spam. Please review and fix the issues before sending.'
      });
    }

    // Warn if spam score is moderate
    if (spamCheck.score >= 5) {
      logger.warn(`⚠️ Email has moderate spam score: ${spamCheck.score}/10`);
      logger.warn({ issues: spamCheck.issues.map(i => String(i)) }, 'Spam check issues');
    }

    // Sanitize HTML to prevent spam issues
    const sanitizedHtmlBody = EmailDeliverabilityService.sanitizeHtmlForEmail(htmlBody || '');

    // Ensure plain text version exists (REQUIRED for deliverability)
    const finalTextBody = textBody || sanitizedHtmlBody.replace(/<[^>]*>/g, '').trim();
    
    if (!finalTextBody || finalTextBody.length < 10) {
      return res.status(400).json({
        message: 'Email must have substantial text content (at least 10 characters)',
        error: 'Add more content to your email to improve deliverability'
      });
    }

    // Handle attachments
    const files = req.files as Express.Multer.File[];
    const attachmentData = files?.map(file => ({
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileContent: file.buffer.toString('base64'),
    })) || [];

    let finalThreadId = threadId;

    // Create thread if not provided
    if (!threadId) {
      const [newThread] = await db.insert(emailThreads).values({
        subject,
        participantEmails: [sendingAccount?.emailAddress || req.user!.email, ...toEmails],
        lastMessageAt: new Date(),
        messageCount: 0,
        createdBy: req.user!.id,
      }).returning();
      
      finalThreadId = newThread.id;
    }

    // Get recommended headers for better deliverability
    const recommendedHeaders = EmailDeliverabilityService.getRecommendedHeaders(
      sendingAccount?.emailAddress || req.user!.email,
      toEmails[0] || '',
      subject || ''
    );

    // Create message record
    const [message] = await db.insert(emailMessages).values({
      threadId: finalThreadId,
      emailAccountId: sendingAccount?.id,
      fromEmail: sendingAccount?.emailAddress || req.user!.email,
      toEmails,
      ccEmails,
      bccEmails,
      subject,
      htmlBody: sanitizedHtmlBody,
      textBody: finalTextBody,
      messageType: 'sent',
      sentAt: new Date(),
      createdBy: req.user!.id,
    }).returning();

    // Save attachments
    if (attachmentData.length > 0) {
      await db.insert(emailAttachments).values(
        attachmentData.map(att => ({
          messageId: message.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          fileContent: att.fileContent,
        }))
      );
    }

    // Send email using multi-account service
    let sendResult: { success: boolean; messageId?: string; error?: string } = { success: false, error: 'No account configured' };
    
    if (sendingAccount) {
      sendResult = await MultiAccountEmailService.sendFromAccount(sendingAccount.id, {
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject,
        htmlBody: sanitizedHtmlBody,
        textBody: finalTextBody,
        headers: recommendedHeaders,
        attachments: files?.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        })),
      });
    } else {
      // Fallback to original SMTP service
      try {
        await EmailService.sendMarketingEmail(
          toEmails[0] || '',
          subject || 'No Subject',
          sanitizedHtmlBody || '',
          textBody || ''
        );
        sendResult = { success: true };
      } catch (smtpError) {
        sendResult = { success: false, error: 'SMTP fallback failed' };
      }
    }

    if (sendResult.success) {
      logger.info('✅ Email sent successfully');
      
      // Record email sent for rate limiting
      EmailRateLimiter.recordEmailSent(
        req.user!.id,
        provider as 'gmail' | 'outlook' | 'smtp'
      );
    } else {
      logger.warn({ context: sendResult.error }, '⚠️ Email sending failed, but message saved:');
    }

    // Update thread
    await db.update(emailThreads)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${emailThreads.messageCount} + 1`,
      })
      .where(eq(emailThreads.id, finalThreadId));

    res.status(201).json({
      message: sendResult.success ? 'Email sent successfully' : 'Email saved but sending failed',
      messageId: message.id,
      threadId: finalThreadId,
      sendResult,
    });
  } catch (error) {
    logger.error({ error: String(error) }, 'Error sending email');
    res.status(500).json({ message: 'Failed to send email' });
  }
});
// Save draft
router.post('/emails/drafts', conditionalCSRF, async (req, res) => {
  try {
    const { to, cc, bcc, subject, htmlBody, textBody } = req.body;
    
    // Create draft message without thread
    const [draftMessage] = await db.insert(emailMessages).values({
      threadId: '', // Will be set when sent
      fromEmail: req.user!.email,
      toEmails: to || [],
      ccEmails: cc || [],
      bccEmails: bcc || [],
      subject: subject || 'No Subject',
      htmlBody,
      textBody,
      messageType: 'draft',
      createdBy: req.user!.id
    }).returning();

    res.status(201).json(draftMessage);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error saving draft');
    res.status(500).json({ message: 'Failed to save draft' });
  }
});

// Get drafts
router.get('/emails/drafts', async (req, res) => {
  try {
    const drafts = await db.query.emailMessages.findMany({
      where: and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.messageType, 'draft')
      ),
      orderBy: [desc(emailMessages.createdAt)],
    });

    res.json(drafts);
  } catch (error) {
    logger.error({ error: String(error) }, 'Error fetching drafts');
    res.status(500).json({ message: 'Failed to fetch drafts' });
  }
});

// (Duplicate DELETE /emails/threads/:threadId removed to avoid conflicting handlers)

// REPORTS ROUTES REMOVED

export default router;