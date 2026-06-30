import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  header?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  header,
  size = 'md',
  children
}) => {
  // Lock body scroll when modal is open to prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Map size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-fade-in font-sans"
    >
      <div
        className={`relative bg-zinc-900/95 border border-brand-border rounded-2xl w-full ${sizeClasses[size]} p-4 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header Layout */}
        {header ? (
          <div className="border-b border-zinc-800/80 pb-3 mb-4 shrink-0 relative pr-10">
            {header}
            <button
              onClick={onClose}
              className="absolute top-0.5 right-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer focus:outline-none"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : title ? (
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4 shrink-0">
            <h3 className="text-sm font-bold text-zinc-150 flex items-center gap-2">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer focus:outline-none"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer focus:outline-none z-10"
            title="Close modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto px-1.5 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
