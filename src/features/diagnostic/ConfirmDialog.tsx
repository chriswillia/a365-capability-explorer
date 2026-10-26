import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from '@fluentui/react-components';
import { useState } from 'react';
import { content } from '../../lib/content/index.ts';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
  // Fluent must stay mounted after opening so closing can restore focus and modal state.
  if (!hasOpened && !open) return null;
  return (
    <Dialog
      open={open}
      modalType="alert"
      onOpenChange={(_, state) => {
        if (!state.open) onCancel();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{body}</DialogContent>
          <DialogActions>
            <Button onClick={onCancel}>{content.site.diagnostic.cancel}</Button>
            <Button appearance="primary" onClick={onConfirm}>
              {confirmLabel ?? content.site.diagnostic.confirm}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
