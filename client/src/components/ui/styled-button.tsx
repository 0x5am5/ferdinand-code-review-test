import { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from '@/styles/components/button.module.scss';
import { cn } from '@/lib/utils';

export interface StyledButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'small' | 'large';
  fullWidth?: boolean;
  withIcon?: boolean;
}

/**
 * StyledButton Component
 * 
 * A button component that uses SCSS modules for styling
 * instead of utility classes directly in the markup.
 * 
 * This demonstrates the separation of styling concerns.
 */
export const StyledButton = forwardRef<HTMLButtonElement, StyledButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'default', 
    fullWidth = false,
    withIcon = false,
    children, 
    ...props 
  }, ref) => {
    return (
      <button
        className={cn(
          styles.button,
          styles[`button--${variant}`],
          styles[`button--${size}`],
          fullWidth && styles['button--full-width'],
          withIcon && styles['button--with-icon'],
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);

StyledButton.displayName = 'StyledButton';