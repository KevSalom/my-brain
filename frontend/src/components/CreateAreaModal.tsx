import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface CreateAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, color: string) => void;
}

export const CreateAreaModal: React.FC<CreateAreaModalProps> = React.memo(({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim(), color);
    // Reset state
    setName('');
    setDescription('');
    setColor('#3B82F6');
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setColor('#3B82F6');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      header={
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-brand-primary" />
          <span className="text-sm font-bold text-zinc-150">Create Knowledge Area</span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 font-sans">
        <div>
          <label className="text-xs text-zinc-450 font-bold uppercase tracking-wider block mb-1">
            Name
          </label>
          <Input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Artificial Intelligence, Finance, Health..."
          />
        </div>
        
        <div>
          <label className="text-xs text-zinc-450 font-bold uppercase tracking-wider block mb-1">
            Description (Optional)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none"
            placeholder="e.g., Papers, tutorials and notes about AI..."
          />
        </div>
        
        <div>
          <label className="text-xs text-zinc-450 font-bold uppercase tracking-wider block mb-1">
            Theme Color
          </label>
          <div className="flex gap-2.5 mt-1.5 justify-between">
            {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6.5 h-6.5 rounded-full border-2 transition-transform duration-200 cursor-pointer ${
                  color === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2.5 mt-6 font-sans">
        <button
          onClick={handleClose}
          className="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="px-3.5 py-1.5 rounded-lg text-xs bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover disabled:opacity-25 transition-all shadow-[0_0_10px_var(--brand-shadow)] cursor-pointer"
        >
          Create Area
        </button>
      </div>
    </Modal>
  );
});
