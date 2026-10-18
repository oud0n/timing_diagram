import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
export interface OpenedFile { path: string; content: string }
export interface FileGateway {
  native: boolean;
  open(): Promise<OpenedFile | null>;
  save(content: string, path: string | null, kind: 'json' | 'svg'): Promise<string | null>;
  close(): Promise<void>;
  quit(): Promise<void>;
  subscribe(action: (name: string) => void, close: () => void): Promise<() => void>;
  title(value: string): Promise<void>;
}
export function downloadText(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function createFileGateway(): FileGateway {
  if (isTauri()) return {
    native: true,
    open: () => invoke<OpenedFile | null>('open_document'),
    save: (content, path, kind) => invoke<string | null>('save_document', {content,path,kind}),
    close: () => getCurrentWindow().destroy(),
    quit: () => invoke('exit_editor'),
    title: value => getCurrentWindow().setTitle(value),
    subscribe: async (action, close) => {
      const stopAction = await listen<string>('editor-action', event => action(event.payload));
      try {
        const stopClose = await getCurrentWindow().onCloseRequested(event => { event.preventDefault(); close(); });
        await invoke("frontend_ready");
        return () => { stopAction(); stopClose(); };
      } catch (error) { stopAction(); throw error; }
    },
  };
  return {
    native:false,
    open: () => new Promise((resolve,reject) => {
      const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json'; input.hidden=true;
      const cleanup = () => input.remove();
      input.oncancel = () => { cleanup(); resolve(null); };
      input.onchange = async () => {
        const file = input.files?.[0]; cleanup();
        if (!file) { resolve(null); return; }
        try {
          if (file.size > 16 * 1024 * 1024) throw new Error('File exceeds 16 MiB');
          resolve({path:file.name,content:await file.text()});
        } catch(error) { reject(error); }
      };
      document.body.appendChild(input); input.click();
    }),
    save: async (content,path,kind) => {
      downloadText(content, path?.split(/[\\/]/).pop() || `timing_diagram.${kind}`, kind==='json'?'application/json':'image/svg+xml');
      return path || `timing_diagram.${kind}`;
    },
    close: async () => {}, quit: async () => {}, title: async value => { document.title=value; }, subscribe: async () => () => {},
  };
}
