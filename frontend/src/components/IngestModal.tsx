import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { UploadZone } from './UploadZone';
import { 
  Upload, 
  Link, 
  Edit3, 
  X, 
  Loader2, 
  Plus 
} from 'lucide-react';
import { ingestUrlToArea, ingestTextToArea } from '../api';
import { convertHtmlToMarkdown } from '../utils/htmlToMarkdown';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaId: string | null;
  onUploadSuccess?: () => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  areaId,
  onUploadSuccess
}) => {
  const [unifiedTab, setUnifiedTab] = useState<'upload' | 'link' | 'paste'>('upload');
  
  // Link Ingest states
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Paste Text states
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteStatus, setPasteStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const handlePasteIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = pasteTitle.trim();
    const content = pasteContent.trim();
    if (!title || !content) return;
    if (!areaId) {
      setPasteStatus({ type: 'error', message: 'Select or create an Area first.' });
      return;
    }

    setPasteLoading(true);
    setPasteStatus({ type: null, message: '' });

    try {
      const res = await ingestTextToArea(areaId, title, content);
      setPasteStatus({
        type: 'success',
        message: `Ingested! Saved as: ${res.filename} (${res.chunks} chunks created)`,
      });
      setPasteTitle('');
      setPasteContent('');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      setTimeout(() => {
        onClose();
        setPasteStatus({ type: null, message: '' });
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPasteStatus({
        type: 'error',
        message: message || 'Error ingesting text.',
      });
    } finally {
      setPasteLoading(false);
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const markdown = convertHtmlToMarkdown(html);
      setPasteContent(markdown);
    }
  };

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = linkUrl.trim();
    if (!targetUrl) return;
    if (!areaId) {
      setLinkStatus({ type: 'error', message: 'Select or create an Area first.' });
      return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setLinkStatus({ type: 'error', message: 'URL must start with http:// or https://' });
      return;
    }

    setLinkLoading(true);
    setLinkStatus({ type: null, message: '' });

    try {
      const res = await ingestUrlToArea(areaId, targetUrl);
      setLinkStatus({
        type: 'success',
        message: `Ingested! Saved as: ${res.filename} (${res.chunks} chunks created)`,
      });
      setLinkUrl('');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      setTimeout(() => {
        onClose();
        setLinkStatus({ type: null, message: '' });
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLinkStatus({
        type: 'error',
        message: message || 'Error ingesting URL.',
      });
    } finally {
      setLinkLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in font-sans">
      <div className="w-full max-w-xl bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-205">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/40">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Ingestar Información al Área
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Agrega conocimiento para que tu agente pueda consultarlo.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Tabs for Ingestion Modes */}
        <div className="flex bg-zinc-950/60 p-1 border-b border-zinc-900 gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setUnifiedTab('upload')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border outline-none focus:outline-none ${
              unifiedTab === 'upload'
                ? 'bg-zinc-900 text-brand-primary shadow-sm border-zinc-800'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Subir Archivo
          </button>
          <button
            type="button"
            onClick={() => setUnifiedTab('link')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border outline-none focus:outline-none ${
              unifiedTab === 'link'
                ? 'bg-zinc-900 text-brand-primary shadow-sm border-zinc-800'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link className="h-3.5 w-3.5" />
            Enlace Web
          </button>
          <button
            type="button"
            onClick={() => setUnifiedTab('paste')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border outline-none focus:outline-none ${
              unifiedTab === 'paste'
                ? 'bg-zinc-900 text-brand-primary shadow-sm border-zinc-800'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Pegar Texto
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {unifiedTab === 'upload' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 border border-zinc-900 p-3 rounded-xl font-sans">
                Sube un documento en formato <strong>PDF</strong>, <strong>TXT</strong> o <strong>Markdown</strong>. El archivo se procesará, dividirá en fragmentos y se indexará en la base de datos vectorial para consultas semánticas.
              </div>
              <UploadZone 
                areaId={areaId} 
                onUploadSuccess={() => {
                  if (onUploadSuccess) onUploadSuccess();
                  setTimeout(onClose, 1500);
                }} 
              />
            </div>
          )}

          {unifiedTab === 'link' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 border border-zinc-900/50 p-3 rounded-xl font-sans">
                Ingresa una dirección URL para descargar su contenido. La página se convertirá automáticamente a formato Markdown limpio para su indexación.
              </div>
              <form onSubmit={handleIngestUrl} className="flex flex-col gap-3">
                <div className="relative">
                  <Link className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="url"
                    placeholder="https://example.com/articulo-o-documento"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    disabled={linkLoading}
                    className="w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl pl-10 pr-3 py-3 text-zinc-250 placeholder-zinc-650 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all disabled:opacity-50"
                  />
                </div>
                {linkStatus.type && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                      linkStatus.type === 'success' ? 'status-success' : 'status-error'
                    }`}
                  >
                    <span className="break-all">{linkStatus.message}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={linkLoading || !linkUrl.trim()}
                  className="w-full py-2.5 rounded-xl bg-brand-primary text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  {linkLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin animate-pulse" />
                      Ingestando enlace...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Ingestar URL
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {unifiedTab === 'paste' && (
            <form onSubmit={handlePasteIngest} className="flex flex-col gap-4 animate-fade-in font-sans">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Título del Documento
                </label>
                <input
                  type="text"
                  placeholder="Ej. Notas de la Reunión Semanal"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl px-3 py-2.5 text-zinc-250 placeholder-zinc-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-0.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Contenido (Markdown soportado)
                  </label>
                  <span className="text-xs text-zinc-400 italic">
                    Copia texto enriquecido de la web para conversión automática
                  </span>
                </div>
                <textarea
                  placeholder="Pega el texto aquí..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  onPaste={handleTextareaPaste}
                  required
                  className="w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl px-3 py-2.5 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all font-mono resize-none h-40"
                />
              </div>

              {pasteStatus.type && (
                <div
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                    pasteStatus.type === 'success' ? 'status-success' : 'status-error'
                  }`}
                >
                  <span className="break-all">{pasteStatus.message}</span>
                </div>
              )}

                  <div className="flex justify-end gap-3 mt-2 font-sans">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl border border-zinc-850 text-xs text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={pasteLoading || !pasteTitle.trim() || !pasteContent.trim()}
                      className="px-5 py-2 rounded-xl bg-brand-primary text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {pasteLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Ingestando...
                        </>
                      ) : (
                        'Ingestar Texto'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      );
};
