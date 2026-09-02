'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MessageFormatsManager from '@/components/MessageFormatsManager';
import { canAccessAdminPage } from '@/lib/adminPermissions';

const formatDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNote = note => String(note || '')
  .split(';')
  .map(part => part.trim())
  .filter(Boolean)
  .join(' ');

const getOrderNumber = order => {
  const area = ['A', 'B'].includes(order.seatArea) ? order.seatArea : 'A';
  const rawSerial = parseInt((order.orderNumber || '').slice(-3), 10);
  const serial = order.orderNumberDisplay || (Number.isNaN(rawSerial) ? '' : String(rawSerial).padStart(2, '0'));
  return serial ? `${area}${serial}` : '-';
};

function MarkdownPreview({ content }) {
  const renderInline = text => String(text || '').split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  ));

  return (
    <div className="space-y-1.5 text-xs leading-6 text-[#555555]">
      {String(content || '').split(/\r?\n/).map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;
        if (line.startsWith('### ')) return <h5 key={index} className="text-sm font-bold text-[#333333]">{renderInline(line.slice(4))}</h5>;
        if (line.startsWith('## ')) return <h4 key={index} className="text-base font-bold text-[#333333]">{renderInline(line.slice(3))}</h4>;
        if (line.startsWith('# ')) return <h3 key={index} className="text-lg font-bold text-[#333333]">{renderInline(line.slice(2))}</h3>;
        if (/^[-*]\s+/.test(line)) return <div key={index} className="flex gap-2"><span>•</span><span>{renderInline(line.replace(/^[-*]\s+/, ''))}</span></div>;
        return <p key={index}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

export default function AdminOrderStatsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [collapsedRestaurants, setCollapsedRestaurants] = useState({});
  const [historyDate, setHistoryDate] = useState(() => formatDate(new Date()));
  const [historySchedule, setHistorySchedule] = useState(null);
  const [historyMessage, setHistoryMessage] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.user) {
          router.push('/login');
        } else if (!canAccessAdminPage(data.user, 'order-stats')) {
          router.push('/portal');
        } else {
          setUser(data.user);
        }
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/schedule?startDate=${selectedDate}&endDate=${selectedDate}`)
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || '統計資料載入失敗');
        const schedules = Array.isArray(data) ? data : data.schedules || [];
        setSchedule(schedules.find(item => item.date === selectedDate) || null);
      })
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [selectedDate, user]);

  const restaurantGroups = useMemo(() => {
    if (!schedule) return [];
    const activeOrders = (schedule.orders || []).filter(order => order.status !== 'cancelled');
    const configured = schedule.restaurantConfigs?.length
      ? schedule.restaurantConfigs
      : schedule.restaurant
        ? [{ restaurantId: schedule.restaurantId, restaurant: schedule.restaurant }]
        : [];

    return configured.map(config => {
      const itemGroups = new Map();
      const restaurantOrders = [];
      activeOrders.forEach(order => {
        let includesRestaurant = false;
        (order.orderItems || []).forEach(orderItem => {
          if (orderItem.menuItem?.restaurantId !== config.restaurantId) return;
          includesRestaurant = true;
          const note = formatNote(orderItem.note);
          const key = `${orderItem.menuItemId}-${note}`;
          const existing = itemGroups.get(key) || {
            name: orderItem.menuItem?.name || '未命名餐點',
            price: orderItem.unitPrice,
            category: orderItem.menuItem?.category || '',
            note,
            qty: 0,
            orderNumbers: []
          };
          existing.qty += orderItem.quantity;
          const number = getOrderNumber(order);
          if (number !== '-' && !existing.orderNumbers.includes(number)) existing.orderNumbers.push(number);
          itemGroups.set(key, existing);
        });
        if (includesRestaurant) restaurantOrders.push(order);
      });
      const items = Array.from(itemGroups.values());
      return {
        id: config.restaurantId,
        name: config.restaurant?.name || '未命名餐廳',
        items,
        quantity: items.reduce((sum, item) => sum + item.qty, 0),
        amount: items.reduce((sum, item) => sum + item.price * item.qty, 0),
        orderCount: restaurantOrders.length
      };
    });
  }, [schedule]);

  const copyText = async (text, successMessage) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setMessage(successMessage);
    } catch {
      setMessage('複製失敗，請再試一次。');
    }
    setTimeout(() => setMessage(''), 2500);
  };

  const fetchHistory = async () => {
    if (!historyDate) return;
    setHistoryLoading(true);
    setHistoryMessage('');
    setHistorySchedule(null);
    try {
      const response = await fetch(`/api/schedule?startDate=${historyDate}&endDate=${historyDate}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '歷史訂餐紀錄查詢失敗。');
      const target = Array.isArray(data) ? data.find(item => item.date === historyDate) : null;
      if (!target) setHistoryMessage('此日期沒有排程或訂餐紀錄。');
      else setHistorySchedule(target);
    } catch (error) {
      setHistoryMessage(error.message === 'Failed to fetch' ? '查詢失敗，請確認服務或網路連線。' : error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const historyOrders = historySchedule?.orders?.filter(order => order.status !== 'cancelled') || [];
  const historyQuantity = historyOrders.reduce((sum, order) => sum + (order.orderItems || []).reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const historyAmount = historyOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F5] text-sm font-bold text-[#888888]">載入中...</div>;

  return (
    <div className="min-h-screen bg-[#F9F8F5] text-[#333333]">
      <Navbar user={user} />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <MessageFormatsManager />
        <section className="order-2 space-y-5 rounded-xl border border-[#EAE8E4] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-base font-bold"><i className="ti ti-history text-lg text-[#EA5B3C]" />依日期回查訂餐明細</h2>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <input type="date" value={historyDate} onChange={event => setHistoryDate(event.target.value)} className="rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-medium focus:border-[#EA5B3C] focus:outline-none" />
              <button type="button" onClick={fetchHistory} disabled={historyLoading || !historyDate} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#333333] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#EA5B3C] disabled:opacity-50"><i className={historyLoading ? 'ti ti-loader animate-spin' : 'ti ti-search'} />{historyLoading ? '查詢中...' : '查詢紀錄'}</button>
            </div>
          </div>
          {historyMessage && <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-3 text-xs text-[#888888]">{historyMessage}</div>}
          {historySchedule && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4"><p className="text-[11px] font-bold text-[#888888]">日期</p><p className="mt-1 text-sm font-bold">{historySchedule.date}</p></div>
                <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4"><p className="text-[11px] font-bold text-[#888888]">餐廳</p><p className="mt-1 text-sm font-bold">{historySchedule.isOpen || historySchedule.deliveredAt ? (historySchedule.restaurantConfigs?.map(config => config.restaurant?.name).filter(Boolean).join('、') || historySchedule.restaurant?.name || '未排定') : '假期'}</p></div>
                <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4"><p className="text-[11px] font-bold text-[#888888]">總份數</p><p className="mt-1 text-sm font-bold text-[#EA5B3C]">{historyQuantity} 份</p></div>
                <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4"><p className="text-[11px] font-bold text-[#888888]">總金額</p><p className="mt-1 text-sm font-bold text-[#EA5B3C]">NT$ {historyAmount}</p></div>
              </div>
              <div className="space-y-3">
                <h3 className="border-l-4 border-[#EA5B3C] pl-2.5 text-sm font-bold">成員訂單明細</h3>
                {historyOrders.length === 0 ? <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] py-8 text-center text-xs text-[#888888]">此日期沒有成員訂單。</div> : (
                  <div className="max-h-72 overflow-auto rounded-xl border border-[#EAE8E4] bg-white custom-scrollbar">
                    <table className="min-w-[760px] w-full table-fixed border-collapse text-left text-xs">
                      <thead className="sticky top-0 border-b border-[#EAE8E4] bg-[#F9F8F5] font-bold text-[#888888]"><tr><th className="w-[18%] px-4 py-3">姓名</th><th className="w-[30%] px-4 py-3">餐點</th><th className="w-[14%] px-4 py-3 text-center">金額</th><th className="w-[38%] px-4 py-3">備註</th></tr></thead>
                      <tbody className="divide-y divide-[#EAE8E4]">{historyOrders.map(order => <tr key={order.id}><td className="px-4 py-3 align-top font-bold">{order.user.name}</td><td className="px-4 py-3 align-top">{(order.orderItems || []).map(item => <div key={item.id} className="font-medium">{item.menuItem.name} <span className="text-[#888888]">x {item.quantity}</span>{item.note && <div className="text-[11px] font-bold text-[#EA5B3C]">{formatNote(item.note)}</div>}</div>)}</td><td className="px-4 py-3 text-center align-top font-bold text-[#EA5B3C]">NT$ {order.totalAmount}</td><td className="px-4 py-3 align-top">{order.note || <span className="text-[#888888]">-</span>}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="order-1 rounded-xl border border-[#EAE8E4] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 border-b border-[#EAE8E4] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold">訂餐統計</h1>
            </div>
            <input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} className="rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-sm font-bold focus:border-[#EA5B3C] focus:outline-none" />
          </div>

          {schedule?.dailyAnnouncement && (
            <div className="mt-5 border-l-4 border-[#EA5B3C] pl-3">
              <h2 className="text-sm font-bold">當日餐廳公告</h2>
              <div className="mt-2"><MarkdownPreview content={schedule.dailyAnnouncement} /></div>
            </div>
          )}

          {message && <p className="mt-4 rounded-lg bg-[#FFF3EF] px-3 py-2 text-xs font-bold text-[#EA5B3C]">{message}</p>}

          <div className="mt-6 space-y-5">
            {loading ? (
              <p className="py-12 text-center text-sm text-[#888888]">載入統計中...</p>
            ) : restaurantGroups.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#888888]">此日期尚無餐廳訂餐統計。</p>
            ) : restaurantGroups.map(group => {
              const collapsed = collapsedRestaurants[group.id] !== false;
              const sortedItems = [...group.items].sort((left, right) => {
                const leftIsAlaCarte = left.category.includes('單點') || left.category.includes('加點');
                const rightIsAlaCarte = right.category.includes('單點') || right.category.includes('加點');
                if (leftIsAlaCarte !== rightIsAlaCarte) return leftIsAlaCarte ? 1 : -1;
                const nameOrder = left.name.localeCompare(right.name, 'zh-Hant', { numeric: true });
                if (nameOrder !== 0) return nameOrder;
                return left.note.localeCompare(right.note, 'zh-Hant', { numeric: true });
              });
              const alaCarteQuantity = sortedItems
                .filter(item => item.category.includes('單點') || item.category.includes('加點'))
                .reduce((sum, item) => sum + item.qty, 0);
              const mealQuantity = group.quantity - alaCarteQuantity;
              const basicText = [
                ...sortedItems.map(item => `${item.name}${item.note ? `/${item.note}` : ''}*${item.qty}`),
                '',
                `共計${mealQuantity}份餐，單點${alaCarteQuantity}份`,
                `共計$${group.amount}`
              ].join('\n');
              const numberedItemText = sortedItems
                .map(item => `${item.name}${item.note ? ` ${item.note}` : ''} *${item.qty} [編號:${[...item.orderNumbers].sort().join('、')}]`)
                .join('\n');
              const numberedText = `${numberedItemText}\n\n共計${mealQuantity}份餐，單點${alaCarteQuantity}份\n共計$${group.amount}`;
              return (
                <section key={group.id} className="overflow-hidden rounded-md border border-[#EAE8E4] bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE8E4] bg-[#F9F8F5] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold">{group.name}</h2>
                      <button type="button" onClick={() => copyText(basicText, `已複製${group.name}訂單`)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EA5B3C] text-[#EA5B3C]" title="複製訂單"><i className="ti ti-copy" /></button>
                      <button type="button" onClick={() => copyText(numberedText, `已複製${group.name}編號統整`)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EA5B3C] text-[#EA5B3C]" title="複製編號統整"><i className="ti ti-list-numbers" /></button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right font-bold"><span className="block text-[10px] text-[#888888]">今日總份數</span><span className="block text-xl text-[#EA5B3C]">{group.quantity} 份</span><span className="text-[11px] text-[#888888]">{group.orderCount} 人・NT$ {group.amount}</span></div>
                      <button type="button" onClick={() => setCollapsedRestaurants(current => ({ ...current, [group.id]: current[group.id] === false }))} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888]" aria-label={collapsed ? `展開${group.name}` : `收合${group.name}`}><i className={`ti ${collapsed ? 'ti-chevron-down' : 'ti-chevron-up'}`} /></button>
                    </div>
                  </div>
                  {!collapsed && (
                    <div className={`grid grid-cols-1 gap-3 p-4 md:grid-cols-2 ${group.items.length > 3 ? 'max-h-[465px] overflow-y-auto kaizen-scrollbar md:max-h-none md:overflow-visible' : ''}`}>
                      {group.items.map(item => <div key={`${item.name}-${item.note}`} className="flex items-center justify-between rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-4"><div><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-[#888888]">單價: NT$ {item.price}</p>{item.note && <p className="mt-1 text-xs font-bold text-[#EA5B3C]">備註: {item.note}</p>}</div><p className="shrink-0 text-lg font-bold text-[#EA5B3C]">{item.qty}<span className="ml-1 text-xs text-[#333333]">份</span></p></div>)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
