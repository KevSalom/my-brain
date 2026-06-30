import React, { forwardRef } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full bg-zinc-950/50 dark:bg-zinc-950/50 light:bg-zinc-100/80 border border-zinc-800/80 dark:border-zinc-800/80 light:border-zinc-300 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 dark:text-zinc-200 light:text-zinc-800 placeholder-zinc-500 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all duration-150 ease-in-out disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';
