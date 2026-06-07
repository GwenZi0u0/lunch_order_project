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
  const [announcement, setAnnouncement] = useState('');
  const [orderGuide, setOrderGuide] = useState('');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
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
        if (typeof data.announcement === 'string') {
          setAnnouncement(data.announcement);
        }
        if (typeof data.orderGuide === 'string') {
          setOrderGuide(data.orderGuide);
        }
      })
      .catch(err => console.error('Failed to load announcement:', err));
  };

  const handleSaveAnnouncement = async () => {
    setIsSavingAnnouncement(true);
    setAnnouncementMessage('');

    try {
      const res = await fetch('/api/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement, orderGuide })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '公告儲存失敗');
      }

      setAnnouncement(data.announcement);
      setOrderGuide(data.orderGuide);
      setAnnouncementMessage('公告已更新。');
      setTimeout(() => setAnnouncementMessage(''), 3000);
    } catch (err) {
      setAnnouncementMessage(err.message);
    } finally {
      setIsSavingAnnouncement(false);
    }
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
            <i className="ti ti-calendar-week text-2xl text-[#EA5B3C]"></i> 週菜單排程與訂單統計後台
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/admin/restaurants')}
              className="text-xs font-bold bg-[#333333] text-white px-4 py-2 rounded-lg hover:bg-[#EA5B3C] transition-colors"
            >
              餐廳菜單管理
            </button>
            <button
              onClick={() => router.push('/admin/wallets')}
              className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
            >
              成員錢包儲值
            </button>
          </div>
        </div>

        {/* Admin Home Overview */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
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
                        <span className="font-bold text-[#EA5B3C] shrink-0">NT$ {order.totalAmount}</span>
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

          <div className="xl:col-span-2 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-4">
            <div className="border-b border-[#EAE8E4] pb-4">
              <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">訂購者首頁管理</p>
              <h3 className="text-lg font-bold text-[#333333] mt-1">公告欄編輯</h3>
            </div>
            <textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              rows={6}
              className="w-full resize-none text-sm leading-6 px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-[#F9F8F5]"
              placeholder="請輸入公告欄內容"
            />
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#888888] tracking-widest uppercase">每日訂單流程說明</label>
              <textarea
                value={orderGuide}
                onChange={(e) => setOrderGuide(e.target.value)}
                rows={5}
                className="w-full resize-none text-sm leading-6 px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-[#F9F8F5]"
                placeholder="請輸入訂購者首頁的每日訂單流程說明"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[#888888] min-h-[1rem]">{announcementMessage}</span>
              <button
                onClick={handleSaveAnnouncement}
                disabled={isSavingAnnouncement || announcement.trim().length === 0 || orderGuide.trim().length === 0}
                className="shrink-0 text-xs font-bold bg-[#EA5B3C] text-white px-4 py-2 rounded-lg hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingAnnouncement ? '儲存中...' : '儲存首頁內容'}
              </button>
            </div>
          </div>
        </section>

        {/* Date Navigator Grid */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-sm font-bold text-[#333333] tracking-widest uppercase">
              1. 選擇管理日期
            </h3>
            
            {/* Week Tab Switcher */}
            <div className="inline-flex bg-[#F9F8F5] border border-[#EAE8E4] p-1 rounded-xl">
              <button
                onClick={() => setActiveWeekTab('current')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all ${
                  activeWeekTab === 'current' ? 'bg-[#EA5B3C] text-white' : 'text-[#888888] hover:text-[#333333]'
                }`}
              >
                本週日程
              </button>
              <button
                onClick={() => setActiveWeekTab('next')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all ${
                  activeWeekTab === 'next' ? 'bg-[#EA5B3C] text-white' : 'text-[#888888] hover:text-[#333333]'
                }`}
              >
                下週日程
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {weeklyDates
              .filter(d => (activeWeekTab === 'current' ? !d.isNextWeek : d.isNextWeek))
              .map(d => {
                const sched = schedules.find(s => s.date === d.dateStr);
                const isSelected = selectedDate === d.dateStr;
                const totalOrdersCount = sched?.orders ? sched.orders.filter(o => o.status !== 'cancelled').length : 0;
                
                return (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'border-[#EA5B3C] bg-white ring-1 ring-[#EA5B3C]'
                        : 'border-[#EAE8E4] bg-white hover:border-[#D6D1CA]'
                    }`}
                  >
                    <div className="text-xs text-[#888888] mb-1 font-bold">{d.label}</div>
                    <div className="text-sm font-bold text-[#333333] truncate">
                      {sched ? sched.restaurant.name : '（未排定）'}
                    </div>
                    {sched?.deliveredAt && (
                      <span className="absolute top-2 right-2 bg-green-100 text-green-700 text-[8px] font-bold px-1 rounded border border-green-300">
                        已扣款
                      </span>
                    )}
                    {totalOrdersCount > 0 && !sched?.deliveredAt && (
                      <span className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                        {totalOrdersCount} 份
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </section>

        {/* Schedule settings & Stats columns */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Scheduling Setup Panel (Col-span 1) */}
          <div className="space-y-6">
            <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-6">
              <h3 className="font-bold text-base text-[#333333] border-b border-[#EAE8E4] pb-3 flex items-center gap-2">
                <i className="ti ti-settings text-lg text-[#EA5B3C]"></i> 供餐排程設定
              </h3>

              {message.text && (
                <div className={`p-3 text-xs rounded-lg flex items-center gap-1.5 ${
                  message.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-600' 
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}>
                  <i className={message.type === 'success' ? 'ti ti-discount-check' : 'ti ti-alert-circle'}></i>
                  {message.text}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#888888]">供餐日期</label>
                  <input
                    type="text"
                    disabled={true}
                    value={selectedDate}
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg bg-[#F9F8F5] font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#888888]">指定當日餐廳</label>
                  <select
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                  >
                    <option value="">-- 請選擇餐廳 --</option>
                    {restaurants.map(rest => (
                      <option key={rest.id} value={rest.id}>{rest.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#888888]">訂單截止時間</label>
                  <input
                    type="time"
                    value={orderDeadline}
                    onChange={(e) => setOrderDeadline(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                  />
                </div>

                <button
                  onClick={handleSaveSchedule}
                  disabled={isUpdatingSchedule || !selectedRestaurantId}
                  className="w-full py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingSchedule ? '正在儲存...' : '儲存排程設定'}
                </button>
              </div>

              {activeSchedule && (
                <div className="border-t border-[#EAE8E4] pt-4 space-y-4">
                  <h4 className="text-xs font-bold text-[#888888] tracking-widest uppercase">出餐結算控制</h4>
                  
                  {activeSchedule.deliveredAt ? (
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold flex flex-col gap-1 items-center text-center">
                      <i className="ti ti-circle-check text-2xl mb-1"></i>
                      <span>餐點已送達，扣款結算完成！</span>
                      <span className="text-[10px] font-normal text-gray-500 mt-1">
                        點收時間: {new Date(activeSchedule.deliveredAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-[#888888] leading-tight">
                        中午餐點送達後，請確認清點便當數量無誤，並點擊下方按鈕觸發錢包扣款。
                      </p>
                      <button
                        onClick={handleConfirmDelivery}
                        disabled={isProcessingDelivery || totalQuantity === 0}
                        className="w-full py-3 text-xs font-bold bg-green-600 text-white rounded-xl shadow-sm hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessingDelivery ? '正在結算扣款中...' : '確認送達並自動扣款'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Daily Orders Statistics & Summaries (Col-span 2) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="c-box space-y-8">
              
              {/* Restaurant Headline */}
              <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-5">
                <div>
                  <span className="text-xs font-bold text-[#888888] tracking-widest uppercase block mb-1">當日統計資訊 ({selectedDate})</span>
                  <h3 className="text-xl font-bold text-[#333333]">
                    {activeSchedule ? `${activeSchedule.restaurant.name} 訂餐彙整` : '（當日尚未安排餐廳）'}
                  </h3>
                </div>

                {activeSchedule && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#888888] block">今日總份數</span>
                    <span className="text-2xl font-bold text-[#EA5B3C]">{totalQuantity} 份</span>
                  </div>
                )}
              </div>

              {activeSchedule ? (
                <>
                  {/* Aggregated Menu Item Quantities - FOR RESTAURANT CALLS */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5 flex justify-between items-center">
                      <span>便當品項總計 (方便撥打電話點餐)</span>
                      <span className="text-xs font-bold text-[#888888]">
                        總消費額: <span className="text-[#333333]">NT$ {totalOrderAmount}</span>
                      </span>
                    </h4>

                    {itemSummaries.length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#888888]">
                        今天尚未有任何成員訂餐。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {itemSummaries.map(item => (
                          <div key={item.name} className="p-4 bg-[#F9F8F5] border border-[#EAE8E4] rounded-xl flex justify-between items-center">
                            <div>
                              <span className="font-bold text-sm text-[#333333]">{item.name}</span>
                              <span className="text-xs text-[#888888] block mt-1">單價: NT$ {item.price}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-[#EA5B3C]">{item.qty}</span>
                              <span className="text-xs font-bold text-[#333333] ml-1">份</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Individual User Orders Spreadsheet */}
                  <div className="space-y-4 pt-4 border-t border-[#EAE8E4]">
                    <h4 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                      成員訂單明細與備註
                    </h4>

                    {activeSchedule.orders && activeSchedule.orders.filter(o => o.status !== 'cancelled').length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#888888]">
                        尚無成員明細。
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-[#EAE8E4] rounded-xl bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#F9F8F5] text-[#888888] font-bold border-b border-[#EAE8E4]">
                              <th className="p-3">姓名</th>
                              <th className="p-3">點購餐點與數量</th>
                              <th className="p-3 text-right">小計</th>
                              <th className="p-3">成員客製備註</th>
                              <th className="p-3">狀態</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                            {activeSchedule.orders && activeSchedule.orders
                              .filter(o => o.status !== 'cancelled')
                              .map(order => (
                                <tr key={order.id} className="hover:bg-[#F9F8F5]/30">
                                  <td className="p-3 font-bold">{order.user.name}</td>
                                  <td className="p-3 leading-normal">
                                    {order.orderItems.map(oi => (
                                      <div key={oi.id} className="font-medium">
                                        {oi.menuItem.name} <span className="text-[#888888]">x {oi.quantity}</span>
                                      </div>
                                    ))}
                                  </td>
                                  <td className="p-3 text-right font-bold text-[#EA5B3C]">
                                    NT$ {order.totalAmount}
                                  </td>
                                  <td className="p-3 text-[#888888] italic">
                                    {order.note ? order.note : '—'}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      order.status === 'delivered'
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                                    }`}>
                                      {order.status === 'delivered' ? '已扣款' : '已訂購'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-xs text-[#888888] space-y-4">
                  <i className="ti ti-calendar-off text-5xl text-[#D6D1CA]"></i>
                  <h4 className="font-bold text-[#333333] text-sm">今天沒有安排供餐排程</h4>
                  <p>請使用左側設定面板為此日期指定餐廳以開放成員訂購。</p>
                </div>
              )}

            </div>
          </div>

        </section>

      </main>
    </>
  );
}
