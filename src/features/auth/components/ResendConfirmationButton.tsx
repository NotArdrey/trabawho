import { Mail } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';

export function ResendConfirmationButton({ disabled, onClick }: Pick<ButtonProps, 'disabled' | 'onClick'>) {
  return (
    <Button type="button" variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3" disabled={disabled} onClick={onClick}>
      <Mail aria-hidden="true" />Resend confirmation email
    </Button>
  );
}
