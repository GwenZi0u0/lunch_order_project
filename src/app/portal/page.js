'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getViewerPage } from '@/lib/adminPermissions';

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

function getSeatAreaFromOrder(order) {
  if (order?.seatArea) return order.seatArea;
  const match = (order?.note || '').trim().match(/^([AB])區(?:\s|$|[;；,，、])/i);
  return match ? match[1].toUpperCase() : 'A';
}

function getOrderDisplayNumber(order) {
  const orderNumber = order?.orderNumberDisplay || '-';
  const seatArea = getSeatAreaFromOrder(order);
  return seatArea && orderNumber !== '-' ? `${seatArea}${orderNumber}` : orderNumber;
}

function getDisplayOrderNote(order) {
  return (order?.note || '').replace(/^([AB])區\s*[;；,，、]?\s*/i, '').trim();
}

function formatItemNoteDisplay(note) {
  return String(note || '').replace(/\s*;\s*/g, ' ').trim();
}

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  const [allowNextWeekMenu, setAllowNextWeekMenu] = useState(true);
  
  // Order state
  const [orderQuantities, setOrderQuantities] = useState({}); // { menuItemId: quantity }
  const [orderNote, setOrderNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [companyOrdersOpen, setCompanyOrdersOpen] = useState(false);
  const [companyOrders, setCompanyOrders] = useState([]);
  const [companyOrdersLoading, setCompanyOrdersLoading] = useState(false);
  const [companyOrdersError, setCompanyOrdersError] = useState('');
  
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
          if (data.user?.role === 'viewer') {
            router.replace(getViewerPage(data.user.viewerPage)?.href || '/login');
            return;
          }
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
      
    // Get current Taipei/system date & time for deadline checking
    const timer = setInterval(updateTime, 1000);
    updateTime();
    
    // Default selection
    const today = new Date();
    const todayStr = formatDate(today);
    setSelectedDate(todayStr);
    setActiveWeekTab('current');

    fetchSchedules();
    fetchAnnouncements();
    fetchOrderSettings();

    return () => clearInterval(timer);
  }, []);

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

  const fetchAnnouncements = () => {
    fetch('/api/announcement')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data?.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(err => console.error('Failed to load announcements:', err));
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

  const openCompanyOrders = async () => {
    if (!todaySchedule?.id) return;

    setCompanyOrdersOpen(true);
    setCompanyOrdersLoading(true);
    setCompanyOrdersError('');

    try {
      const response = await fetch(`/api/orders?scheduleId=${todaySchedule.id}&scope=company`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法載入大家的訂單');
      setCompanyOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      setCompanyOrdersError(error.message || '無法載入大家的訂單');
    } finally {
      setCompanyOrdersLoading(false);
    }
  };

  const refreshUser = () => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data?.user) setUser(data.user);
      });
  };

  // Find schedule details for selected date
  const activeSchedule = schedules.find(s => s.date === selectedDate);
  const activeRestaurant = activeSchedule?.restaurant || null;
  const todayDate = currentDateTime.dateStr || formatDate(new Date());
  const todaySchedule = schedules.find(s => s.date === todayDate);
  const todayOrder = todaySchedule?.userOrder || null;
  const weeklyDates = getWeeklyDates();

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
  
  // Setup order input when selected schedule changes
  useEffect(() => {
    if (activeSchedule) {
      setOrderNote(activeSchedule.userOrder?.note || '');
      const quantities = {};
      if (activeSchedule.userOrder) {
        activeSchedule.userOrder.items.forEach(item => {
          quantities[item.menuItemId] = item.quantity;
        });
      }
      setOrderQuantities(quantities);
    } else {
      setOrderQuantities({});
      setOrderNote('');
    }
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

  // Calculate order closed status
  const isClosed = () => {
    if (!activeSchedule) return true;
    if (!activeSchedule.isOpen) return true;
    
    const { dateStr: currentDate, timeStr: currentTime } = currentDateTime;
    const deadlineDate = activeSchedule.orderDeadlineDate || activeSchedule.date;
    if (currentDate > deadlineDate) return true;
    if (currentDate === deadlineDate) {
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

  const handlePlaceOrder = async () => {
    if (isClosed()) return;
    
    const items = Object.entries(orderQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({
        menuItemId,
        quantity: qty
      }));

    if (items.length === 0) {
      setOrderError('請至少選擇一項餐點！');
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
          note: orderNote
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
      setOrderNote('');
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
  const pendingHoldAmount = user.pendingHoldAmount || 0;
  const availableBalance = user.availableBalance ?? (user.balance - pendingHoldAmount);
  const previewTodayOrder = process.env.NODE_ENV === 'development' && !todayOrder
    ? {
        seatArea: 'A',
        orderNumberDisplay: '01',
        totalAmount: 140,
        note: '餐具一份',
        items: [
          {
            id: 'preview-order-item',
            name: '舒肥雞胸肉餐盒',
            note: '飯少 味噌醬',
            quantity: 1,
            unitPrice: 140,
          },
        ],
      }
    : null;
  const displayedTodayOrder = todayOrder || previewTodayOrder;
  const companyOrdersBySeatArea = ['A', 'B'].map(area => ({
    area,
    orders: companyOrders
      .filter(order => (order.seatArea || 'A') === area)
      .sort((a, b) => Number(a.orderNumberDisplay || 0) - Number(b.orderNumberDisplay || 0))
  })).filter(group => group.orders.length > 0);

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 pb-28 pt-8 md:py-10 space-y-6 md:space-y-8">
        
        {/* Wallet Banner */}
        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
            {/* Wallet Info */}
            <div className={`order-2 h-full p-4 md:p-5 bg-[#F9F8F5] rounded-xl border ${wallet.cardBorder} flex flex-col justify-start`}>
              <span className="text-xs font-bold text-[#888888] tracking-widest uppercase mb-2">{wallet.label}</span>
              <div className="mb-2 space-y-1">
                <span className={`text-2xl md:text-3xl font-bold ${wallet.valueColor}`}>
                  {walletAmount}
                </span>
                {pendingHoldAmount > 0 && (
                  <span className="block text-xs font-bold text-[#888888]">
                    可用金額 {availableBalance < 0 ? '－' : ''}NT$ {Math.abs(availableBalance)}
                  </span>
                )}
              </div>
            </div>

            {displayedTodayOrder && (
              <div className="order-1 h-full rounded-xl border border-l-4 border-[#EAE8E4] border-l-[#EA5B3C] bg-[#F9F8F5] p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold tracking-widest text-[#888888]">訂單號碼</span>
                    {previewTodayOrder && (
                      <span className="ml-2 rounded-full bg-[#FFF3EF] px-2 py-0.5 text-[10px] font-bold text-[#EA5B3C]">
                        預覽資料
                      </span>
                    )}
                    <div className="mt-2 text-2xl font-bold text-[#EA5B3C] md:text-3xl">
                      {getOrderDisplayNumber(displayedTodayOrder)}
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>

            {/* Today Order */}
            <div className="space-y-4 border-t border-[#EAE8E4] pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-base text-[#333333] flex items-center gap-2">
                <i className="ti ti-shopping-bag text-lg text-[#EA5B3C]"></i> 今日訂購餐點
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#888888]">{todayDate}</span>
                <button
                  type="button"
                  onClick={openCompanyOrders}
                  disabled={!todaySchedule}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40"
                  title="查看大家點了什麼"
                  aria-label="查看大家點了什麼"
                >
                  <i className="ti ti-users text-base"></i>
                </button>
              </div>
            </div>

            {displayedTodayOrder ? (
              <>
                <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] overflow-hidden">
                  <div className="max-h-[180px] overflow-y-auto bg-white px-4 py-3 kaizen-scrollbar">
                      {displayedTodayOrder.items.map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#EAE8E4] py-2 text-xs last:border-b-0">
                        <span className="font-bold text-[#333333] truncate">
                          {item.name}
                          {item.note && (
                            <span className="block truncate text-[11px] font-bold text-[#EA5B3C]">
                              {item.note}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-[#F9F8F5] px-2 py-0.5 font-bold text-[#888888] shrink-0">x {item.quantity}</span>
                        <span className="shrink-0 font-bold text-[#EA5B3C]">NT$ {item.unitPrice * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {getDisplayOrderNote(displayedTodayOrder) && (
                    <p className="border-t border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3 text-xs leading-5 text-[#888888]">
                      備註：{getDisplayOrderNote(displayedTodayOrder)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-8 text-center text-xs text-[#888888]">
                今日尚未訂購餐點。
              </div>
            )}
            </div>
          </div>
        </section>

        {/* Shortcut Actions */}
        <section className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-full border border-[#EAE8E4] bg-white/95 p-2 shadow-lg backdrop-blur md:static md:w-auto md:max-w-none md:translate-x-0 md:rounded-xl md:p-6 md:shadow-sm">
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => router.push('/portal/order')}
              className="group relative flex h-12 items-center justify-center rounded-full border border-[#EAE8E4] bg-[#F9F8F5] font-bold text-[#333333] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] md:h-auto md:min-h-16 md:flex-col md:gap-1 md:rounded-xl md:px-3 md:py-3 md:text-sm"
            >
              <i className="ti ti-tools-kitchen-2 text-xl text-[#EA5B3C]"></i>
              <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-[#333333] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-active:opacity-100 group-focus-visible:opacity-100 md:static md:mb-0 md:bg-transparent md:p-0 md:text-[#333333] md:opacity-100 md:shadow-none">
                今日午餐訂購
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (allowNextWeekMenu) router.push('/portal/order?week=next');
              }}
              disabled={!allowNextWeekMenu}
              className={`group relative flex h-12 items-center justify-center rounded-full border border-[#EAE8E4] bg-[#F9F8F5] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-45 md:h-auto md:min-h-16 md:flex-col md:gap-1 md:rounded-xl md:px-3 md:py-3 md:text-sm ${
                allowNextWeekMenu
                  ? 'text-[#333333] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                  : 'text-[#888888]'
              }`}
            >
              <i className="ti ti-calendar-plus text-xl text-[#EA5B3C]"></i>
              <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-[#333333] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-active:opacity-100 group-focus-visible:opacity-100 md:static md:mb-0 md:bg-transparent md:p-0 md:text-[#333333] md:opacity-100 md:shadow-none">
                下周午餐訂購
              </span>
            </button>
            <button
              type="button"
              onClick={() => document.getElementById('announcements')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="group relative flex h-12 items-center justify-center rounded-full border border-[#EAE8E4] bg-[#F9F8F5] font-bold text-[#333333] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] md:h-auto md:min-h-16 md:flex-col md:gap-1 md:rounded-xl md:px-3 md:py-3 md:text-sm"
            >
              <i className="ti ti-speakerphone text-xl text-[#EA5B3C]"></i>
              <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-[#333333] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-active:opacity-100 group-focus-visible:opacity-100 md:static md:mb-0 md:bg-transparent md:p-0 md:text-[#333333] md:opacity-100 md:shadow-none">
                公告欄
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.push('/portal/history')}
              className="group relative flex h-12 items-center justify-center rounded-full border border-[#EAE8E4] bg-[#F9F8F5] font-bold text-[#333333] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] md:h-auto md:min-h-16 md:flex-col md:gap-1 md:rounded-xl md:px-3 md:py-3 md:text-sm"
            >
              <i className="ti ti-history text-xl text-[#EA5B3C]"></i>
              <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-[#333333] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-active:opacity-100 group-focus-visible:opacity-100 md:static md:mb-0 md:bg-transparent md:p-0 md:text-[#333333] md:opacity-100 md:shadow-none">
                消費日誌
              </span>
            </button>
          </div>
        </section>

        {/* Announcement Board */}
        <section id="announcements" className="scroll-mt-24 bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#FFF3EF] text-[#EA5B3C] flex items-center justify-center shrink-0">
                <i className="ti ti-speakerphone text-xl"></i>
              </div>
              <h2 className="text-lg font-bold text-[#333333]">公告欄</h2>
            </div>
            <div className="min-w-0 space-y-5">
              {announcements.length > 0 ? (
                <div className="space-y-4">
                  {announcements.map(item => (
                    <article key={item.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold text-[#333333] break-words">
                          {item.title || '未命名公告'}
                        </h3>
                        {item.pinned && (
                          <span
                            className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] text-[#EA5B3C]"
                            title="置頂公告"
                            aria-label="置頂公告"
                          >
                            <i className="ti ti-pin text-sm"></i>
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-[#555555] leading-7 whitespace-pre-wrap break-words">
                        {item.content || '此公告尚無內容。'}
                      </div>
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

        {false && (
        <>
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
                      <span className="mt-0.5 block text-center text-[9px] font-bold leading-none text-green-600 md:absolute md:top-2 md:right-2 md:mt-0 md:inline-flex md:rounded md:bg-green-500 md:px-1.5 md:py-0.5 md:text-white">
                        已訂
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </section>

        {/* Menu and Ordering Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Menu Selection (Col-span 2) */}
          <div className="lg:col-span-2 space-y-6">
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

                    <div className="text-right">
                      <span className="text-xs font-bold text-[#888888] block">截止訂購時間</span>
                      <span className="text-sm font-bold text-[#EA5B3C] flex items-center gap-1 mt-1 justify-end">
                        <i className="ti ti-alarm"></i>
                        {activeSchedule.orderDeadlineDate && activeSchedule.orderDeadlineDate !== activeSchedule.date
                          ? `${activeSchedule.orderDeadlineDate} ${activeSchedule.orderDeadline}`
                          : activeSchedule.orderDeadline} 前
                      </span>
                    </div>
                  </div>

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
                  
                  {activeRestaurant.note && (
                    <div className="p-4 bg-[#F9F8F5] rounded-xl text-xs text-[#888888] leading-normal border border-[#EAE8E4]">
                      <strong>備註：</strong>{activeRestaurant.note}
                    </div>
                  )}
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
          <div className="space-y-6">
            <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-6 sticky top-24">
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
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {activeRestaurant.menuItems.map(item => {
                      const qty = orderQuantities[item.id] || 0;
                      if (qty === 0) return null;
                      return (
                        <div key={item.id} className="flex justify-between items-center text-xs">
                          <span className="text-[#333333] font-bold truncate max-w-[150px]">{item.name}</span>
                          <span className="text-[#888888]">x {qty}</span>
                          <span className="text-[#333333] font-bold">NT$ {item.price * qty}</span>
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
                    <div className="space-y-1.5">
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
                            <span className="font-bold text-[#EA5B3C]">{getOrderDisplayNumber(activeSchedule.userOrder)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#888888]">訂單狀態:</span>
                          <span className="font-bold text-green-600">已成立 ({activeSchedule.userOrder.status})</span>
                        </div>
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

                    {/* Total & Action Buttons */}
                    <div className="flex justify-between items-center font-bold text-[#333333] text-sm pt-2">
                      <span>總計金額</span>
                      <span className="text-xl text-[#EA5B3C] font-bold">NT$ {calculateTotal()}</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      {activeSchedule.userOrder && !isClosed() && (
                        <button
                          disabled={isSubmitting}
                          onClick={handleCancelOrder}
                          className="flex-1 py-3 text-xs font-bold border border-[#EAE8E4] text-[#888888] hover:text-red-600 hover:border-red-200 rounded-xl transition-all bg-white"
                        >
                          取消訂單
                        </button>
                      )}
                      
                      <button
                        disabled={isClosed() || isSubmitting || calculateTotal() === 0}
                        onClick={handlePlaceOrder}
                        className="flex-[2] py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center"
                      >
                        {isSubmitting ? '處理中...' : activeSchedule.userOrder ? '修改訂單' : '送出訂購'}
                      </button>
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
        </>
        )}

      </main>

      {companyOrdersOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 px-5 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-orders-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCompanyOrdersOpen(false);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#EAE8E4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[#888888]">{todayDate}</p>
                <h2 id="company-orders-title" className="mt-1 text-lg font-bold text-[#333333]">大家點了什麼</h2>
              </div>
              <button
                type="button"
                onClick={() => setCompanyOrdersOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888] transition-colors hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                aria-label="關閉大家的訂單"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>

            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5 kaizen-scrollbar">
              {companyOrdersLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-[#888888]">
                  <i className="ti ti-loader-2 animate-spin text-lg text-[#EA5B3C]"></i>
                  載入中
                </div>
              )}

              {!companyOrdersLoading && companyOrdersError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {companyOrdersError}
                </p>
              )}

              {!companyOrdersLoading && !companyOrdersError && companyOrders.length === 0 && (
                <p className="py-10 text-center text-sm font-bold text-[#888888]">今天還沒有人送出訂單</p>
              )}

              {!companyOrdersLoading && !companyOrdersError && companyOrdersBySeatArea.map((group, groupIndex) => (
                <div key={group.area} className="space-y-3">
                  {groupIndex > 0 && (
                    <div className="border-t-2 border-dashed border-[#D6D1CA]" aria-hidden="true"></div>
                  )}
                  {group.orders.map(order => {
                    const displayNumber = `${group.area}${order.orderNumberDisplay || '--'}`;
                    const orderDetails = order.items.map(item => {
                      const itemNote = formatItemNoteDisplay(item.note);
                      const quantityText = item.quantity > 1 ? ` *${item.quantity}` : '';
                      return `${item.name}${itemNote ? `/${itemNote}` : ''}${quantityText}`;
                    });
                    return (
                      <div key={order.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="shrink-0 text-xs font-bold text-[#EA5B3C]">
                            {displayNumber}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-[#333333]">{order.userName}</span>
                          <span className="min-w-0 text-xs font-bold leading-5 text-[#666666]">
                            {orderDetails.join('／')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
