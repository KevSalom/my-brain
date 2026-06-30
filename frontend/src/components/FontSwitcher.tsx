import React, { useState, useEffect, useRef } from 'react';
import { Type, X, Check, RotateCcw } from 'lucide-react';

interface FontPreset {
  id: string;
  name: string;
  emoji: string;
  description: string;
  sans: string;
  mono: string;
  sansImport: string;
  monoImport: string;
}

const FONT_PRESETS: FontPreset[] = [
  {
    id: 'current',
    name: 'Actual (Outfit)',
    emoji: '📌',
    description: 'Tu fuente actual — geométrica, limpia, popular en apps de IA',
    sans: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', monospace",
    sansImport: 'Outfit:wght@300;400;500;600;700;800',
    monoImport: 'JetBrains+Mono:wght@400;500;700',
  },
  {
    id: 'lab',
    name: 'El Laboratorio',
    emoji: '🧪',
    description: 'Técnica, con ADN monoespaciado. Toque hacker-chic.',
    sans: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Space Mono', monospace",
    sansImport: 'Space+Grotesk:wght@300;400;500;600;700',
    monoImport: 'Space+Mono:wght@400;700',
  },
  {
    id: 'editorial',
    name: 'La Editorial',
    emoji: '📰',
    description: 'Serif en títulos + sans para cuerpo. Elegancia intelectual.',
    sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'IBM Plex Mono', monospace",
    sansImport: 'DM+Sans:wght@300;400;500;600;700',
    monoImport: 'IBM+Plex+Mono:wght@400;500;700',
  },
  {
    id: 'organic',
    name: 'La Orgánica',
    emoji: '🌊',
    description: 'Curvas naturales, carácter humano. Artesanal y memorable.',
    sans: "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Fira Code', monospace",
    sansImport: 'Bricolage+Grotesque:wght@300;400;500;600;700;800',
    monoImport: 'Fira+Code:wght@400;500;700',
  },
  {
    id: 'swiss',
    name: 'La Futurista Suiza',
    emoji: '⚡',
    description: 'Minimalismo extremo. Diseño suizo moderno, software-native.',
    sans: "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Source Code Pro', monospace",
    sansImport: 'Sora:wght@300;400;500;600;700',
    monoImport: 'Source+Code+Pro:wght@400;500;700',
  },
  {
    id: 'neoclassic',
    name: 'La Neoclásica',
    emoji: '🏛️',
    description: 'Contraste dramático. Serif display + grotesca cálida.',
    sans: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'Fira Code', monospace",
    sansImport: 'Manrope:wght@300;400;500;600;700;800',
    monoImport: 'Fira+Code:wght@400;500;700',
  },
  {
    id: 'identity',
    name: 'Identidad Propia',
    emoji: '🧠',
    description: 'Inteligencia amigable. Curvas suaves, premium y product-ready.',
    sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'IBM Plex Mono', monospace",
    sansImport: 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
    monoImport: 'IBM+Plex+Mono:wght@400;500;700',
  },
];

// For the Editorial preset, we also load Instrument Serif for headings
const EDITORIAL_HEADING_FONT = "'Instrument Serif', Georgia, serif";
const EDITORIAL_HEADING_IMPORT = 'Instrument+Serif';

// For the Neoclassic preset, we also load Playfair Display for headings
const NEOCLASSIC_HEADING_FONT = "'Playfair Display', Georgia, serif";
const NEOCLASSIC_HEADING_IMPORT = 'Playfair+Display:wght@700;800';

// Dynamically load fonts into the page
function loadGoogleFont(fontSpec: string) {
  const id = `gfont-${fontSpec.replace(/[^a-zA-Z0-9]/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontSpec}&display=swap`;
  document.head.appendChild(link);
}

interface FontSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FontSwitcher: React.FC<FontSwitcherProps> = ({ isOpen, onClose }) => {
  const [activePreset, setActivePreset] = useState<string>(() => {
    return localStorage.getItem('font-preset') || 'current';
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load all fonts on mount
  useEffect(() => {
    for (const preset of FONT_PRESETS) {
      loadGoogleFont(preset.sansImport);
      loadGoogleFont(preset.monoImport);
    }
    loadGoogleFont(EDITORIAL_HEADING_IMPORT);
    loadGoogleFont(NEOCLASSIC_HEADING_IMPORT);
  }, []);

  // Apply the active font preset to CSS custom properties
  useEffect(() => {
    const preset = FONT_PRESETS.find(p => p.id === activePreset);
    if (!preset) return;

    const root = document.documentElement;
    root.style.setProperty('--font-sans', preset.sans);
    root.style.setProperty('--font-mono', preset.mono);

    // Handle special heading fonts for editorial and neoclassic
    if (activePreset === 'editorial') {
      root.style.setProperty('--font-heading', EDITORIAL_HEADING_FONT);
      root.classList.add('font-preset-editorial');
      root.classList.remove('font-preset-neoclassic');
    } else if (activePreset === 'neoclassic') {
      root.style.setProperty('--font-heading', NEOCLASSIC_HEADING_FONT);
      root.classList.remove('font-preset-editorial');
      root.classList.add('font-preset-neoclassic');
    } else {
      root.style.removeProperty('--font-heading');
      root.classList.remove('font-preset-editorial');
      root.classList.remove('font-preset-neoclassic');
    }

    localStorage.setItem('font-preset', activePreset);
  }, [activePreset]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay to prevent the opening click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPreset = FONT_PRESETS.find(p => p.id === activePreset)!;

  return (
    <div
      ref={panelRef}
      className="fixed bottom-4 left-20 z-50 w-[360px] max-h-[85vh] rounded-2xl border border-brand-border bg-zinc-950/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in flex flex-col"
      style={{ boxShadow: '0 0 60px rgba(0,0,0,0.5), 0 0 20px var(--brand-shadow)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20">
            <Type className="h-4 w-4 text-brand-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Font Switcher</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Prueba las fuentes en vivo</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Font Options List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1.5 scrollbar-thin">
        {FONT_PRESETS.map(preset => {
          const isActive = preset.id === activePreset;
          return (
            <button
              key={preset.id}
              onClick={() => setActivePreset(preset.id)}
              className={`group w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-brand-primary/10 border-brand-primary/30 shadow-[0_0_12px_var(--brand-shadow)]'
                  : 'bg-zinc-900/20 border-zinc-800/40 hover:bg-zinc-900/40 hover:border-zinc-700/60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{preset.emoji}</span>
                  <span className={`text-xs font-semibold ${isActive ? 'text-brand-primary' : 'text-zinc-200'}`}>
                    {preset.name}
                  </span>
                </div>
                {isActive && (
                  <div className="flex items-center gap-1 text-brand-primary animate-fade-in-fast">
                    <Check className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Activa</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed mb-2">
                {preset.description}
              </p>
              {/* Live preview of the font */}
              <div
                className={`p-2.5 rounded-lg border transition-colors ${
                  isActive ? 'bg-zinc-900/50 border-brand-primary/15' : 'bg-zinc-950/40 border-zinc-800/30'
                }`}
              >
                <p
                  className="text-sm text-zinc-200 mb-1"
                  style={{ fontFamily: preset.sans }}
                >
                  My Brain LM — Aa Bb Cc 123
                </p>
                {/* Show special heading font for editorial/neoclassic */}
                {preset.id === 'editorial' && (
                  <p
                    className="text-lg text-zinc-300 mb-1 leading-tight"
                    style={{ fontFamily: EDITORIAL_HEADING_FONT }}
                  >
                    Knowledge is power
                  </p>
                )}
                {preset.id === 'neoclassic' && (
                  <p
                    className="text-lg text-zinc-300 mb-1 leading-tight font-bold"
                    style={{ fontFamily: NEOCLASSIC_HEADING_FONT }}
                  >
                    Knowledge is power
                  </p>
                )}
                <p
                  className="text-[11px] text-zinc-500"
                  style={{ fontFamily: preset.mono }}
                >
                  {'const ai = await loadBrain()'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer with current info */}
      <div className="p-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between">
        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
          <span className="text-base leading-none">{currentPreset.emoji}</span>
          <span>
            Usando: <span className="text-zinc-300 font-semibold">{currentPreset.name}</span>
          </span>
        </div>
        {activePreset !== 'current' && (
          <button
            onClick={() => setActivePreset('current')}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-800/50"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar
          </button>
        )}
      </div>
    </div>
  );
};
