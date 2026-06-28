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
      label: weekdayLabels[i],
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
      label: weekdayLabels[i],
      isWeekend: i >= 5,
      isNextWeek: true
    });
  }
  return dates;
}

function getDefaultDateForWeek(weekTab) {
  const dates = getWeeklyDates();
  return weekTab === 'next'
    ? dates.find(d => d.isNextWeek)?.dateStr || formatDate(new Date())
    : formatDate(new Date());
}

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  const [allowNextWeekMenu, setAllowNextWeekMenu] = useState(true);
  
  // Order state
  const [orderQuantities, setOrderQuantities] = useState({}); // { menuItemId: quantity }
  const [itemNotes, setItemNotes] = useState({}); // { menuItemId: note }
  const [orderNote, setOrderNote] = useState('');
  const [seatArea, setSeatArea] = useState('');
  const [useSavedOrderNote, setUseSavedOrderNote] = useState(false);
  const [saveOrderPreference, setSaveOrderPreference] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [isCumulativeTipOpen, setIsCumulativeTipOpen] = useState(false);
  
  // Current system date/time check
  const [currentDateTime, setCurrentDateTime] = useState({ dateStr: '', timeStr: '' });
  
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
        }
      })
      .catch(() => router.push('/login'));
      
    // Get current Taipei/system date & time for deadline checking
    const timer = setInterval(updateTime, 1000);
    updateTime();
    
    // Default selection
    const weekTarget = new URLSearchParams(window.location.search).get('week');
    if (weekTarget === 'next') {
      setSelectedDate(getDefaultDateForWeek('next'));
      setActiveWeekTab('next');
    } else {
      setSelectedDate(getDefaultDateForWeek('current'));
      setActiveWeekTab('current');
    }

    fetchSchedules();
    fetchOrderSettings();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isCumulativeTipOpen) return;

    const handlePointerDown = (event) => {
      if (event.target.closest('[data-cumulative-tip]')) return;
      setIsCumulativeTipOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isCumulativeTipOpen]);

  const updateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setCurrentDateTime({
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hours}:${minutes}`
    });
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

  const fetchOrderSettings = () => {
    fetch('/api/order-settings')
      .then(res => res.json())
      .then(data => {
        if (typeof data.allowNextWeekMenu === 'boolean') {
          setAllowNextWeekMenu(data.allowNextWeekMenu);
        }
      })
      .catch(err => console.error('Failed to load order settings:', err));
  };

  const refreshUser = () => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data?.user) setUser(data.user);
      });
  };

  const removeSeatAreaFromNote = (value) => (value || '').replace(/(^|\s)(A區|B區)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const applySeatAreaToNote = (area, value) => [area ? `${area}區` : '', removeSeatAreaFromNote(value)].filter(Boolean).join(' ');

  // Find schedule details for selected date
  const activeSchedule = schedules.find(s => s.date === selectedDate);
  const activeRestaurant = activeSchedule?.restaurant || null;
  const todayDate = currentDateTime.dateStr || formatDate(new Date());
  const todaySchedule = schedules.find(s => s.date === todayDate);
  const todayOrder = todaySchedule?.userOrder || null;
  const weeklyDates = getWeeklyDates();
  const selectedOrderDateLabel = weeklyDates.find(d => d.dateStr === selectedDate)?.label || selectedDate;

  const handleWeekTabChange = (weekTab) => {
    if (weekTab === 'next' && !allowNextWeekMenu) return;
    setActiveWeekTab(weekTab);
    setSelectedDate(getDefaultDateForWeek(weekTab));
  };

  useEffect(() => {
    if (!allowNextWeekMenu && activeWeekTab === 'next') {
      setActiveWeekTab('current');
      setSelectedDate(getDefaultDateForWeek('current'));
    }
  }, [allowNextWeekMenu, activeWeekTab]);

  useEffect(() => {
    if (!useSavedOrderNote || !user) return;
    const defaultSeatArea = user.defaultSeatArea || '';
    setOrderNote(applySeatAreaToNote(defaultSeatArea, user.defaultOrderNote || ''));
    setSeatArea(defaultSeatArea);
  }, [useSavedOrderNote, user]);

  const resetOrderDraft = (schedule = activeSchedule) => {
    if (!schedule) {
      setOrderQuantities({});
      setItemNotes({});
      setOrderNote('');
      setSeatArea('');
      setUseSavedOrderNote(false);
      setSaveOrderPreference(false);
      return;
    }

    const userOrderSeatArea = schedule.userOrder?.seatArea || '';
    const quantities = {};
    const notes = {};

    if (schedule.userOrder) {
      schedule.userOrder.items.forEach(item => {
        quantities[item.menuItemId] = item.quantity;
        notes[item.menuItemId] = item.note || '';
      });
    }

    setOrderNote(applySeatAreaToNote(userOrderSeatArea, schedule.userOrder?.note || ''));
    setSeatArea(userOrderSeatArea);
    setUseSavedOrderNote(false);
    setSaveOrderPreference(false);
    setOrderQuantities(quantities);
    setItemNotes(notes);
  };

  const handleCancelDraftModification = () => {
    resetOrderDraft();
    setOrderError('');
    setOrderSuccess('');
  };
  
  // Setup order input when selected schedule changes
  useEffect(() => {
    resetOrderDraft(activeSchedule);
    setOrderError('');
    setOrderSuccess('');
  }, [selectedDate, activeSchedule]);

  const handleQtyChange = (menuItemId, delta) => {
    setOrderQuantities(prev => {
      const current = prev[menuItemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [menuItemId]: next };
    });
  };

  const handleSeatAreaToggle = (area) => {
    setSeatArea(area);
    setOrderNote(prev => applySeatAreaToNote(area, prev));
  };

  const scrollToOrderSummary = () => {
    document.getElementById('order-summary')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Calculate order closed status
  const isClosed = () => {
    if (!activeSchedule) return true;
    if (!activeSchedule.isOpen) return true;
    
    const { dateStr: currentDate, timeStr: currentTime } = currentDateTime;
    if (currentDate > activeSchedule.date) return true;
    if (currentDate === activeSchedule.date) {
      const deadline = activeSchedule.orderDeadline || '09:40';
      return currentTime >= deadline;
    }
    return false;
  };

  const calculateTotal = () => {
    if (!activeRestaurant) return 0;
    return activeRestaurant.menuItems.reduce((sum, item) => {
      const qty = orderQuantities[item.id] || 0;
      return sum + item.price * qty;
    }, 0);
  };

  const normalizeOrderText = (value) => (value || '').trim();

  const getCurrentOrderItems = () => Object.entries(orderQuantities)
    .filter(([_, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({
      menuItemId,
      quantity: qty,
      note: normalizeOrderText(itemNotes[menuItemId])
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));

  const hasOrderChanges = () => {
    if (!activeSchedule?.userOrder) return true;
    if (normalizeOrderText(orderNote) !== normalizeOrderText(activeSchedule.userOrder.note)) return true;
    if ((seatArea || '') !== (activeSchedule.userOrder.seatArea || '')) return true;
    if (saveOrderPreference) return true;

    const currentItems = getCurrentOrderItems();
    const originalItems = activeSchedule.userOrder.items
      .map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        note: normalizeOrderText(item.note)
      }))
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId));

    return JSON.stringify(currentItems) !== JSON.stringify(originalItems);
  };

  const shouldShowModifyShortcut = Boolean(
    activeSchedule?.userOrder && activeRestaurant && !isClosed() && hasOrderChanges()
  );

  useEffect(() => {
    document.body.classList.toggle('has-bottom-order-shortcut', shouldShowModifyShortcut);

    return () => {
      document.body.classList.remove('has-bottom-order-shortcut');
    };
  }, [shouldShowModifyShortcut]);

  const handlePlaceOrder = async () => {
    if (isClosed()) return;
    
    if (activeSchedule.userOrder && !hasOrderChanges()) return;

    const items = getCurrentOrderItems();

    if (items.length === 0) {
      setOrderError('請至少選擇一項餐點！');
      return;
    }

    if (!seatArea) {
      setOrderError('請選擇座位區！');
      return;
    }

    setIsSubmitting(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule.id,
          items,
          note: applySeatAreaToNote(seatArea, orderNote),
          seatArea,
          saveOrderPreference
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '點餐失敗');
      }

      setOrderSuccess('訂單提交成功！');
      fetchSchedules();
      refreshUser();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (isClosed() || !activeSchedule.userOrder) return;

    if (!confirm('您確定要取消此筆午餐訂單嗎？')) return;

    setIsSubmitting(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await fetch(`/api/orders?orderId=${activeSchedule.userOrder.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '取消失敗');
      }

      setOrderSuccess('訂單已取消！');
      setOrderQuantities({});
      setItemNotes({});
      setOrderNote('');
      setSeatArea('');
      setUseSavedOrderNote(false);
      setSaveOrderPreference(false);
      fetchSchedules();
      refreshUser();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入個人資料中...</span>
        </div>
      </div>
    );
  }

  // Wallet styling based on balance logic
  const getWalletStyles = () => {
    if (user.balance > 0) {
      return {
        cardBorder: 'border-l-4 border-l-green-600 border-[#EAE8E4]',
        valueColor: 'text-green-600',
        label: '餘額充足'
      };
    } else if (user.balance === 0) {
      return {
        cardBorder: 'border-l-4 border-l-[#333333] border-[#EAE8E4]',
        valueColor: 'text-[#333333]',
        label: '餘額歸零'
      };
    } else {
      return {
        cardBorder: 'border-l-4 border-l-red-600 border-[#EAE8E4] bg-red-[0.005]',
        valueColor: 'text-red-600',
        label: '帳戶欠款'
      };
    }
  };

  const wallet = getWalletStyles();
  const walletAmount = `${user.balance < 0 ? '－' : ''}NT$ ${Math.abs(user.balance)}`;

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-10">
        
        {/* Wallet Banner */}
        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Wallet Info */}
            <div className={`p-5 bg-[#F9F8F5] rounded-xl border ${wallet.cardBorder} flex flex-col justify-between h-full`}>
              <span className="text-xs font-bold text-[#888888] tracking-widest uppercase mb-2">{wallet.label}</span>
              <div className={`text-3xl font-bold ${wallet.valueColor} mb-2`}>
                {walletAmount}
              </div>
            </div>

            {/* Today Order */}
            <div className="md:col-span-2 space-y-4 md:pl-6 border-t md:border-t-0 md:border-l border-[#EAE8E4] pt-6 md:pt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-base text-[#333333] flex items-center gap-2">
                  <i className="ti ti-shopping-bag text-lg text-[#EA5B3C]"></i> 今日訂購餐點
                </h3>
                <span className="text-xs font-bold text-[#888888]">{todayDate}</span>
              </div>

              {todayOrder ? (
                <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] overflow-hidden">
                  <div className="bg-white px-4 py-3">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold tracking-widest text-[#888888]">
                        {'\u4eca\u65e5\u8a02\u55ae\u7de8\u865f'}
                      </span>
                      <span className="inline-flex min-w-12 items-center justify-center rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-3 py-1.5 text-sm font-bold text-[#EA5B3C]">
                        {todayOrder.orderNumberDisplay || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[180px] overflow-y-auto bg-white px-4 py-3 kaizen-scrollbar">
                    {todayOrder.items.map(item => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#EAE8E4] py-2 text-xs last:border-b-0">
                        <span className="font-bold text-[#333333] truncate">
                          {item.name}
                          {item.note && (
                            <span className="block truncate text-[11px] font-bold text-[#EA5B3C]">
                              備註: {item.note}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-[#F9F8F5] px-2 py-0.5 font-bold text-[#888888] shrink-0">x {item.quantity}</span>
                        <span className="font-bold text-[#EA5B3C] shrink-0">NT$ {item.unitPrice * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#888888]">今日訂單金額</span>
                    <span className="text-xl font-bold text-[#EA5B3C]">NT$ {todayOrder.totalAmount}</span>
                  </div>

                  {todayOrder.note && (
                    <p className="border-t border-[#EAE8E4] bg-white px-4 py-3 text-xs leading-5 text-[#888888]">
                      備註：{todayOrder.note}
                    </p>
                  )}
                  {todayOrder.seatArea && (
                    <p className="border-t border-[#EAE8E4] bg-white px-4 py-3 text-xs leading-5 text-[#888888]">
                      座位區：{todayOrder.seatArea}區
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-8 text-center text-xs text-[#888888]">
                  今日尚未訂購餐點。
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Announcement Board moved to /portal/announcements.
        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FFF3EF] text-[#EA5B3C] flex items-center justify-center shrink-0">
              <i className="ti ti-speakerphone text-xl"></i>
            </div>
            <div className="min-w-0 flex-1 space-y-5">
              <h2 className="text-lg font-bold text-[#333333]">公告欄</h2>

              {announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map(item => (
                    <article key={item.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold text-[#333333] break-words">
                          {item.title || '未命名公告'}
                        </h3>
                        {item.pinned && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-2 py-1 text-[11px] font-bold text-[#EA5B3C]">
                            <i className="ti ti-pin text-xs"></i> 置頂
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#555555] leading-7 whitespace-pre-wrap break-words">
                        {item.content || '此公告尚無內容。'}
                      </div>
                      {item.updatedAt && (
                        <p className="text-[11px] text-[#888888] text-right">
                          最後更新：{new Date(item.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#888888] leading-7">
                  目前尚無公告。
                </div>
              )}
            </div>
          </div>
        </section>

        */}

        {/* Date Selector Tabs */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
              <i className="ti ti-calendar-event text-2xl text-[#EA5B3C]"></i> 週供餐日期選擇
            </h2>
            
            {/* Week Tab Switcher */}
            <div className="inline-flex bg-[#F9F8F5] border border-[#EAE8E4] p-1 rounded-xl">
              <button
                onClick={() => handleWeekTabChange('current')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all ${
                  activeWeekTab === 'current' ? 'bg-[#EA5B3C] text-white' : 'text-[#888888] hover:text-[#333333]'
                }`}
              >
                本週菜單
              </button>
              <button
                onClick={() => handleWeekTabChange('next')}
                disabled={!allowNextWeekMenu}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  activeWeekTab === 'next'
                    ? 'bg-[#EA5B3C] text-white'
                    : allowNextWeekMenu
                      ? 'text-[#888888] hover:text-[#333333]'
                      : 'text-[#888888]'
                }`}
              >
                下週菜單
              </button>
            </div>
          </div>

          {/* Monday-Sunday Daily Buttons */}
          <div className="grid grid-cols-7 gap-1 md:gap-3">
            {weeklyDates
              .filter(d => (activeWeekTab === 'current' ? !d.isNextWeek : d.isNextWeek))
              .map(d => {
                const sched = schedules.find(s => s.date === d.dateStr);
                const hasOrdered = sched?.userOrder;
                const isSelected = selectedDate === d.dateStr;
                const isHolidayCard = sched ? !sched.isOpen && !sched.deliveredAt : d.isWeekend;
                
                return (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`min-h-12 p-2 md:min-h-0 md:p-4 rounded-lg md:rounded-xl border text-center md:text-left transition-all relative ${
                      isSelected
                        ? 'border-[#EA5B3C] bg-white ring-1 ring-[#EA5B3C]'
                        : 'border-[#EAE8E4] bg-white hover:border-[#D6D1CA]'
                    }`}
                  >
                    <div className="text-[11px] md:text-xs text-[#888888] md:mb-1 font-bold leading-tight">{d.label}</div>
                    <div className="hidden md:block text-sm font-bold text-[#333333] truncate">
                      {isHolidayCard ? '\u4f11\u5047' : (sched?.restaurant ? sched.restaurant.name : '（未排定）')}
                    </div>
                    {/* Status Badge */}
                    {isHolidayCard && (
                      <span className="mt-0.5 block text-center text-[8px] font-bold leading-none text-[#888888] md:absolute md:top-2 md:right-2 md:mt-0 md:inline-flex md:px-1 md:rounded md:border md:border-[#EAE8E4] md:bg-[#F2EFEA]">
                        {'\u5047\u671f'}
                      </span>
                    )}
                    {!isHolidayCard && hasOrdered && (
                      <>
                        <span className="mt-0.5 block text-center text-[9px] font-bold leading-none text-green-600 md:absolute md:top-2 md:right-2 md:mt-0 md:inline-flex md:rounded md:bg-green-500 md:px-1.5 md:py-0.5 md:text-white">
                          已訂
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
          </div>
        </section>

        {/* Menu and Ordering Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Menu Selection (Col-span 2) */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
            <div className="c-box">
              {activeRestaurant ? (
                <div className="space-y-8">
                  {/* Restaurant Details */}
                  <div className="border-b border-[#EAE8E4] pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-[#333333]">{activeRestaurant.name}</h3>
                      {activeRestaurant.phone && (
                        <p className="text-xs text-[#888888] mt-1">
                          <i className="ti ti-phone"></i> 聯絡電話: {activeRestaurant.phone}
                        </p>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-3 text-left md:w-auto md:flex-row md:items-center md:justify-end md:gap-8 md:text-right">
                      <div>
                        <span className="text-xs font-bold text-[#888888] block">截止訂購時間</span>
                        <span className="text-sm font-bold text-[#EA5B3C] flex items-center gap-1 mt-1 md:justify-end">
                          <i className="ti ti-alarm"></i> 每日 {activeSchedule.orderDeadline} 前
                        </span>
                      </div>
                      <div>
                        <span className="relative inline-flex items-center gap-1 text-xs font-bold text-[#888888]" data-cumulative-tip>
                          目前累計金額
                          <button
                            type="button"
                            onClick={() => setIsCumulativeTipOpen(prev => !prev)}
                            onMouseEnter={() => setIsCumulativeTipOpen(true)}
                            onFocus={() => setIsCumulativeTipOpen(true)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#D6D1CA] bg-white text-[10px] font-bold text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                            aria-label="目前累計金額說明"
                          >
                            i
                          </button>
                          {isCumulativeTipOpen && (
                            <span className="absolute left-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-[#EAE8E4] bg-white p-3 text-left text-[11px] font-bold leading-relaxed text-[#555555] shadow-lg md:left-auto md:right-0 md:w-56">
                              這是大家目前已送出的訂單總額，可用來一起確認是否接近餐廳免運門檻。
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-bold text-[#EA5B3C] block mt-1">
                          NT$ {activeSchedule.stats?.totalAmount || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {activeRestaurant.note && (
                    <div className="flex items-start gap-3 rounded-xl border border-[#EA5B3C]/25 bg-[#FFF3EF] p-4 text-sm leading-normal shadow-sm">
                      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#EA5B3C] shadow-sm">
                        <i className="ti ti-info-circle text-lg"></i>
                      </span>
                      <div className="space-y-1">
                        <div className="text-xs font-bold tracking-widest text-[#EA5B3C]">餐廳備註</div>
                        <div className="font-bold text-[#333333]">{activeRestaurant.note}</div>
                      </div>
                    </div>
                  )}

                  {/* Warning Banner if Closed */}
                  {isClosed() && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                      <i className="ti ti-alert-triangle text-lg"></i>
                      本供餐日訂餐已截止或管理員已點收，無法再進行修改。
                    </div>
                  )}

                  {/* Menu Items List */}
                  <div className="space-y-6">
                    <h4 className="font-bold text-base text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                      美味餐點選擇
                    </h4>

                    {/* Group menu items by category */}
                    {['主食', '配菜', '飲料湯品'].map(cat => {
                      const items = activeRestaurant.menuItems.filter(mi => mi.category === cat || (!['主食', '配菜', '飲料湯品'].includes(mi.category) && cat === '主食'));
                      if (items.length === 0) return null;
                      
                      return (
                        <div key={cat} className="space-y-3">
                          <h5 className="text-xs font-bold text-[#888888] tracking-widest uppercase">{cat}</h5>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map(item => {
                              const qty = orderQuantities[item.id] || 0;
                              return (
                                <div 
                                  key={item.id}
                                  className={`p-4 border rounded-xl flex items-center justify-between transition-all ${
                                    qty > 0 ? 'border-[#EA5B3C] bg-orange-[0.005]' : 'border-[#EAE8E4]'
                                  }`}
                                >
                                  <div>
                                    <div className="font-bold text-[#333333] text-sm">{item.name}</div>
                                    <div className="text-xs text-[#EA5B3C] font-bold mt-1">NT$ {item.price}</div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <button
                                      disabled={isClosed()}
                                      onClick={() => handleQtyChange(item.id, -1)}
                                      className="w-8 h-8 rounded-full border border-[#EAE8E4] flex items-center justify-center text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                      <i className="ti ti-minus text-xs"></i>
                                    </button>
                                    <span className="w-6 text-center font-bold text-sm text-[#333333]">{qty}</span>
                                    <button
                                      disabled={isClosed()}
                                      onClick={() => handleQtyChange(item.id, 1)}
                                      className="w-8 h-8 rounded-full border border-[#EAE8E4] flex items-center justify-center text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                                    >
                                      <i className="ti ti-plus text-xs"></i>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <i className="ti ti-soup-off text-5xl text-[#D6D1CA]"></i>
                  <h3 className="font-bold text-[#333333] text-base">此日期未安排供餐</h3>
                  <p className="text-xs text-[#888888]">請選擇其他有餐廳排定的供餐日進行訂購。</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Checkout Summary (Col-span 1) */}
          <div className="order-1 lg:order-2 space-y-6">
            <div id="order-summary" className="scroll-mt-24 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-6 lg:sticky lg:top-24">
              <h3 className="font-bold text-base text-[#333333] border-b border-[#EAE8E4] pb-3">
                您的訂購清單
              </h3>

              {orderError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-1.5">
                  <i className="ti ti-alert-circle"></i> {orderError}
                </div>
              )}

              {orderSuccess && (
                <div className="p-3 text-xs bg-green-50 border border-green-200 text-green-600 rounded-lg flex items-center gap-1.5">
                  <i className="ti ti-discount-check"></i> {orderSuccess}
                </div>
              )}

              {/* Selected items receipt */}
              {activeRestaurant ? (
                <>
                  {calculateTotal() > 0 && (
                    <div className="text-xs font-bold text-[#888888]">
                      {selectedOrderDateLabel}餐點內容
                    </div>
                  )}

                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {activeRestaurant.menuItems.map(item => {
                      const qty = orderQuantities[item.id] || 0;
                      if (qty === 0) return null;
                      return (
                        <div key={item.id} className="space-y-2 rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#333333] font-bold truncate">{item.name}</span>
                            <span className="text-[#888888] shrink-0">x {qty}</span>
                            <span className="text-[#333333] font-bold shrink-0">NT$ {item.price * qty}</span>
                          </div>
                          <input
                            type="text"
                            disabled={isClosed() || isSubmitting}
                            value={itemNotes[item.id] || ''}
                            onChange={(e) => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="此餐點備註，例如飯少、換菜"
                            className="w-full rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-medium text-[#333333] placeholder:text-[#B8B2AA] focus:border-[#EA5B3C] focus:outline-none disabled:bg-[#F2EFEA]"
                          />
                        </div>
                      );
                    })}

                    {calculateTotal() === 0 && (
                      <div className="text-center py-6 text-xs text-[#888888]">
                        尚未選擇任何餐點
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#EAE8E4] pt-4 space-y-3">
                    {/* Custom Note input */}
                    <div className="hidden">
                      <label className="text-xs font-bold text-[#888888]">餐點備註說明 (如: 不辣、不要蔥)</label>
                      <input
                        type="text"
                        disabled={isClosed() || isSubmitting}
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="請輸入特殊備註..."
                        className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] disabled:bg-[#F9F8F5]"
                      />
                    </div>

                    {/* Order Status details */}
                    {activeSchedule.userOrder && (
                      <div className="bg-[#F9F8F5] border border-[#EAE8E4] p-3 rounded-lg flex flex-col gap-1 text-[11px]">
                        {activeSchedule.userOrder.orderNumberDisplay && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">{'\u8a02\u55ae\u7de8\u865f'}</span>
                            <span className="font-bold text-[#EA5B3C]">{activeSchedule.userOrder.orderNumberDisplay}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#888888]">訂單狀態:</span>
                          <span className="font-bold text-green-600">已成立 ({activeSchedule.userOrder.status})</span>
                        </div>
                        {activeSchedule.userOrder.seatArea && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">座位區</span>
                            <span className="font-bold text-[#333333]">{activeSchedule.userOrder.seatArea}區</span>
                          </div>
                        )}
                        {activeSchedule.userOrder.note && (
                          <div className="flex justify-between gap-3">
                            <span className="text-[#888888] shrink-0">整筆備註</span>
                            <span className="font-bold text-[#333333] text-right">{activeSchedule.userOrder.note}</span>
                          </div>
                        )}
                        {activeSchedule.userOrder.chargedAt && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">扣款時間:</span>
                            <span className="text-[#333333]">
                              {new Date(activeSchedule.userOrder.chargedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-3">
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          {['A', 'B'].map(area => (
                            <button
                              key={area}
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => handleSeatAreaToggle(area)}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                seatArea === area
                                  ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C]'
                                  : 'border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                              }`}
                            >
                              {area}區
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-[#888888]">備註</label>
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => setUseSavedOrderNote(prev => !prev)}
                              className={`rounded px-1.5 py-0.5 transition-all ${
                                useSavedOrderNote
                                  ? 'bg-[#FFF3EF] text-[#EA5B3C] underline decoration-[#EA5B3C] underline-offset-4'
                                  : 'text-[#888888] hover:bg-white hover:text-[#EA5B3C]'
                              }`}
                            >
                              常用備註
                            </button>
                            <span className="text-[#C9C3BB]">|</span>
                            <button
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => setSaveOrderPreference(prev => !prev)}
                              className={`rounded px-1.5 py-0.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                saveOrderPreference
                                  ? 'bg-[#FFF3EF] text-[#EA5B3C] underline decoration-[#EA5B3C] underline-offset-4'
                                  : 'text-[#888888] hover:bg-white hover:text-[#EA5B3C]'
                              }`}
                            >
                              儲存備註
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          disabled={isClosed() || isSubmitting}
                          value={orderNote}
                          onChange={(e) => {
                            setOrderNote(seatArea ? applySeatAreaToNote(seatArea, e.target.value) : e.target.value);
                            setUseSavedOrderNote(false);
                          }}
                          className="w-full rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-medium text-[#333333] placeholder:text-[#B8B2AA] focus:border-[#EA5B3C] focus:outline-none disabled:bg-[#F2EFEA]"
                        />
                      </div>
                    </div>

                    {/* Total & Action Buttons */}
                    <div className="flex justify-between items-center font-bold text-[#333333] text-sm pt-2">
                      <span>總計金額</span>
                      <span className="text-xl text-[#EA5B3C] font-bold">NT$ {calculateTotal()}</span>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        {activeSchedule.userOrder && !isClosed() && (
                          <button
                            disabled={isSubmitting || !hasOrderChanges()}
                            onClick={handleCancelDraftModification}
                            className="flex-1 py-3 text-xs font-bold border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C]/40 rounded-xl transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            取消修改
                          </button>
                        )}
                        
                        <button
                          disabled={isClosed() || isSubmitting || calculateTotal() === 0 || !seatArea || (activeSchedule.userOrder && !hasOrderChanges())}
                          onClick={handlePlaceOrder}
                          className="flex-[2] py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center"
                        >
                          {isSubmitting ? '處理中...' : activeSchedule.userOrder ? '修改並送出訂單' : '送出訂購'}
                        </button>
                      </div>
                      {activeSchedule.userOrder && !isClosed() && (
                        <button
                          disabled={isSubmitting}
                          onClick={handleCancelOrder}
                          className="w-full py-3 text-xs font-bold border border-[#EAE8E4] text-[#888888] hover:text-red-600 hover:border-red-200 rounded-xl transition-all bg-white"
                        >
                          取消訂單
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-xs text-[#888888]">
                  請先選擇上方有供餐的日期
                </div>
              )}
            </div>
          </div>

        </section>

        {shouldShowModifyShortcut && (
          <div className="fixed inset-x-0 bottom-4 z-40 px-6 lg:hidden">
            <div className="mx-auto flex w-full max-w-sm gap-2">
              <button
                type="button"
                onClick={handleCancelDraftModification}
                className="flex-[0.9] rounded-full border border-[#EAE8E4] bg-white px-4 py-3 text-sm font-bold text-[#888888] shadow-lg shadow-black/5 transition-all active:scale-[0.98]"
              >
                取消修改
              </button>
              <button
                type="button"
                onClick={scrollToOrderSummary}
                className="flex-[1.5] rounded-full bg-[#EA5B3C] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#EA5B3C]/25 transition-all active:scale-[0.98]"
              >
                修改訂單內容
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
