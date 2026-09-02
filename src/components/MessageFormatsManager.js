'use client';

import { useEffect, useState } from 'react';

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy failed');
}

export default function MessageFormatsManager() {
  const [formats, setFormats] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState({ id: '', title: '', content: '' });
  const [original, setOriginal] = useState({ id: '', title: '', content: '' });
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [formatToDelete, setFormatToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/message-formats')
      .then(response => response.json())
      .then(data => setFormats(Array.isArray(data.messageFormats) ? data.messageFormats : []))
      .catch(() => setMessage('訊息格式載入失敗。'));
  }, []);

  const persist = async (nextFormats, successMessage) => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/message-formats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageFormats: nextFormats })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '訊息格式儲存失敗');
      setFormats(Array.isArray(data.messageFormats) ? data.messageFormats : nextFormats);
      setMessage(successMessage);
      setTimeout(() => setMessage(''), 2500);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openDialog = (format = null) => {
    const nextDraft = format
      ? { id: format.id, title: format.title || '', content: format.content || '' }
      : { id: '', title: '', content: '' };
    setDraft(nextDraft);
    setOriginal(nextDraft);
    setMessage('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDiscardDialogOpen(false);
    setDraft({ id: '', title: '', content: '' });
    setOriginal({ id: '', title: '', content: '' });
  };

  const cancelEdit = () => {
    if (JSON.stringify(draft) !== JSON.stringify(original)) {
      setDiscardDialogOpen(true);
      return;
    }
    closeDialog();
  };

  const saveFormat = async () => {
    if (!draft.title.trim() || !draft.content.trim()) {
      setMessage('請填寫主旨與內容。');
      return;
    }
    const savedFormat = {
      id: draft.id || `message-format-${Date.now()}`,
      title: draft.title.trim(),
      content: draft.content.trim(),
      updatedAt: new Date().toISOString()
    };
    const nextFormats = draft.id
      ? formats.map(format => format.id === draft.id ? savedFormat : format)
      : [savedFormat, ...formats];
    if (await persist(nextFormats, '訊息格式已儲存。')) closeDialog();
  };

  const copyFormat = async format => {
    try {
      await writeClipboardText(format.content);
      setCopiedId(format.id);
      setTimeout(() => setCopiedId(''), 1600);
    } catch {
      setMessage('複製失敗，請再試一次。');
    }
  };

  const deleteFormat = async () => {
    if (!formatToDelete) return;
    const nextFormats = formats.filter(format => format.id !== formatToDelete.id);
    if (await persist(nextFormats, '訊息格式已刪除。')) setFormatToDelete(null);
  };

  return (
    <>
      <section className="order-0 rounded-xl border border-[#EAE8E4] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#EAE8E4] pb-4">
          <div>
            <h2 className="text-lg font-bold">訊息格式</h2>
          </div>
          <button type="button" onClick={() => openDialog()} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#EA5B3C] text-white hover:bg-[#333333]" aria-label="新增訊息格式" title="新增訊息格式"><i className="ti ti-plus text-sm" /></button>
        </div>
        {message && <div className="mt-5 rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-3 py-2 text-xs font-bold text-[#666666]">{message}</div>}
        <div className="mt-5 space-y-3">
          {formats.length > 0 ? formats.map(format => (
            <div key={format.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 flex-1 break-words text-base font-bold">{format.title}</h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => copyFormat(format)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]" aria-label={`複製 ${format.title}`} title="複製"><i className={`ti ${copiedId === format.id ? 'ti-check text-green-600' : 'ti-copy'}`} /></button>
                  <button type="button" onClick={() => openDialog(format)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]" aria-label={`編輯 ${format.title}`} title="編輯"><i className="ti ti-pencil" /></button>
                  <button type="button" onClick={() => setFormatToDelete(format)} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50" aria-label={`刪除 ${format.title}`} title="刪除"><i className="ti ti-trash" /></button>
                </div>
              </div>
            </div>
          )) : <div className="rounded-xl border border-dashed border-[#D6D1CA] bg-[#F9F8F5] px-4 py-10 text-center text-xs text-[#888888]">尚未建立訊息格式，請點擊右上角新增。</div>}
        </div>
      </section>

      {dialogOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"><div role="dialog" aria-modal="true" aria-labelledby="message-format-dialog-title" className="w-full max-w-[600px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EAE8E4] px-6 py-4"><h3 id="message-format-dialog-title" className="flex items-center gap-2 text-base font-bold"><i className="ti ti-message-2 text-[#EA5B3C]" />{draft.id ? '編輯訊息格式' : '新增訊息格式'}</h3><button type="button" onClick={cancelEdit} disabled={saving} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#888888] hover:bg-[#F9F8F5] disabled:opacity-40" aria-label="關閉訊息格式視窗"><i className="ti ti-x" /></button></div>
        <div className="space-y-5 p-6">{message && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{message}</div>}<label className="block space-y-2"><span className="text-xs font-bold text-[#666666]">主旨：</span><input type="text" value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} className="w-full rounded-lg border border-[#EAE8E4] px-4 py-3 text-sm font-bold focus:border-[#EA5B3C] focus:outline-none" placeholder="請輸入訊息主旨" /></label><label className="block space-y-2"><span className="text-xs font-bold text-[#666666]">內容：</span><textarea value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} rows={8} className="w-full resize-y rounded-lg border border-[#EAE8E4] px-4 py-3 text-sm leading-7 focus:border-[#EA5B3C] focus:outline-none" placeholder="請輸入訊息內容" /></label><div className="flex justify-end gap-2 border-t border-[#EAE8E4] pt-4"><button type="button" onClick={cancelEdit} disabled={saving} className="rounded-lg border border-[#EAE8E4] px-4 py-2.5 text-xs font-bold disabled:opacity-50">取消</button><button type="button" onClick={saveFormat} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA5B3C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#333333] disabled:opacity-60"><i className={`ti ${saving ? 'ti-loader-2 animate-spin' : 'ti-check'}`} />{saving ? '儲存中...' : '儲存'}</button></div></div>
      </div></div>}

      {discardDialogOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4"><div role="alertdialog" aria-modal="true" aria-labelledby="discard-message-format-title" className="w-full max-w-[420px] rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"><div className="border-b border-[#EAE8E4] px-6 py-4"><h3 id="discard-message-format-title" className="flex items-center gap-2 text-base font-bold"><i className="ti ti-alert-triangle text-[#EA5B3C]" />放棄內容變更？</h3></div><div className="space-y-5 p-6"><p className="text-sm leading-7 text-[#666666]">主旨或內容已修改，確定要放棄此次內容變更嗎？</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setDiscardDialogOpen(false)} className="rounded-lg border border-[#EAE8E4] px-4 py-2.5 text-xs font-bold">繼續編輯</button><button type="button" onClick={closeDialog} className="rounded-lg bg-[#EA5B3C] px-4 py-2.5 text-xs font-bold text-white">放棄變更</button></div></div></div></div>}

      {formatToDelete && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-message-format-title" className="w-full max-w-[420px] rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"><div className="border-b border-[#EAE8E4] px-6 py-4"><h3 id="delete-message-format-title" className="flex items-center gap-2 text-base font-bold"><i className="ti ti-trash text-red-600" />刪除訊息格式？</h3></div><div className="space-y-5 p-6"><p className="text-sm leading-7 text-[#666666]">確定要刪除「{formatToDelete.title}」嗎？</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setFormatToDelete(null)} disabled={saving} className="rounded-lg border border-[#EAE8E4] px-4 py-2.5 text-xs font-bold disabled:opacity-50">取消</button><button type="button" onClick={deleteFormat} disabled={saving} className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{saving ? '刪除中...' : '確認刪除'}</button></div></div></div></div>}
    </>
  );
}
