'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function getWeeklyDates() {
  const dates = [];
  const now = new Date();
  const day = now.getDay();
  
  // Get Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  
  // Current week Mon-Fri
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `本週 ${['一', '二', '三', '四', '五'][i]}`,
      isNextWeek: false
    });
  }
  
  // Next week Mon-Fri
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  for (let i = 0; i < 5; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `下週 ${['一', '二', '三', '四', '五'][i]}`,
      isNextWeek: true
    });
  }
  return dates;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  
  // Scheduling state
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [orderDeadline, setOrderDeadline] = useState('09:40');
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  
  // Billing action state
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [savingAnnouncementId, setSavingAnnouncementId] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('');
  const [announcementDrafts, setAnnouncementDrafts] = useState({});
  const [announcementMessage, setAnnouncementMessage] = useState('');

  useEffect(() => {
    // Check authentication and role
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
            fetchSchedules();
            fetchAnnouncement();
          }
        }
      })
      .catch(() => router.push('/login'));

    // Default select today
    const today = new Date();
    setSelectedDate(formatDate(today));
  }, []);

  const fetchRestaurants = () => {
    fetch('/api/restaurants?active=true')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRestaurants(data);
        }
      })
      .catch(err => console.error('無法載入餐廳:', err));
  };

  const fetchSchedules = () => {
    fetch('/api/schedule')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSchedules(data);
        }
      })
      .catch(err => console.error('無法載入排程:', err));
  };

  const fetchAnnouncement = () => {
    fetch('/api/announcement')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(err => console.error('Failed to load announcement:', err));
  };

  const persistAnnouncements = async (nextAnnouncements, savingId, successMessage) => {
    setSavingAnnouncementId(savingId);
    setAnnouncementMessage('');

    try {
      const res = await fetch('/api/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcements: nextAnnouncements })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '公告儲存失敗');
      }

      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : nextAnnouncements);
      setAnnouncementMessage(successMessage);
      setTimeout(() => setAnnouncementMessage(''), 3000);
    } catch (err) {
      setAnnouncementMessage(err.message);
    } finally {
      setSavingAnnouncementId('');
    }
  };

  const getAnnouncementDraft = (item) => (
    announcementDrafts[item.id] || {
      title: item.title || '',
      content: item.content || '',
      pinned: Boolean(item.pinned)
    }
  );

  const isAnnouncementDirty = (item) => {
    const draft = getAnnouncementDraft(item);
    return draft.title !== (item.title || '')
      || draft.content !== (item.content || '')
      || Boolean(draft.pinned) !== Boolean(item.pinned);
  };

  const handleAddAnnouncement = () => {
    const now = new Date().toISOString();
    const id = `local-${Date.now()}`;
    const draft = { title: '', content: '', pinned: false };

    setAnnouncements(prev => [
      {
        id,
        ...draft,
        updatedAt: now
      },
      ...prev
    ]);
    setAnnouncementDrafts(prev => ({ ...prev, [id]: draft }));
    setEditingAnnouncementId(id);
  };

  const handleStartEditAnnouncement = (item) => {
    setAnnouncementDrafts(prev => ({
      ...prev,
      [item.id]: {
        title: item.title || '',
        content: item.content || '',
        pinned: Boolean(item.pinned)
      }
    }));
    setEditingAnnouncementId(item.id);
  };

  const handleAnnouncementDraftChange = (id, field, value) => {
    setAnnouncementDrafts(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { title: '', content: '', pinned: false }),
        [field]: value
      }
    }));
  };

  const clearAnnouncementDraft = (id) => {
    setAnnouncementDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCancelAnnouncementEdit = (item) => {
    if (isAnnouncementDirty(item) && !confirm('資料有變更，確認要放棄此次變更嗎？')) {
      return;
    }

    clearAnnouncementDraft(item.id);
    setEditingAnnouncementId('');
  };

  const handleSaveAnnouncementItem = (id) => {
    const target = announcements.find(item => item.id === id);
    if (!target || !isAnnouncementDirty(target)) return;

    const draft = getAnnouncementDraft(target);
    const nextAnnouncements = announcements.map(item => (
      item.id === id
        ? {
          ...item,
          title: draft.title,
          content: draft.content,
          pinned: Boolean(draft.pinned),
          updatedAt: new Date().toISOString()
        }
        : item
    ));

    persistAnnouncements(nextAnnouncements, id, '公告已儲存。');
    clearAnnouncementDraft(id);
    setEditingAnnouncementId('');
  };

  const handleToggleAnnouncementPinned = (id) => {
    const nextAnnouncements = announcements.map(item => (
      item.id === id
        ? {
          ...item,
          pinned: !item.pinned,
          updatedAt: new Date().toISOString()
        }
        : item
    ));

    persistAnnouncements(nextAnnouncements, id, '公告已儲存。');
  };

  const handleDeleteAnnouncement = (id) => {
    if (!confirm('確認要刪除此公告嗎？')) return;
    const nextAnnouncements = announcements.filter(item => item.id !== id);
    persistAnnouncements(nextAnnouncements, id, '公告已刪除。');
    clearAnnouncementDraft(id);
    if (editingAnnouncementId === id) setEditingAnnouncementId('');
  };

  const activeSchedule = schedules.find(s => s.date === selectedDate);
  const todayDate = formatDate(new Date());
  const todaySchedule = schedules.find(s => s.date === todayDate);
  const weeklyDates = getWeeklyDates();

  // Update schedule selection inputs
  useEffect(() => {
    if (activeSchedule) {
      setSelectedRestaurantId(activeSchedule.restaurantId);
      setOrderDeadline(activeSchedule.orderDeadline || '09:40');
    } else {
      setSelectedRestaurantId('');
      setOrderDeadline('09:40');
    }
    setMessage({ text: '', type: '' });
  }, [selectedDate, activeSchedule]);

  const handleSaveSchedule = async () => {
    if (!selectedRestaurantId) {
      setMessage({ text: '請選擇一個餐廳！', type: 'error' });
      return;
    }

    setIsUpdatingSchedule(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          restaurantId: selectedRestaurantId,
          orderDeadline
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '排程儲存失敗');
      }

      setMessage({ text: '排程設定已成功儲存！', type: 'success' });
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // Deliver and deduct balance API trigger
  const handleConfirmDelivery = async () => {
    if (!activeSchedule) return;
    
    // Count orders
    const orderCount = activeSchedule.userOrder ? 1 : (activeSchedule.orders?.length || 0);
    if (orderCount === 0) {
      alert('今天沒有任何訂餐訂單，不需進行點收扣款。');
      return;
    }

    if (!confirm(`您確定要確認「${selectedDate}」的餐點已送達並自動執行帳戶扣款嗎？\n此動作將自動扣除所有訂餐者的錢包餘額！`)) {
      return;
    }

    setIsProcessingDelivery(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/admin/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '點收失敗');
      }

      setMessage({ text: `點收扣款成功！${data.message}`, type: 'success' });
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsProcessingDelivery(false);
    }
  };

  // Compile daily items ordered statistics
  const getOrderedItemsSummary = () => {
    if (!activeSchedule || !activeSchedule.orders) return [];
    
    const summary = {}; // { menuItemId: { name, qty, price } }
    
    // Loop through each active order
    activeSchedule.orders.forEach(order => {
      if (order.status === 'cancelled') return;
      order.orderItems.forEach(oi => {
        const menuItemId = oi.menuItemId;
        const name = oi.menuItem?.name || '未知餐點';
        const qty = oi.quantity;
        const price = oi.unitPrice;
        
        if (summary[menuItemId]) {
          summary[menuItemId].qty += qty;
        } else {
          summary[menuItemId] = { name, qty, price };
        }
      });
    });
    
    return Object.values(summary).sort((a, b) => b.qty - a.qty);
  };

  const itemSummaries = getOrderedItemsSummary();
  const totalQuantity = itemSummaries.reduce((sum, item) => sum + item.qty, 0);
  const totalOrderAmount = itemSummaries.reduce((sum, item) => sum + item.price * item.qty, 0);

  const todayOrders = todaySchedule?.orders?.filter(order => order.status !== 'cancelled') || [];
  const todayTotalAmount = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayItemSummary = todayOrders.reduce((summary, order) => {
    order.orderItems.forEach(item => {
      const name = item.menuItem?.name || '未命名品項';
      if (!summary[name]) summary[name] = { name, qty: 0, price: item.unitPrice };
      summary[name].qty += item.quantity;
    });
    return summary;
  }, {});
  const todayItems = Object.values(todayItemSummary);

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入管理者權限中...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Header Title */}
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-chart-bar text-2xl text-[#EA5B3C]"></i> 訂單統計與公告
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/admin#announcement-editor')}
              className="text-xs font-bold bg-[#333333] text-white px-4 py-2 rounded-lg hover:bg-[#EA5B3C] transition-colors"
            >
              公告欄編輯
            </button>
          </div>
        </div>

        {/* Admin Home Overview */}
        <section id="order-stats-announcement" className="scroll-mt-24 space-y-6">
          <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#EAE8E4] pb-4">
              <div>
                <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">今日總覽</p>
                <h3 className="text-lg font-bold text-[#333333] mt-1">本日餐廳與訂餐結果</h3>
              </div>
              <div className="text-sm font-bold text-[#EA5B3C]">{todayDate}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">本日餐廳</p>
                <p className="text-base font-bold text-[#333333] truncate">
                  {todaySchedule?.restaurant?.name || '未排定'}
                </p>
              </div>
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">今日訂購者</p>
                <p className="text-base font-bold text-[#333333]">{todayOrders.length} 人</p>
              </div>
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">訂單金額</p>
                <p className="text-base font-bold text-[#EA5B3C]">NT$ {todayTotalAmount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#333333] flex items-center gap-2">
                  <i className="ti ti-list-check text-[#EA5B3C]"></i> 品項總計
                </h4>
                <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2 kaizen-scrollbar">
                  {todayItems.length > 0 ? todayItems.map(item => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-[#EAE8E4] px-3 py-2 text-xs">
                      <span className="font-bold text-[#333333] truncate">{item.name}</span>
                      <span className="shrink-0 text-[#888888]">x {item.qty}</span>
                    </div>
                  )) : (
                    <div className="text-xs text-[#888888] bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg px-3 py-8 text-center">
                      今日尚無訂餐內容。
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#333333] flex items-center gap-2">
                  <i className="ti ti-users text-[#EA5B3C]"></i> 今日訂購者訂餐內容
                </h4>
                <div className="max-h-[240px] overflow-y-auto pr-1 space-y-3 kaizen-scrollbar">
                  {todayOrders.length > 0 ? todayOrders.map(order => (
                    <div key={order.id} className="rounded-lg border border-[#EAE8E4] p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-[#333333] truncate">{order.user?.name || '未命名成員'}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {order.orderNumberDisplay && (
                            <span className="rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-2 py-0.5 text-[10px] font-bold text-[#EA5B3C]">
                              {'\u7de8\u865f'} {order.orderNumberDisplay}
                            </span>
                          )}
                          <span className="font-bold text-[#EA5B3C]">NT$ {order.totalAmount}</span>
                        </div>
                      </div>
                      <div className="text-[#888888] leading-relaxed">
                        {order.orderItems.map(item => (
                          <div key={item.id} className="flex justify-between gap-3">
                            <span className="truncate">{item.menuItem?.name || '未命名品項'}</span>
                            <span className="shrink-0">x {item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      {order.note && <p className="text-[#888888] border-t border-[#EAE8E4] pt-2">備註：{order.note}</p>}
                    </div>
                  )) : (
                    <div className="text-xs text-[#888888] bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg px-3 py-8 text-center">
                      今日尚無訂購者。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div id="announcement-editor" className="scroll-mt-24 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#EAE8E4] pb-4">
              <div>
                <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">訂購者首頁管理</p>
                <h3 className="text-lg font-bold text-[#333333] mt-1">公告欄編輯</h3>
              </div>
              <button
                onClick={handleAddAnnouncement}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#EA5B3C] text-white px-4 py-2 rounded-lg hover:bg-[#333333] transition-colors"
              >
                <i className="ti ti-plus text-sm"></i> 新增公告
              </button>
            </div>

            {announcementMessage && (
              <div className="p-3 text-xs rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-1.5">
                <i className="ti ti-info-circle"></i>
                {announcementMessage}
              </div>
            )}

            <div className="space-y-4">
              {announcements.length > 0 ? announcements.map((item, index) => {
                const draft = getAnnouncementDraft(item);
                const isEditing = editingAnnouncementId === item.id;
                const isDirty = isAnnouncementDirty(item);

                return (
                  <div key={item.id} className="border border-[#EAE8E4] rounded-xl bg-[#F9F8F5] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-[#888888] tracking-widest uppercase pt-2">
                        {item.pinned ? '釘選公告' : `公告 ${index + 1}`}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveAnnouncementItem(item.id)}
                            disabled={savingAnnouncementId === item.id || !isDirty}
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all disabled:cursor-not-allowed ${
                              isDirty
                                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300'
                                : 'border-[#EAE8E4] bg-white text-[#D6D1CA] opacity-60'
                            }`}
                            title="儲存公告"
                            aria-label="儲存公告"
                          >
                            <i className={savingAnnouncementId === item.id ? 'ti ti-loader animate-spin text-base' : 'ti ti-check text-base'}></i>
                          </button>
                          <button
                            onClick={() => handleCancelAnnouncementEdit(item)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#333333] hover:text-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="取消編輯"
                            aria-label="取消編輯"
                          >
                            <i className="ti ti-x text-base"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAnnouncementPinned(item.id)}
                            disabled={savingAnnouncementId === item.id}
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              item.pinned
                                ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C] hover:bg-[#FFE7DE]'
                                : 'border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                            }`}
                            title={item.pinned ? '取消釘選' : '釘選公告'}
                            aria-label={item.pinned ? '取消釘選' : '釘選公告'}
                          >
                            <i className="ti ti-pin text-base"></i>
                          </button>
                          <button
                            onClick={() => handleStartEditAnnouncement(item)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="編輯公告"
                            aria-label="編輯公告"
                          >
                            <i className="ti ti-pencil text-base"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(item.id)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="刪除公告"
                            aria-label="刪除公告"
                          >
                            <i className="ti ti-trash text-base"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) => handleAnnouncementDraftChange(item.id, 'title', e.target.value)}
                          className="w-full text-sm px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-bold"
                          placeholder="請輸入公告標題"
                        />
                        <textarea
                          value={draft.content}
                          onChange={(e) => handleAnnouncementDraftChange(item.id, 'content', e.target.value)}
                          rows={6}
                          className="w-full resize-none text-sm leading-6 px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white"
                          placeholder="請輸入公告內容"
                        />
                      </>
                    ) : (
                      <article className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-base font-bold text-[#333333] break-words">
                            {item.title || '未命名公告'}
                          </h4>
                          {item.pinned && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-2 py-1 text-[11px] font-bold text-[#EA5B3C]">
                              <i className="ti ti-pin text-xs"></i> ??
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[#555555] leading-7 whitespace-pre-wrap break-words">
                          {item.content || '此公告尚無內容。'}
                        </div>
                      </article>
                    )}

                    {item.updatedAt && (
                      <p className="text-[11px] text-[#888888] text-right">
                        最後更新：{new Date(item.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-10 text-xs text-[#888888] border border-dashed border-[#D6D1CA] rounded-xl bg-[#F9F8F5]">
                  目前尚無公告，請點擊「新增公告」建立第一則公告。
                </div>
              )}
            </div>
          </div>
        </section>


      </main>
    </>
  );
}
