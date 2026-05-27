'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

const MENU_JSON_EXAMPLE = {
  "餐廳": "好食肌",
  "品項列表": [
    { "類型": "餐盒", "品項": "香煎鮭魚餐盒", "價格": 160 },
    { "類型": "餐盒", "品項": "板腱牛排餐盒", "價格": 160 },
    { "類型": "餐盒", "品項": "低溫烹調嫩雞肉餐盒", "價格": 120 }
  ]
};

export default function RestaurantsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  
  // Import and New Restaurant State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrWarning, setOcrWarning] = useState('');
  const [newRestName, setNewRestName] = useState('');
  const [newRestPhone, setNewRestPhone] = useState('');
  const [newRestCategory, setNewRestCategory] = useState('便當');
  const [newRestNote, setNewRestNote] = useState('');
  const [menuItems, setMenuItems] = useState([]); // [{ name, price, category }]
  
  // UI states
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    // Check authentication
    fetch('/api/auth')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return;
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          setUser(data.user);
          if (data.user.role !== 'admin') {
            router.push('/portal');
          } else {
            fetchRestaurants();
          }
        }
      })
      .catch(() => router.push('/login'));
  }, []);

  const fetchRestaurants = () => {
    fetch('/api/restaurants?active=false') // fetch all, active or inactive
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRestaurants(data);
        }
      })
      .catch(err => console.error('無法載入餐廳列表:', err));
  };

  const normalizeImportedMenu = (parsed) => {
    const restaurantName = parsed['餐廳'] || parsed.restaurant || parsed.name || '';
    const importedItems = parsed['品項列表'] || parsed.menuItems || parsed.items || [];

    if (!restaurantName || !Array.isArray(importedItems) || importedItems.length === 0) {
      throw new Error('JSON 格式不正確，請確認包含「餐廳」與「品項列表」。');
    }

    const normalizedItems = importedItems.map((item) => ({
      category: item['類型'] || item.category || '主食',
      name: item['品項'] || item.name || '',
      price: Number(item['價格'] ?? item.price ?? 0),
    })).filter(item => item.name && Number.isFinite(item.price) && item.price > 0);

    if (normalizedItems.length === 0) {
      throw new Error('JSON 內沒有可匯入的品項，請確認每個品項都有名稱與價格。');
    }

    return {
      name: restaurantName,
      category: parsed['類型'] || parsed.category || normalizedItems[0]?.category || '便當',
      phone: parsed['電話'] || parsed.phone || '',
      note: parsed['備註'] || parsed.note || '',
      menuItems: normalizedItems,
    };
  };

  const handleJsonImport = () => {
    setOcrLoading(true);
    setOcrWarning('');
    setStatusMsg({ text: '', type: '' });

    try {
      const parsed = normalizeImportedMenu(JSON.parse(jsonInput));

      setNewRestName(parsed.name);
      setNewRestPhone(parsed.phone);
      setNewRestCategory(parsed.category);
      setNewRestNote(parsed.note);
      setMenuItems(parsed.menuItems);
      setJsonDialogOpen(false);
      setStatusMsg({ text: 'JSON 匯入完成！請在下方表格中校對確認項目。', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message || 'JSON 匯入失敗', type: 'error' });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCopyJsonExample = async () => {
    try {
      const exampleText = JSON.stringify(MENU_JSON_EXAMPLE, null, 2);
      await navigator.clipboard.writeText(exampleText);
      setJsonInput(exampleText);
      setStatusMsg({ text: '已複製 JSON 範例。', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: '複製失敗，請確認瀏覽器剪貼簿權限。', type: 'error' });
    }
  };

  const openJsonDialog = () => {
    setJsonInput((current) => current || JSON.stringify(MENU_JSON_EXAMPLE, null, 2));
    setJsonDialogOpen(true);
    setStatusMsg({ text: '', type: '' });
  };

  // OCR upload handler
  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrWarning('');
    setStatusMsg({ text: '', type: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'OCR 辨識失敗');
      }

      const parsed = result.data;
      setNewRestName(parsed.name || '');
      setNewRestPhone(parsed.phone || '');
      setNewRestCategory(parsed.category || '便當');
      setMenuItems(parsed.menuItems || []);
      
      if (result.warning) {
        setOcrWarning(result.warning);
      }

      setStatusMsg({ text: 'AI 菜單辨識完成！請在下方表格中校對確認項目。', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setOcrLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleMenuItemChange = (index, field, value) => {
    setMenuItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddMenuItem = () => {
    setMenuItems(prev => [...prev, { name: '', price: 0, category: '主食' }]);
  };

  const handleRemoveMenuItem = (index) => {
    setMenuItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRestaurant = async () => {
    if (!newRestName) {
      setStatusMsg({ text: '請輸入餐廳名稱！', type: 'error' });
      return;
    }

    if (menuItems.length === 0) {
      setStatusMsg({ text: '餐廳菜單內必須至少新增一個餐點項目！', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRestName,
          category: newRestCategory,
          phone: newRestPhone,
          note: newRestNote,
          menuItems
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '儲存失敗');
      }

      setStatusMsg({ text: '餐廳與菜單已成功儲存入庫！', type: 'success' });
      fetchRestaurants();
      
      // Clear forms
      setNewRestName('');
      setNewRestPhone('');
      setNewRestCategory('便當');
      setNewRestNote('');
      setMenuItems([]);
      setOcrWarning('');
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入中...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Page Title */}
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-building-store text-2xl text-[#EA5B3C]"></i> 餐廳與菜單管理
          </h2>
          <button
            onClick={() => router.push('/admin')}
            className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
          >
            返回排程總覽
          </button>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Active Restaurants List (Col-span 1) */}
          <div className="space-y-6">
            <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="font-bold text-sm text-[#333333] border-b border-[#EAE8E4] pb-3 flex justify-between items-center">
                <span>現有餐廳列表</span>
                <span className="text-xs font-bold text-[#888888]">共 {restaurants.length} 家</span>
              </h3>

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {restaurants.length === 0 ? (
                  <p className="text-center py-8 text-xs text-[#888888]">目前尚未建立任何餐廳。</p>
                ) : (
                  restaurants.map(rest => (
                    <div 
                      key={rest.id} 
                      className="p-4 bg-[#F9F8F5] border border-[#EAE8E4] rounded-xl space-y-2 hover:border-[#EA5B3C] transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-[#333333] truncate max-w-[150px]">{rest.name}</span>
                        <span className="bg-[#EAE8E4] text-[#333333] text-[9px] font-bold px-2 py-0.5 rounded-full">
                          {rest.category}
                        </span>
                      </div>
                      
                      {rest.phone && (
                        <div className="text-[11px] text-[#888888]">
                          <i className="ti ti-phone"></i> {rest.phone}
                        </div>
                      )}
                      
                      <div className="text-[10px] text-orange-600 font-bold bg-white inline-block px-2 py-0.5 rounded border border-[#EAE8E4]">
                        含 {rest.menuItems?.length || 0} 個品項
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* JSON Import and Add Menu Panel (Col-span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="c-box space-y-6">
              <h3 className="font-bold text-base text-[#333333] border-b border-[#EAE8E4] pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <i className="ti ti-file-import text-lg text-[#EA5B3C]"></i> 新增餐廳與菜單匯入
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openJsonDialog}
                    disabled={ocrLoading}
                    className="text-xs font-bold bg-[#EA5B3C] hover:bg-[#333333] text-white px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className="ti ti-file-import"></i>
                    {ocrLoading ? '匯入中...' : '匯入 JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJsonExample}
                    className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:text-[#EA5B3C] hover:border-[#EA5B3C] px-4 py-2 rounded-lg bg-white transition-all flex items-center gap-1.5"
                  >
                    <i className="ti ti-copy"></i>
                    複製範例
                  </button>
                </div>
              </h3>

              {statusMsg.text && (
                <div className={`p-4 text-xs rounded-xl flex items-start gap-2 ${
                  statusMsg.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-700 font-bold' 
                    : 'bg-red-50 border border-red-200 text-red-700 font-bold'
                }`}>
                  <i className={`text-base ${statusMsg.type === 'success' ? 'ti ti-circle-check' : 'ti ti-alert-circle'}`}></i>
                  <div>{statusMsg.text}</div>
                </div>
              )}

              {ocrWarning && (
                <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
                  <i className="ti ti-alert-triangle text-base text-orange-600"></i>
                  {ocrWarning}
                </div>
              )}

              {/* Form Input Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#888888]">餐廳名稱 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRestName}
                    onChange={(e) => setNewRestName(e.target.value)}
                    placeholder="例如: 池上木片便當"
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#888888]">分類</label>
                  <select
                    value={newRestCategory}
                    onChange={(e) => setNewRestCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                  >
                    <option value="便當">便當</option>
                    <option value="麵食">麵食</option>
                    <option value="日式">日式</option>
                    <option value="小吃">小吃</option>
                    <option value="飲料">飲料</option>
                    <option value="其他">其他</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#888888]">聯絡電話</label>
                  <input
                    type="text"
                    value={newRestPhone}
                    onChange={(e) => setNewRestPhone(e.target.value)}
                    placeholder="例如: 02-12345678"
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#888888]">外送規則與備註 (最低消費限制、附湯說明等)</label>
                <input
                  type="text"
                  value={newRestNote}
                  onChange={(e) => setNewRestNote(e.target.value)}
                  placeholder="例如: 滿 $300 起送，便當皆附每日例湯"
                  className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                />
              </div>

              {/* Editable Menu Items Table */}
              <div className="space-y-4 pt-4 border-t border-[#EAE8E4]">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                    菜單品項校對編輯
                  </h4>
                  <button
                    onClick={handleAddMenuItem}
                    className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:text-[#EA5B3C] hover:border-[#EA5B3C] px-3 py-1.5 rounded-lg bg-white transition-all flex items-center gap-1"
                  >
                    <i className="ti ti-plus"></i> 新增品項
                  </button>
                </div>

                {menuItems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#D6D1CA] rounded-xl text-xs text-[#888888] space-y-2">
                    <i className="ti ti-clipboard-list text-3xl"></i>
                    <p>尚無任何餐點項目。請手動點擊「新增品項」或上傳菜單圖片進行「AI 辨識」。</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#EAE8E4] rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F9F8F5] text-[#888888] font-bold border-b border-[#EAE8E4]">
                          <th className="p-3">品項名稱</th>
                          <th className="p-3 w-[120px]">單價 (NT$)</th>
                          <th className="p-3 w-[150px]">品項分類</th>
                          <th className="p-3 w-[60px] text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                        {menuItems.map((item, index) => (
                          <tr key={index} className="hover:bg-[#F9F8F5]/30">
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleMenuItemChange(index, 'name', e.target.value)}
                                placeholder="例如: 酥炸排骨飯"
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleMenuItemChange(index, 'price', parseInt(e.target.value, 10) || 0)}
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.category || '主食'}
                                onChange={(e) => handleMenuItemChange(index, 'category', e.target.value)}
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                              >
                                <option value="主食">主食</option>
                                <option value="配菜">配菜</option>
                                <option value="飲料湯品">飲料湯品</option>
                              </select>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveMenuItem(index)}
                                className="w-7 h-7 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-full flex items-center justify-center transition-all mx-auto"
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              {menuItems.length > 0 && (
                <div className="pt-4 border-t border-[#EAE8E4] flex justify-end">
                  <button
                    disabled={isSaving || !newRestName}
                    onClick={handleSaveRestaurant}
                    className="px-8 py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSaving ? '正在儲存入庫...' : '確認結構無誤，儲存建立餐廳'}
                  </button>
                </div>
              )}

            </div>
          </div>

        </section>

      </main>

      {jsonDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[680px] rounded-xl bg-white shadow-2xl border border-[#EAE8E4] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE8E4]">
              <h3 className="font-bold text-base text-[#333333] flex items-center gap-2">
                <i className="ti ti-file-import text-[#EA5B3C]"></i>
                匯入 JSON
              </h3>
              <button
                type="button"
                onClick={() => setJsonDialogOpen(false)}
                className="w-8 h-8 rounded-full border border-transparent hover:border-[#EAE8E4] hover:bg-[#F9F8F5] text-[#888888] flex items-center justify-center transition-all"
                aria-label="關閉"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full min-h-[320px] resize-y rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-4 font-mono text-xs leading-relaxed text-[#333333] focus:outline-none focus:border-[#EA5B3C]"
                spellCheck={false}
              />

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCopyJsonExample}
                  className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:text-[#EA5B3C] hover:border-[#EA5B3C] px-4 py-2 rounded-lg bg-white transition-all flex items-center justify-center gap-1.5"
                >
                  <i className="ti ti-copy"></i>
                  複製範例
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setJsonDialogOpen(false)}
                    className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:border-[#333333] px-4 py-2 rounded-lg bg-white transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleJsonImport}
                    disabled={ocrLoading || !jsonInput.trim()}
                    className="text-xs font-bold bg-[#EA5B3C] hover:bg-[#333333] text-white px-5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className="ti ti-check"></i>
                    提交匯入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
