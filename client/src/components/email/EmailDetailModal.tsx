/**
 * EmailDetailModal Component
 * 
 * Modern, spacious email reading experience in a modal overlay.
 * Features:
 * - Full-screen modal with focused reading experience
 * - Quick actions (Reply, Forward, Archive, Delete, Star)
 * - Keyboard shortcuts
 * - Beautiful animations
 * - Attachments display
 * - Navigation between emails
 */

import React, { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X, Reply, Forward, Archive, Trash2, Star, MoreVertical,
  Paperclip, Download, FileText, ChevronLeft, ChevronRight,
  ArrowLeft, ReplyAll, Printer, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { EmailMessage } from '@/types/email';
import { EmailContent } from './email-content';

interface EmailDetailModalProps {
  open: boolean;
  message: EmailMessage | null;
  onClose: () => void;
  onReply: (message: EmailMessage) => void;
  onReplyAll?: (message: EmailMessage) => void;
  onForward?: (message: EmailMessage) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onStarToggle: (messageId: string, isStarred: boolean) => void;
  getInitials: (email: string) => string;
  // Navigation
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

function EmailDetailModal({
  open,
  message,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onStarToggle,
  getInitials,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
}: EmailDetailModalProps) {
  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !message) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'escape':
          onClose();
          break;
        case 'r':
          if (!e.shiftKey) {
            e.preventDefault();
            onReply(message);
          }
          break;
        case 'a':
          if (e.shiftKey && onReplyAll) {
            e.preventDefault();
            onReplyAll(message);
          }
          break;
        case 'f':
          if (onForward) {
            e.preventDefault();
            onForward(message);
          }
          break;
        case 'e':
          if (onArchive) {
            e.preventDefault();
            onArchive();
          }
          break;
        case 's':
          e.preventDefault();
          onStarToggle(message.id, !message.isStarred);
          break;
        case 'arrowleft':
          if (hasPrevious && onPrevious) {
            e.preventDefault();
            onPrevious();
          }
          break;
        case 'arrowright':
          if (hasNext && onNext) {
            e.preventDefault();
            onNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [open, message, onClose, onReply, onReplyAll, onForward, onArchive, onStarToggle, onNext, onPrevious, hasNext, hasPrevious]);

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={onClose}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to inbox (Esc)</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={onPrevious}
                    disabled={!hasPrevious}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous email (←)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={onNext}
                    disabled={!hasNext}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next email (→)</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-blue-50"
                  onClick={() => onReply(message)}
                >
                  <Reply className="h-5 w-5 text-blue-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reply (R)</TooltipContent>
            </Tooltip>

            {onReplyAll && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-blue-50"
                    onClick={() => onReplyAll(message)}
                  >
                    <ReplyAll className="h-5 w-5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reply all (Shift+A)</TooltipContent>
              </Tooltip>
            )}

            {onForward && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-blue-50"
                    onClick={() => onForward(message)}
                  >
                    <Forward className="h-5 w-5 text-blue-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Forward (F)</TooltipContent>
              </Tooltip>
            )}

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full transition-colors",
                    message.isStarred ? "text-yellow-500 hover:bg-yellow-50" : "hover:bg-gray-100"
                  )}
                  onClick={() => onStarToggle(message.id, !message.isStarred)}
                >
                  <Star className={cn("h-5 w-5", message.isStarred && "fill-yellow-500")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Star (S)</TooltipContent>
            </Tooltip>

            {onArchive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-green-50"
                    onClick={onArchive}
                  >
                    <Archive className="h-5 w-5 text-green-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Archive (E)</TooltipContent>
              </Tooltip>
            )}

            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-red-50"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Printer className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>More options</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Email Content */}
        <ScrollArea className="flex-1">
          <div className="px-8 py-6">
            {/* Subject */}
            <h1 className="text-3xl font-semibold text-gray-900 mb-6 leading-tight">
              {message.subject || '(no subject)'}
            </h1>

            {/* Sender Info */}
            <div className="flex items-start gap-4 mb-8 pb-6 border-b">
              <Avatar className="h-14 w-14 ring-2 ring-gray-100">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white text-lg font-semibold">
                  {getInitials(message.fromEmail)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-semibold text-gray-900">
                      {message.fromEmail.split('@')[0]}
                    </span>
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50">
                      {message.fromEmail.split('@')[1]}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-500">
                    {message.sentAt && format(new Date(message.sentAt), 'MMM d, yyyy • h:mm a')}
                  </span>
                </div>

                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">To:</span>
                    <span>{message.toEmails.join(', ')}</span>
                  </div>
                  {message.ccEmails && message.ccEmails.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Cc:</span>
                      <span>{message.ccEmails.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div className="prose prose-lg max-w-none mb-8">
              <EmailContent htmlBody={message.htmlBody} textBody={message.textBody} />
            </div>

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-8 pt-8 border-t">
                <div className="flex items-center gap-3 mb-4">
                  <Paperclip className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {message.attachments.map((attachment, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-900 group-hover:text-blue-600">
                          {attachment.fileName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Reply Section */}
            <div className="mt-10 pt-8 border-t">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => onReply(message)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                {onReplyAll && (
                  <Button
                    onClick={() => onReplyAll(message)}
                    variant="outline"
                    className="border-2 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <ReplyAll className="h-4 w-4 mr-2" />
                    Reply All
                  </Button>
                )}
                {onForward && (
                  <Button
                    onClick={() => onForward(message)}
                    variant="outline"
                    className="border-2 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export { EmailDetailModal };
export default EmailDetailModal;
