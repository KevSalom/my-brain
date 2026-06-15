import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, Loader2 } from 'lucide-react';
import { ingestFile } from '../api';

interface UploadZoneProps {
  onUploadSuccess?: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUploadSuccess }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const validateAndUpload = async (file: File) => {
    const allowedExtensions = ['.pdf', '.txt', '.md'];
    const suffix = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedExtensions.includes(suffix)) {
      setStatus({
        type: 'error',
        message: `Formato no soportado. Tipos válidos: PDF, TXT, MD`,
      });
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      setStatus({
        type: 'error',
        message: `El archivo supera el límite de 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
      });
      return;
    }

    setLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await ingestFile(file);
      setStatus({
        type: 'success',
        message: `¡Ingestado! ${res.filename} (${res.chunks} chunks creados)`,
      });
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'Error al procesar el archivo.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await validateAndUpload(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`w-full h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 cursor-pointer transition-all duration-300 backdrop-blur-md ${
          isDragActive
            ? 'border-brand-primary bg-brand-primary/10'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/30'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          className="hidden"
          accept=".pdf,.txt,.md"
        />

        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
            <p className="text-sm text-slate-300 font-medium">Ingestando archivo RAG...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center group">
            <Upload className="h-8 w-8 text-slate-400 group-hover:text-brand-primary transition-colors" />
            <p className="text-sm text-slate-200 font-medium">
              Arrastra un archivo o haz clic
            </p>
            <p className="text-xs text-slate-500">
              Soporta PDF, TXT y MD (max 10MB)
            </p>
          </div>
        )}
      </div>

      {status.type && (
        <div
          className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed ${
            status.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
              : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="break-all">{status.message}</span>
        </div>
      )}
    </div>
  );
};
