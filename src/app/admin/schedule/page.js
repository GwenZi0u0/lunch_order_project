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
  const weekdayLabels = ['\u9031\u4e00', '\u9031\u4e8c', '\u9031\u4e09', '\u9031\u56db', '\u9031\u4e94', '\u9031\u516d', '\u9031\u65e5'];
  
  // Get Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  
  // Current week Mon-Sun
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `\u672c\u9031${weekdayLabels[i]}`,
      isWeekend: i >= 5,
      isNextWeek: false
    });
  }
  
  // Next week Mon-Sun
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `\u4e0b\u9031${weekdayLabels[i]}`,
      isWeekend: i >= 5,
      isNextWeek: true
    });
  }
  return dates;
}

function isWeekendDate(dateStr) {
  const day = new Date(`${dateStr}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [members, setMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  
  // Scheduling state
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [orderDeadline, setOrderDeadline] = useState('09:40');
  const [isHoliday, setIsHoliday] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [orderEditor, setOrderEditor] = useState(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  
  // Billing action state
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [orderGuideTitle, setOrderGuideTitle] = useState('');
  const [orderGuide, setOrderGuide] = useState('');
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [manualNotification, setManualNotification] = useState('請記得完成午餐訂購。');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

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
            fetchMembers();
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

  const fetchMembers = () => {
    fetch('/api/wallets?action=list_users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMembers(data);
        }
      })
      .catch(err => console.error('Failed to load members:', err));
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
        if (typeof data.announcementTitle === 'string') {
          setAnnouncementTitle(data.announcementTitle);
        }
        if (typeof data.announcement === 'string') {
          setAnnouncement(data.announcement);
        }
        if (typeof data.orderGuideTitle === 'string') {
          setOrderGuideTitle(data.orderGuideTitle);
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
        body: JSON.stringify({ announcementTitle, announcement, orderGuideTitle, orderGuide })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '公告儲存失敗');
      }

      setAnnouncementTitle(data.announcementTitle);
      setAnnouncement(data.announcement);
      setOrderGuideTitle(data.orderGuideTitle);
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
  const selectedDateIsHoliday = activeSchedule ? !activeSchedule.isOpen : isHoliday;
  const activeMenuItems = activeSchedule?.restaurant?.menuItems || [];

  // Update schedule selection inputs
  useEffect(() => {
    if (activeSchedule) {
      setSelectedRestaurantId(activeSchedule.restaurantId || '');
      setOrderDeadline(activeSchedule.orderDeadline || '09:40');
      setIsHoliday(!activeSchedule.isOpen);
    } else {
      setSelectedRestaurantId('');
      setOrderDeadline('09:40');
      setIsHoliday(isWeekendDate(selectedDate));
    }
    setMessage({ text: '', type: '' });
    setOrderEditor(null);
  }, [selectedDate, activeSchedule]);

  const handleSaveSchedule = async () => {
    if (!isHoliday && !selectedRestaurantId) {
      setMessage({ text: '請選擇一個餐廳！', type: 'error' });
      return;
    }

    const nextRestaurantId = isHoliday ? null : selectedRestaurantId;
    const activeOrderCount = activeSchedule?.orders?.filter(order => order.status !== 'cancelled').length || 0;
    const isRestaurantChanging = Boolean(activeSchedule)
      && activeSchedule.restaurantId !== nextRestaurantId;
    const shouldClearOrders = isRestaurantChanging && activeOrderCount > 0;

    if (shouldClearOrders && !confirm('\u6b64\u65e5\u671f\u5df2\u6709\u8a02\u8cfc\u8005\u8a02\u9910\uff0c\u78ba\u8a8d\u8b8a\u66f4\u9910\u5ef3\u55ce\uff1f\u78ba\u8a8d\u5f8c\u5c07\u6e05\u9664\u7576\u65e5\u6240\u6709\u5df2\u8a02\u8cfc\u9910\u9ede\uff0c\u4e26\u8acb\u8a02\u8cfc\u8005\u91cd\u65b0\u8a02\u9910\u3002')) {
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
          restaurantId: nextRestaurantId,
          orderDeadline,
          isOpen: !isHoliday,
          clearOrdersOnRestaurantChange: shouldClearOrders
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

  const startNewOrder = () => {
    setOrderEditor({
      orderId: null,
      userId: '',
      note: '',
      quantities: {}
    });
  };

  const startEditOrder = (order) => {
    const quantities = {};
    order.orderItems.forEach(item => {
      quantities[item.menuItemId] = item.quantity;
    });

    setOrderEditor({
      orderId: order.id,
      userId: order.userId,
      note: order.note || '',
      quantities
    });
  };

  const updateOrderItemQuantity = (menuItemId, value) => {
    const quantity = Math.max(0, parseInt(value, 10) || 0);
    setOrderEditor(prev => ({
      ...prev,
      quantities: {
        ...prev.quantities,
        [menuItemId]: quantity
      }
    }));
  };

  const handleSaveAdminOrder = async () => {
    if (!activeSchedule || !orderEditor) return;

    const items = Object.entries(orderEditor.quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    if (!orderEditor.userId) {
      setMessage({ text: '請選擇成員。', type: 'error' });
      return;
    }

    if (items.length === 0) {
      setMessage({ text: '請至少選擇一個品項數量。', type: 'error' });
      return;
    }

    setIsSavingOrder(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule.id,
          targetUserId: orderEditor.userId,
          items,
          note: orderEditor.note
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '訂單儲存失敗。');
      }

      setMessage({ text: '訂單已儲存。', type: 'success' });
      setOrderEditor(null);
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleCancelAdminOrder = async (orderId) => {
    if (!confirm('確認要取消此筆訂單嗎？')) return;

    setIsSavingOrder(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch(`/api/orders?orderId=${orderId}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '訂單取消失敗。');
      }

      setMessage({ text: '訂單已取消。', type: 'success' });
      setOrderEditor(null);
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleSendManualNotification = async () => {
    const content = manualNotification.trim();
    if (!content) {
      setMessage({ text: '請輸入通知內容。', type: 'error' });
      return;
    }

    setIsSendingNotification(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'TSA Lunch 午餐通知',
          message: content
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '通知發送失敗。');
      }

      setMessage({ text: '通知已送出。已啟用通知且正在使用網站的成員會收到 Windows 通知。', type: 'success' });
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsSendingNotification(false);
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
        
        <section id="weekly-schedule" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-[#EAE8E4] pb-4">
            <div>
              <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">週菜單排程</p>
              <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2 mt-1">
                <i className="ti ti-calendar-week text-2xl text-[#EA5B3C]"></i> 週菜單排程
              </h2>
            </div>
            <p className="text-xs text-[#888888] font-bold">選擇管理日期後設定當日餐廳與訂餐截止時間。</p>
          </div>

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

          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {weeklyDates
              .filter(d => (activeWeekTab === 'current' ? !d.isNextWeek : d.isNextWeek))
              .map(d => {
                const sched = schedules.find(s => s.date === d.dateStr);
                const isSelected = selectedDate === d.dateStr;
                const totalOrdersCount = sched?.orders ? sched.orders.filter(o => o.status !== 'cancelled').length : 0;
                const isHolidayCard = sched ? !sched.isOpen : d.isWeekend;
                
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
                      {isHolidayCard ? '\u4f11\u5047' : (sched?.restaurant?.name || '\u672a\u6392\u5b9a')}
                    </div>
                    {isHolidayCard && (
                      <span className="absolute top-2 right-2 bg-[#F2EFEA] text-[#888888] text-[8px] font-bold px-1 rounded border border-[#EAE8E4]">
                        {'\u5047\u671f'}
                      </span>
                    )}
                    {!isHolidayCard && sched?.deliveredAt && (
                      <span className="absolute top-2 right-2 bg-green-100 text-green-700 text-[8px] font-bold px-1 rounded border border-green-300">
                        已扣款
                      </span>
                    )}
                    {!isHolidayCard && totalOrdersCount > 0 && !sched?.deliveredAt && (
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

                <button
                  type="button"
                  onClick={() => setIsHoliday(prev => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-3 rounded-lg border text-xs font-bold transition-all ${
                    isHoliday
                      ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C]'
                      : 'border-[#EAE8E4] bg-white text-[#333333] hover:border-[#D6D1CA]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <i className={isHoliday ? 'ti ti-toggle-right text-lg' : 'ti ti-toggle-left text-lg'}></i>
                    {'\u5047\u671f'}
                  </span>
                  <span className="text-[10px] text-[#888888]">
                    {isHoliday ? '\u4e0d\u958b\u653e\u8a02\u9910' : '\u958b\u653e\u6392\u9910'}
                  </span>
                </button>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#888888]">指定當日餐廳</label>
                  <select
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    disabled={isHoliday}
                    className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium disabled:bg-[#F9F8F5] disabled:text-[#B8B2AA] disabled:cursor-not-allowed"
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
                  disabled={isUpdatingSchedule || (!isHoliday && !selectedRestaurantId)}
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

              <div className="border-t border-[#EAE8E4] pt-4 space-y-3">
                <h4 className="text-xs font-bold text-[#888888] tracking-widest uppercase flex items-center gap-1.5">
                  <i className="ti ti-bell"></i>
                  Windows 通知
                </h4>
                <textarea
                  value={manualNotification}
                  onChange={(e) => setManualNotification(e.target.value)}
                  rows={3}
                  className="w-full resize-none text-xs leading-5 px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white"
                  placeholder="輸入要提醒所有人的通知內容"
                />
                <button
                  type="button"
                  onClick={handleSendManualNotification}
                  disabled={isSendingNotification || !manualNotification.trim()}
                  className="w-full py-3 text-xs font-bold bg-[#333333] text-white rounded-xl shadow-sm hover:bg-[#EA5B3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingNotification ? '發送中...' : '手動通知所有人'}
                </button>
                <p className="text-[11px] text-[#888888] leading-5">
                  成員需先點選右下角「啟用通知」，並保持網站開啟，才會收到 Windows 右下角通知。
                </p>
              </div>
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
                    {activeSchedule
                      ? selectedDateIsHoliday
                        ? '\u5047\u671f\u4e0d\u958b\u653e\u8a02\u9910'
                        : `${activeSchedule.restaurant?.name || '\u672a\u6392\u5b9a'} \u8a02\u9910\u7d50\u679c`
                      : '\u5c1a\u672a\u5efa\u7acb\u6392\u7a0b'}
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <h4 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                        {'\u6210\u54e1\u8a02\u55ae\u660e\u7d30\u8207\u5099\u8a3b'}
                      </h4>
                      <button
                        type="button"
                        onClick={startNewOrder}
                        disabled={selectedDateIsHoliday || !activeSchedule.restaurant || Boolean(activeSchedule.deliveredAt)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C] text-xs font-bold hover:bg-[#FFE7DE] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className="ti ti-plus"></i>
                        {'\u52a0\u55ae'}
                      </button>
                    </div>

                    {orderEditor && (
                      <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#888888]">{'\u6210\u54e1'}</label>
                            <select
                              value={orderEditor.userId}
                              onChange={(e) => setOrderEditor(prev => ({ ...prev, userId: e.target.value }))}
                              disabled={Boolean(orderEditor.orderId)}
                              className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium disabled:bg-[#F2EFEA] disabled:text-[#888888]"
                            >
                              <option value="">{'\u8acb\u9078\u64c7\u6210\u54e1'}</option>
                              {members.map(member => (
                                <option key={member.id} value={member.id}>{member.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#888888]">{'\u5099\u8a3b'}</label>
                            <input
                              type="text"
                              value={orderEditor.note}
                              onChange={(e) => setOrderEditor(prev => ({ ...prev, note: e.target.value }))}
                              className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                              placeholder={'\u53ef\u586b\u5beb\u52a0\u98ef\u3001\u4e0d\u8981\u9999\u83dc\u7b49'}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                          {activeMenuItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#EAE8E4] bg-white px-3 py-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-[#333333] truncate">{item.name}</div>
                                <div className="text-[11px] text-[#888888]">NT$ {item.price}</div>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={orderEditor.quantities[item.id] || 0}
                                onChange={(e) => updateOrderItemQuantity(item.id, e.target.value)}
                                className="w-20 text-xs px-2 py-1.5 border border-[#EAE8E4] rounded-lg text-right focus:outline-none focus:border-[#EA5B3C]"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setOrderEditor(null)}
                            disabled={isSavingOrder}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#333333] hover:text-[#333333] transition-all disabled:opacity-50"
                            aria-label={'\u53d6\u6d88\u7de8\u8f2f\u8a02\u55ae'}
                            title={'\u53d6\u6d88\u7de8\u8f2f\u8a02\u55ae'}
                          >
                            <i className="ti ti-x text-base"></i>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveAdminOrder}
                            disabled={isSavingOrder}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300 transition-all disabled:opacity-50"
                            aria-label={'\u5132\u5b58\u8a02\u55ae'}
                            title={'\u5132\u5b58\u8a02\u55ae'}
                          >
                            <i className={isSavingOrder ? 'ti ti-loader animate-spin text-base' : 'ti ti-check text-base'}></i>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeSchedule.orders && activeSchedule.orders.filter(o => o.status !== 'cancelled').length === 0 ? (
                      <div className="text-center py-8 text-xs text-[#888888]">
                        {'\u76ee\u524d\u6c92\u6709\u6210\u54e1\u8a02\u55ae\u3002'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-[#EAE8E4] rounded-xl bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#F9F8F5] text-[#888888] font-bold border-b border-[#EAE8E4]">
                              <th className="p-3">{'\u59d3\u540d'}</th>
                              <th className="p-3">{'\u9910\u9ede\u8207\u6578\u91cf'}</th>
                              <th className="p-3 text-right">{'\u91d1\u984d'}</th>
                              <th className="p-3">{'\u5099\u8a3b'}</th>
                              <th className="p-3">{'\u72c0\u614b'}</th>
                              <th className="p-3 text-right">{'\u64cd\u4f5c'}</th>
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
                                    {order.note ? order.note : '-'}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      order.status === 'delivered'
                                        ? 'bg-green-100 text-green-700 border border-green-200'
                                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                                    }`}>
                                      {order.status === 'delivered' ? '\u5df2\u6263\u6b3e' : '\u5df2\u8a02\u8cfc'}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditOrder(order)}
                                        disabled={Boolean(activeSchedule.deliveredAt)}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label={'\u7de8\u8f2f\u8a02\u55ae'}
                                        title={'\u7de8\u8f2f\u8a02\u55ae'}
                                      >
                                        <i className="ti ti-pencil text-sm"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelAdminOrder(order.id)}
                                        disabled={Boolean(activeSchedule.deliveredAt) || isSavingOrder}
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label={'\u53d6\u6d88\u8a02\u55ae'}
                                        title={'\u53d6\u6d88\u8a02\u55ae'}
                                      >
                                        <i className="ti ti-trash text-sm"></i>
                                      </button>
                                    </div>
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
        </section>

      </main>
    </>
  );
}
