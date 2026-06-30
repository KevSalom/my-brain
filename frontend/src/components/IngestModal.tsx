import React, { useState, useRef, useEffect } from 'react';
import { UploadZone } from './UploadZone';
import { 
  Upload, 
  Link as LinkIcon, 
  Edit3, 
  Loader2, 
  Plus 
} from 'lucide-react';
import { ingestUrlToArea, ingestTextToArea } from '../api';
import { convertHtmlToMarkdown } from '../utils/htmlToMarkdown';
import { Modal } from './Modal';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaId: string | null;
  onUploadSuccess: () => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({
  isOpen,
  onClose,
  areaId,
  onUploadSuccess,
}) => {
  const [unifiedTab, setUnifiedTab] = useState<'upload' | 'link' | 'paste'>('upload');

  const linkInputRef = useRef<HTMLInputElement>(null);
  const pasteInputRef = useRef<HTMLInputElement>(null);

  // Reset tab to upload when modal opens
  useEffect(() => {
    if (isOpen) {
      setUnifiedTab('upload');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (unifiedTab === 'link') {
          linkInputRef.current?.focus();
        } else if (unifiedTab === 'paste') {
          pasteInputRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, unifiedTab]);

  // States for URL Ingest
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // States for Paste Markdown Ingest
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteStatus, setPasteStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = linkUrl.trim();
    if (!targetUrl) return;
    if (!areaId) {
      setLinkStatus({ type: 'error', message: 'Select or create an Area first.' });
      return;
    }

    setLinkLoading(true);
    setLinkStatus({ type: null, message: '' });

    try {
      const res = await ingestUrlToArea(areaId, targetUrl);
      setLinkStatus({
        type: 'success',
        message: `Ingested successfully! Saved as: ${res.filename} (${res.chunks} chunks created)`,
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      header={
        <div>
          <h3 className="text-sm font-bold text-zinc-200">
            Ingest Information to Area
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Add knowledge so your agent can consult it.</p>
        </div>
      }
    >
      {/* Tabs for Ingestion Modes */}
      <div className="flex flex-col sm:flex-row bg-zinc-950/60 p-1 border border-zinc-900/60 gap-1 shrink-0 rounded-xl mb-5">
        <button
          type="button"
          onClick={() => setUnifiedTab('upload')}
          className={`flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all outline-none focus:outline-none cursor-pointer border ${
            unifiedTab === 'upload'
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-sm'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setUnifiedTab('link')}
          className={`flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all outline-none focus:outline-none cursor-pointer border ${
            unifiedTab === 'link'
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-sm'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Web Link
        </button>
        <button
          type="button"
          onClick={() => setUnifiedTab('paste')}
          className={`flex-1 py-2.5 sm:py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all outline-none focus:outline-none cursor-pointer border ${
            unifiedTab === 'paste'
              ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-sm'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Edit3 className="h-3.5 w-3.5" />
          Paste Text
        </button>
      </div>

      {/* Modal Content Bodies */}
      <div className="font-sans">
        {unifiedTab === 'upload' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 border border-zinc-900 p-3 rounded-xl">
              Upload a document in <strong>PDF</strong>, <strong>TXT</strong>, or <strong>Markdown</strong> format. The file will be processed, chunked, and indexed in the vector database for semantic queries.
            </div>
            <UploadZone 
              areaId={areaId} 
              onUploadSuccess={onUploadSuccess} 
            />
          </div>
        )}

        {unifiedTab === 'link' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/30 border border-zinc-900/50 p-3 rounded-xl">
              Enter a URL to download its content. The page will be automatically converted to clean Markdown for indexing.
            </div>
            <form onSubmit={handleIngestUrl} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  ref={linkInputRef}
                  type="url"
                  placeholder="https://example.com/article"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  required
                  className="flex-1"
                />
                <button
                  type="submit"
                  disabled={linkLoading || !linkUrl.trim()}
                  className="px-5 py-2.5 rounded-xl bg-brand-primary text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 w-full sm:w-auto"
                >
                  {linkLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Ingest
                    </>
                  )}
                </button>
              </div>

              {linkStatus.type && (
                <div
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                    linkStatus.type === 'success' ? 'status-success' : 'status-error'
                  }`}
                >
                  <span>{linkStatus.message}</span>
                </div>
              )}
            </form>
          </div>
        )}

        {unifiedTab === 'paste' && (
          <form onSubmit={handlePasteIngest} className="flex flex-col gap-4 animate-fade-in">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Document Title
              </label>
              <Input
                ref={pasteInputRef}
                type="text"
                placeholder="e.g., Weekly Meeting Notes"
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Content (Markdown supported)
                </label>
                <span className="text-xs text-zinc-400 italic">
                  Copy rich text from the web for automatic conversion
                </span>
              </div>
              <Textarea
                placeholder="Paste text here..."
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                onPaste={handleTextareaPaste}
                required
                className="font-mono resize-none h-40"
              />
            </div>

            {pasteStatus.type && (
              <div
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                  pasteStatus.type === 'success' ? 'status-success' : 'status-error'
                }`}
              >
                <span>{pasteStatus.message}</span>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2.5 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pasteLoading || !pasteTitle.trim() || !pasteContent.trim()}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl bg-brand-primary text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                {pasteLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  'Ingest Text'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
