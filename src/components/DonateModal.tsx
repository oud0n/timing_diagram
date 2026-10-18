import React, { useEffect, useState } from "react";
import { Check, Coffee, Copy, ExternalLink, Heart, Smartphone, Sparkles, Star, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/oud0n";
export const GITHUB_REPO_URL = "https://github.com/oud0n/timing_diagram";

interface DonateModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
  openUrl: (url: string) => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, isDark, onClose, openUrl }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(BUY_ME_A_COFFEE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const panel = isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700";
  const card = isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const strong = isDark ? "text-white" : "text-slate-900";

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donate-title"
    >
      <div className={`my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`}>
        <div className={`flex items-center justify-between border-b px-6 py-4 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/20 text-amber-500">
              <Coffee size={18} />
            </div>
            <div>
              <h2 id="donate-title" className={`flex items-center gap-1.5 text-sm font-bold ${strong}`}>
                Support the Developer <span className="text-xs font-normal text-amber-500">(Buy Me a Coffee)</span>
              </h2>
              <p className={`text-[11px] ${muted}`}>Help keep Timing Diagram developed and maintained</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={`cursor-pointer rounded-lg p-1.5 ${muted} hover:bg-slate-500/15`} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-6">
          <div className={`space-y-2 rounded-xl border p-4 ${card}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
              <Sparkles size={15} />
              <span>Thank you for using Timing Diagram!</span>
            </div>
            <p className="text-xs leading-relaxed">
              <strong className={strong}>Timing Diagram</strong> is a free, open-source timing chart editor developed by one person in their spare time.
              Your support keeps new features, fixes and the desktop builds going ☕
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-5">
            <div className={`flex flex-col justify-between space-y-3 rounded-xl border p-4 md:col-span-3 ${card}`}>
              <div>
                <span className={`mb-1 block text-[11px] font-bold uppercase tracking-wider ${muted}`}>From your computer</span>
                <p className="mb-3 text-xs">Open the Buy Me a Coffee page in your browser and support with a coffee (from $3).</p>
              </div>
              <button
                type="button"
                onClick={() => openUrl(BUY_ME_A_COFFEE_URL)}
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#FFDD00] px-4 py-3 text-sm font-extrabold text-black shadow-md transition-all hover:bg-[#ffe333] active:bg-[#e6c700]"
              >
                <Coffee size={18} className="transition-transform group-hover:scale-110" />
                <span>Buy me a coffee</span>
                <ExternalLink size={14} className="ml-1 opacity-70 transition-opacity group-hover:opacity-100" />
              </button>
              <div className="pt-2">
                <span className={`mb-1 block text-[10px] ${muted}`}>Share or save the link:</span>
                <div className={`flex items-center gap-1.5 rounded-lg border p-1.5 font-mono text-xs ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <span className="flex-1 select-all truncate px-1">{BUY_ME_A_COFFEE_URL}</span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className={`flex cursor-pointer items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${copied ? "bg-emerald-600 text-white" : isDark ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
                    title="Copy the link"
                  >
                    {copied ? <><Check size={12} /><span>Copied</span></> : <><Copy size={12} /><span>Copy</span></>}
                  </button>
                </div>
              </div>
            </div>

            <div className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center md:col-span-2 ${card}`}>
              <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-bold ${muted}`}>
                <Smartphone size={13} className="text-amber-500" />
                <span>From your phone</span>
              </div>
              <div className="flex items-center justify-center rounded-xl border border-slate-300 bg-white p-2.5 shadow-lg">
                <QRCodeSVG value={BUY_ME_A_COFFEE_URL} size={128} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
              <p className={`mt-2.5 text-[10px] leading-tight ${muted}`}>Scan with your phone camera to open the page</p>
            </div>
          </div>

          <div className={`space-y-2 rounded-xl border p-4 ${card}`}>
            <h4 className="flex items-center gap-1.5 text-xs font-bold">
              <Heart size={13} className="text-red-400" />
              How your support is used
            </h4>
            <ul className={`space-y-1.5 pl-1 text-xs ${muted}`}>
              <li>💻 Development time for new editing features and fixes</li>
              <li>🍎 Keeping the macOS (Apple Silicon) desktop app and its builds up to date</li>
              <li>🌐 Hosting and maintaining the browser version on GitHub Pages</li>
            </ul>
          </div>

          <div className={`flex flex-col items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-xs sm:flex-row ${card} ${muted}`}>
            <div className="flex items-center gap-2">
              <Star size={15} className="text-amber-500" />
              <span>Stars ⭐, bug reports and feedback on GitHub are very welcome too!</span>
            </div>
            <button type="button" onClick={() => openUrl(GITHUB_REPO_URL)} className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-blue-500 hover:underline">
              <span>GitHub repository</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>

        <div className={`flex items-center justify-between border-t px-6 py-3.5 ${isDark ? "border-slate-700" : "border-slate-200"}`}>
          <span className={`flex items-center gap-1 text-[11px] ${muted}`}>
            Creator ID: <span className="font-mono font-bold text-amber-500">oud0n</span>
          </span>
          <button type="button" onClick={onClose} className={`cursor-pointer rounded-lg border px-4 py-1.5 text-xs ${isDark ? "border-slate-700 hover:bg-slate-800" : "border-slate-200 hover:bg-slate-100"}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
