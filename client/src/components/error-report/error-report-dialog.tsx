import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Upload } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ErrorReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  error?: Error;
  componentStack?: string;
}

export function ErrorReportDialog({
  isOpen,
  onClose,
  error,
  componentStack,
}: ErrorReportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      // Only allow images
      const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
      setFiles((prev) => [...prev, ...imageFiles]);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // First upload any screenshots
      const screenshotUrls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/uploads/error-screenshots', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to upload screenshot');
        const data = await response.json();
        screenshotUrls.push(data.url);
      }

      // Submit error report
      await apiRequest('POST', '/api/error-reports', {
        errorMessage: error?.message || 'Unknown error',
        errorStack: error?.stack,
        componentStack,
        userDescription: description,
        screenshotUrls,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });

      toast({
        title: 'Error report sent',
        description: 'Thank you for reporting this issue. Our team will look into it.',
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit error report:', err);
      toast({
        title: 'Failed to send report',
        description: 'Please try again or contact support directly.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Report Error</DialogTitle>
          <DialogDescription>
            Help us improve by describing what happened when the error occurred.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              What were you doing when this error occurred?
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide any additional details that might help us understand and fix the issue..."
              className="h-24"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Screenshots (optional)</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add Screenshots
              </Button>
              <Input
                id="file-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {files.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {files.length} image{files.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!description.trim() || isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
