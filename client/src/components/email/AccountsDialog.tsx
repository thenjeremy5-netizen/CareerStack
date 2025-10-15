/**
 * AccountsDialog Component
 * 
 * Lazy-loaded accounts management dialog.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Trash2 } from 'lucide-react';
import { EmailAccount } from '@/types/email';

interface AccountsDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
  onConnectGmail: () => void;
  onConnectOutlook: () => void;
  onRemoveAccount: (accountId: string, accountName: string) => void;
  getInitials: (email: string) => string;
}

export default function AccountsDialog({
  open,
  onClose,
  accounts,
  onConnectGmail,
  onConnectOutlook,
  onRemoveAccount,
  getInitials,
}: AccountsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Accounts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {accounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Connected Accounts</h3>
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
                      {getInitials(account.emailAddress)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{account.emailAddress}</p>
                      <p className="text-xs text-gray-500 capitalize">{account.provider}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveAccount(account.id, account.emailAddress)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Add Account</h3>
            <div className="space-y-2">
              <Button
                onClick={onConnectGmail}
                variant="outline"
                className="w-full justify-start"
              >
                <Mail className="h-4 w-4 mr-2" />
                Connect Gmail
              </Button>
              <Button
                onClick={onConnectOutlook}
                variant="outline"
                className="w-full justify-start"
              >
                <Mail className="h-4 w-4 mr-2" />
                Connect Outlook
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
