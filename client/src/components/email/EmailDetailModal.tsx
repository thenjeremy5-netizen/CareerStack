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
  messages: EmailMessage[];  // Changed from single message to array for full thread
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
  messages,
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
  // Get the latest message for subject and quick actions
  const latestMessage = messages[messages.length - 1];
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!open || !latestMessage) return;

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
            onReply(latestMessage);
          }
          break;
        case 'a':
          if (e.shiftKey && onReplyAll) {
            e.preventDefault();
            onReplyAll(latestMessage);
          }
          break;
        case 'f':
          if (onForward) {
            e.preventDefault();
            onForward(latestMessage);
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
          onStarToggle(latestMessage.id, !latestMessage.isStarred);
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
  }, [open, latestMessage, onClose, onReply, onReplyAll, onForward, onArchive, onStarToggle, onNext, onPrevious, hasNext, hasPrevious]);

  if (!latestMessage || messages.length === 0) return null;

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
                  onClick={() => onReply(latestMessage)}
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
                    onClick={() => onReplyAll(latestMessage)}
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
                    onClick={() => onForward(latestMessage)}
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
                    latestMessage.isStarred ? "text-yellow-500 hover:bg-yellow-50" : "hover:bg-gray-100"
                  )}
                  onClick={() => onStarToggle(latestMessage.id, !latestMessage.isStarred)}
                >
                  <Star className={cn("h-5 w-5", latestMessage.isStarred && "fill-yellow-500")} />
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
            <div className="mb-6">
              <h1 className="text-3xl font-semibold text-gray-900 leading-tight">
                {latestMessage.subject || '(no subject)'}
              </h1>
              {messages.length > 1 && (
                <Badge variant="secondary" className="mt-2">
                  {messages.length} messages in this conversation
                </Badge>
              )}
            </div>

            {/* All Messages in Thread (Email Trail) */}
            <div className="space-y-6">
              {messages.map((message, index) => {
                const isLatest = index === messages.length - 1;
                
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-xl border transition-all",
                      isLatest 
                        ? "border-blue-200 bg-gradient-to-br from-blue-50/50 to-white shadow-md" 
                        : "border-gray-200 bg-white hover:shadow-sm"
                    )}
                  >
                    {/* Message Header */}
                    <div className="flex items-start gap-4 p-6 pb-4 border-b border-gray-100">
                      <Avatar className={cn(
                        "ring-2",
                        isLatest ? "h-14 w-14 ring-blue-100" : "h-12 w-12 ring-gray-100"
                      )}>
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white text-lg font-semibold">
                          {getInitials(message.fromEmail)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={cn(
                              "font-semibold text-gray-900",
                              isLatest ? "text-lg" : "text-base"
                            )}>
                              {message.fromEmail.split('@')[0]}
                            </span>
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50">
                              {message.fromEmail.split('@')[1]}
                            </Badge>
                            {isLatest && (
                              <Badge className="bg-blue-600 text-white text-xs">
                                Latest
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {message.sentAt && format(new Date(message.sentAt), 'MMM d, yyyy • h:mm a')}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    "transition-colors p-1 rounded-full hover:bg-gray-100",
                                    message.isStarred ? "text-yellow-500" : "text-gray-400"
                                  )}
                                  onClick={() => onStarToggle(message.id, !message.isStarred)}
                                >
                                  <Star className={cn("h-4 w-4", message.isStarred && "fill-yellow-500")} />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Star this message</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">To:</span>
                            <span className="truncate">{message.toEmails.join(', ')}</span>
                          </div>
                          {message.ccEmails && message.ccEmails.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Cc:</span>
                              <span className="truncate">{message.ccEmails.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="px-6 py-4">
                      <div className={cn(
                        "prose max-w-none",
                        isLatest ? "prose-lg" : "prose-base"
                      )}>
                        <EmailContent htmlBody={message.htmlBody} textBody={message.textBody} />
                      </div>

                      {/* Attachments for this message */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-100">
                          <div className="flex items-center gap-3 mb-4">
                            <Paperclip className="h-5 w-5 text-blue-600" />
                            <h4 className="text-sm font-semibold text-gray-900">
                              {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
                            </h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {message.attachments.map((attachment, idx) => (
                              <div
                                key={idx}
                                className="group flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all"
                              >
                                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                  <FileText className="h-5 w-5 text-white" />
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
                                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Download className="h-4 w-4 text-blue-600" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Reply Section */}
            <div className="mt-10 pt-8 border-t">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => onReply(latestMessage)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                {onReplyAll && (
                  <Button
                    onClick={() => onReplyAll(latestMessage)}
                    variant="outline"
                    className="border-2 hover:border-blue-400 hover:bg-blue-50"
                  >
                    <ReplyAll className="h-4 w-4 mr-2" />
                    Reply All
                  </Button>
                )}
                {onForward && (
                  <Button
                    onClick={() => onForward(latestMessage)}
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
