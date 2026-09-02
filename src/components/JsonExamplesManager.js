'use client';

import { useEffect, useState } from 'react';

const EMPTY_DRAFT = { id: '', title: '', content: '' };

export default function JsonExamplesManager() {
  const [examples, setExamples] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/json-examples')
      .then(response => response.json())
      .then(data => setExamples(Array.isArray(data.examples) ? data.examples : []))
      .catch(() => setMessage('JSON 範例載入失敗。'));
  }, []);

  const persist = async nextExamples => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/json-examples', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples: nextExamples })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'JSON 範例儲存失敗。');
      setExamples(Array.isArray(data.examples) ? data.examples : nextExamples);
      window.dispatchEvent(new Event('json-examples-updated'));
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openEditor = example => {
    setDraft(example ? { id: example.id, title: example.title, content: example.content } : EMPTY_DRAFT);
    setMessage('');
    setEditorOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.content.trim()) {
      setMessage('請填寫範例名稱與 JSON 內容。');
      return;
    }
    try {
      JSON.parse(draft.content);
    } catch {
      setMessage('JSON 格式錯誤，請重新檢查。');
      return;
    }
    const item = { id: draft.id || `json-example-${Date.now()}`, title: draft.title.trim(), content: draft.content.trim(), updatedAt: new Date().toISOString() };
    const next = draft.id ? examples.map(example => example.id === draft.id ? item : example) : [item, ...examples];
    if (await persist(next)) {
      setEditorOpen(false);
      setDraft(EMPTY_DRAFT);
    }
  };

  const copy = async example => {
    try {
      await navigator.clipboard.writeText(example.content);
      setMessage(`已複製「${example.title}」。`);
      setTimeout(() => setMessage(''), 1800);
    } catch {
      setMessage('複製失敗，請確認剪貼簿權限。');
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    if (await persist(examples.filter(example => example.id !== toDelete.id))) setToDelete(null);
  };

  return (
    <>
      <section className="rounded-lg border border-[#EAE8E4] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAE8E4] pb-3">
          <div><h3 className="text-sm font-bold text-[#333333]">JSON 格式範例</h3><p className="mt-1 text-[10px] text-[#888888]">可建立多筆匯入格式供參考。</p></div>
          <button type="button" onClick={() => openEditor()} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EA5B3C] text-white hover:bg-[#333333]" aria-label="新增 JSON 格式範例" title="新增"><i className="ti ti-plus" /></button>
        </div>
        {message && <p className="mt-3 rounded-lg bg-[#F9F8F5] px-3 py-2 text-[11px] font-bold text-[#666666]">{message}</p>}
        <div className="mt-3 space-y-2">
          {examples.length ? examples.map(example => <div key={example.id} className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-3"><p className="truncate text-xs font-bold text-[#333333]">{example.title}</p><div className="mt-2 flex items-center gap-1.5"><button type="button" onClick={() => copy(example)} className="h-7 w-7 rounded-full border border-[#EAE8E4] bg-white text-[#888888]" aria-label={`複製 ${example.title}`} title="複製"><i className="ti ti-copy" /></button><button type="button" onClick={() => setPreview(example)} className="h-7 w-7 rounded-full border border-[#EAE8E4] bg-white text-[#888888]" aria-label={`預覽 ${example.title}`} title="預覽"><i className="ti ti-eye" /></button><button type="button" onClick={() => openEditor(example)} className="h-7 w-7 rounded-full border border-[#EAE8E4] bg-white text-[#888888]" aria-label={`編輯 ${example.title}`} title="編輯"><i className="ti ti-pencil" /></button><button type="button" onClick={() => setToDelete(example)} className="h-7 w-7 rounded-full border border-red-200 bg-white text-red-600" aria-label={`刪除 ${example.title}`} title="刪除"><i className="ti ti-trash" /></button></div></div>) : <p className="py-6 text-center text-xs text-[#888888]">尚未建立 JSON 格式範例。</p>}
        </div>
      </section>

      {editorOpen && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4"><h3 className="font-bold">{draft.id ? '編輯 JSON 格式範例' : '新增 JSON 格式範例'}</h3><button type="button" onClick={() => setEditorOpen(false)} aria-label="關閉" className="h-8 w-8 text-[#888888]"><i className="ti ti-x" /></button></div><div className="space-y-4 p-5"><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="範例名稱" className="w-full rounded-lg border border-[#EAE8E4] px-3 py-2 text-sm font-bold focus:border-[#EA5B3C] focus:outline-none" /><textarea value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} rows={14} placeholder="貼上 JSON 內容" className="w-full resize-y rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-3 font-mono text-xs leading-6 focus:border-[#EA5B3C] focus:outline-none" />{message && <p className="text-xs font-bold text-red-600">{message}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border border-[#EAE8E4] px-4 py-2 text-xs font-bold">取消</button><button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#EA5B3C] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? '儲存中...' : '儲存'}</button></div></div></div></div>}
      {preview && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4"><div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4"><h3 className="font-bold">{preview.title}</h3><button type="button" onClick={() => setPreview(null)} aria-label="關閉預覽" className="h-8 w-8 text-[#888888]"><i className="ti ti-x" /></button></div><div className="overflow-auto p-5"><pre className="whitespace-pre-wrap break-words rounded-lg bg-[#F9F8F5] p-4 font-mono text-xs leading-6">{preview.content}</pre></div></div></div>}
      {toDelete && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"><h3 className="font-bold">刪除 JSON 格式範例？</h3><p className="mt-3 text-sm text-[#666666]">確定要刪除「{toDelete.title}」嗎？</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setToDelete(null)} className="rounded-lg border border-[#EAE8E4] px-4 py-2 text-xs font-bold">取消</button><button type="button" onClick={remove} disabled={saving} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">確認刪除</button></div></div></div>}
    </>
  );
}
