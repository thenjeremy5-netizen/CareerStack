/**
 * ComposeDialog Component
 * 
 * Lazy-loaded compose email dialog.
 * Extracted from the main EmailClient to reduce initial bundle size.
 * 
 * TODO: This is a simplified version. The full implementation with
 * rich text editor, attachments, etc. should be migrated here.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, X } from 'lucide-react';

interface ComposeDialogProps {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  attachments: File[];
  isDragActive?: boolean;
  getRootProps?: any;
  getInputProps?: any;
  onClose: () => void;
  onDiscard: () => void;
  onToChange: (to: string) => void;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onSend: () => void;
  onRemoveAttachment: (index: number) => void;
  onEmojiClick?: () => void;
  onScheduleClick?: () => void;
  onInsertLink?: () => void;
  onInsertImage?: () => void;
  isSending: boolean;
}

function ComposeDialog({
  open,
  onClose,
  to,
  subject,
  body,
  attachments,
  onToChange,
  onSubjectChange,
  onBodyChange,
  onSend,
  onRemoveAttachment,
  isSending,
}: ComposeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">To</label>
            <Input
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Subject</label>
            <Input
              placeholder="Email subject"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Message</label>
            <textarea
              className="w-full min-h-[200px] p-3 border rounded-md"
              placeholder="Compose your message..."
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
            />
          </div>

          {attachments.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Attachments</label>
              <div className="space-y-1">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={onSend} disabled={isSending || !to || !subject}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ComposeDialog };
export default ComposeDialog;
