'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { canAccessAdminPage } from '@/lib/adminPermissions';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function getDisplayName(name = '') {
  return name.replace(/(\s*[\(（][^\)）]*[\)）]\s*)+$/g, '').trim();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDate = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0);
  const days = Array(firstDate.getDay()).fill(null);
  for (let day = 1; day <= lastDate.getDate(); day++) days.push(new Date(year, month, day));
  return days;
}

function getDateLabel(startDate, endDate) {
  if (!startDate) return '全部日期';
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} - ${endDate}`;
}

function getAuditDateBounds() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = new Date(today);
  earliest.setFullYear(earliest.getFullYear() - 2);
  return {
    earliest,
    earliestKey: toDateKey(earliest),
    today,
    todayKey: toDateKey(today),
  };
}

export default function AccountingAuditPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(6);

  const fetchTransactions = ({ userId = selectedUserId, from = startDate, to = endDate } = {}) => {
    const params = new URLSearchParams({ action: 'history' });
    setVisibleTransactionCount(6);
    if (userId) params.set('userId', userId);
    if (from) params.set('startDate', from);
    if (to) params.set('endDate', to);
    setLoading(true);
    setMessage('');
    fetch(`/api/wallets?${params.toString()}`)
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data.error || '無法載入帳務軌跡');
        setTransactions(Array.isArray(data) ? data : []);
      })
      .catch(error => setMessage(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!data?.user) return router.push('/login');
        if (!canAccessAdminPage(data.user, 'accounting-audit')) return router.push('/portal');
        setUser(data.user);
        return fetch('/api/wallets?action=list_users');
      })
      .then(response => response?.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
        fetchTransactions({ userId: '', from: '', to: '' });
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleUserChange = userId => {
    setSelectedUserId(userId);
    fetchTransactions({ userId });
  };

  const handleDateSelect = dateKey => {
    const { earliestKey, todayKey } = getAuditDateBounds();
    if (dateKey < earliestKey || dateKey > todayKey) return;
    let nextStart = dateKey;
    let nextEnd = '';
    if (startDate && !endDate) {
      if (dateKey > startDate) {
        nextStart = startDate;
        nextEnd = dateKey;
        setCalendarOpen(false);
      } else if (dateKey === startDate) {
        setCalendarOpen(false);
      }
    }
    setStartDate(nextStart);
    setEndDate(nextEnd);
    fetchTransactions({ from: nextStart, to: nextEnd });
  };

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setCalendarOpen(false);
    fetchTransactions({ from: '', to: '' });
  };

  const selectedMember = users.find(member => member.id === selectedUserId);
  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const filteredMembers = normalizedMemberSearch
    ? users.filter(member => `${getDisplayName(member.name)} ${member.email}`.toLowerCase().includes(normalizedMemberSearch))
    : users;
  const auditDateBounds = getAuditDateBounds();
  const earliestCalendarMonth = new Date(auditDateBounds.earliest.getFullYear(), auditDateBounds.earliest.getMonth(), 1);
  const latestCalendarMonth = new Date(auditDateBounds.today.getFullYear(), auditDateBounds.today.getMonth(), 1);
  const canViewPreviousMonth = calendarMonth > earliestCalendarMonth;
  const canViewNextMonth = calendarMonth < latestCalendarMonth;
  const visibleTransactions = transactions.slice(0, visibleTransactionCount);

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#F9F8F5] text-sm font-bold text-[#888888]">載入中...</div>;

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 px-6 py-10">
        <div className="flex items-center justify-between border-b border-[#EAE8E4] pb-4">
          <h1 className="flex items-center gap-2 text-xl font-bold"><i className="ti ti-file-invoice text-2xl text-[#EA5B3C]" />帳務軌跡</h1>
          <button type="button" onClick={() => router.push('/admin/wallets')} className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2 text-xs font-bold transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]">返回儲值管理</button>
        </div>

        <section className="c-box space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h2 className="border-l-4 border-[#EA5B3C] pl-2.5 text-base font-bold">全站儲值與扣款異動日誌 (帳務審計軌跡)</h2>
              <p className="pl-3 text-xs text-[#888888]">使用右側成員與日期篩選查看指定帳務紀錄。</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_240px] md:w-[560px]">
              <div
                className="relative space-y-1.5"
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setMemberDropdownOpen(false);
                }}
              >
                <div className="flex h-4 items-center"><label className="text-xs font-bold text-[#888888]">成員</label></div>
                <div className="relative">
                  <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="search"
                    value={memberSearch}
                    onFocus={() => setMemberDropdownOpen(true)}
                    onChange={event => {
                      setMemberSearch(event.target.value);
                      setMemberDropdownOpen(true);
                    }}
                    placeholder={selectedMember ? `${getDisplayName(selectedMember.name)} (${selectedMember.email})` : '全部成員｜搜尋姓名或 Email'}
                    aria-label="搜尋或選擇成員"
                    aria-expanded={memberDropdownOpen}
                    className="h-9 w-full rounded-lg border border-[#EAE8E4] bg-white pl-9 pr-3 text-xs font-medium focus:border-[#EA5B3C] focus:outline-none"
                  />
                </div>
                {memberDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#EAE8E4] bg-white p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.08)] kaizen-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        handleUserChange('');
                        setMemberSearch('');
                        setMemberDropdownOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs font-bold transition-all ${!selectedUserId ? 'bg-[#FFF3EF] text-[#EA5B3C]' : 'hover:bg-[#F9F8F5]'}`}
                    >
                      全部成員
                    </button>
                    {filteredMembers.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-[#888888]">找不到相符的成員。</div>
                    ) : filteredMembers.map(member => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          handleUserChange(member.id);
                          setMemberSearch('');
                          setMemberDropdownOpen(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left transition-all ${selectedUserId === member.id ? 'bg-[#FFF3EF]' : 'hover:bg-[#F9F8F5]'}`}
                      >
                        <span className="block text-xs font-bold text-[#333333]">{getDisplayName(member.name)}</span>
                        <span className="block truncate text-[10px] text-[#888888]">{member.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative space-y-1.5">
                <div className="flex h-4 items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#888888]">日期</label>
                  {(startDate || endDate) && <button type="button" onClick={clearDateFilter} className="text-[10px] font-bold text-[#888888] hover:text-[#EA5B3C]">清除</button>}
                </div>
                <button type="button" onClick={() => setCalendarOpen(open => !open)} className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[#EAE8E4] bg-white px-3 text-left text-xs font-medium hover:border-[#D6D1CA]"><span>{getDateLabel(startDate, endDate)}</span><i className="ti ti-calendar text-[#888888]" /></button>
                {calendarOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-[min(280px,calc(100vw-3rem))] rounded-xl border border-[#EAE8E4] bg-white p-3 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                    <div className="mb-3 flex items-center justify-between">
                      <button type="button" disabled={!canViewPreviousMonth} onClick={() => setCalendarMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-8 w-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-30"><i className="ti ti-chevron-left" /></button>
                      <div className="text-xs font-bold">{calendarMonth.getFullYear()} 年 {calendarMonth.getMonth() + 1} 月</div>
                      <button type="button" disabled={!canViewNextMonth} onClick={() => setCalendarMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-8 w-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-30"><i className="ti ti-chevron-right" /></button>
                    </div>
                    <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#888888]">{WEEKDAY_LABELS.map(label => <div key={label} className="py-1">{label}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">{getMonthDays(calendarMonth).map((date, index) => {
                      if (!date) return <div key={`empty-${index}`} className="h-8" />;
                      const key = toDateKey(date);
                      const disabled = key < auditDateBounds.earliestKey || key > auditDateBounds.todayKey;
                      const selected = key === startDate || key === endDate;
                      const inRange = startDate && endDate && key > startDate && key < endDate;
                      return <button key={key} type="button" disabled={disabled} onClick={() => handleDateSelect(key)} className={`h-8 rounded-lg text-[11px] font-bold ${disabled ? 'cursor-not-allowed text-[#D6D1CA]' : selected ? 'bg-[#EA5B3C] text-white' : inRange ? 'bg-orange-50 text-[#EA5B3C]' : 'text-[#333333] hover:bg-[#F9F8F5] hover:text-[#EA5B3C]'}`}>{date.getDate()}</button>;
                    })}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {message && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600">{message}</div>}
          {loading ? <div className="py-12 text-center text-xs text-[#888888]">載入帳務軌跡中...</div> : transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#888888]">{selectedUserId ? '此成員尚無任何交易明細與變動日誌。' : '系統尚無任何交易明細與變動日誌。'}</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-auto kaizen-scrollbar">
              <table className="min-w-[760px] w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-white"><tr className="border-b border-[#EAE8E4] font-bold text-[#888888]"><th className="py-3">交易日期</th><th className="py-3">對象成員</th><th className="py-3">異動金額</th><th className="py-3">來源</th><th className="py-3">操作經手人</th><th className="py-3">備註</th></tr></thead>
                <tbody className="divide-y divide-[#EAE8E4]">{visibleTransactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-[#F9F8F5]/30">
                    <td className="py-3">{new Date(transaction.createdAt).toLocaleString('zh-TW', { hour12: false })}</td>
                    <td className="py-3 font-bold"><span className="group relative inline-flex">{getDisplayName(transaction.user?.name)}<span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#EAE8E4] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#555555] opacity-0 shadow-lg group-hover:opacity-100">{transaction.user?.email}</span></span></td>
                    <td className={`py-3 font-bold ${transaction.amount > 0 ? 'text-green-600' : transaction.amount < 0 ? 'text-red-600' : 'text-[#888888]'}`}>NT$ {Math.abs(transaction.amount)}</td>
                    <td className="py-3 text-[#555555]">{transaction.source || (transaction.type === 'charge' ? '訂單扣款' : '-')}</td>
                    <td className="py-3 text-[#888888]">{transaction.operator ? getDisplayName(transaction.operator.name) : '系統自動'}</td>
                    <td className="max-w-[240px] py-3 text-[#555555]">{transaction.note || '-'}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
              {visibleTransactionCount < transactions.length && (
                <button
                  type="button"
                  onClick={() => setVisibleTransactionCount(current => Math.min(current + 10, transactions.length))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3 text-xs font-bold text-[#555555] transition-all hover:border-[#EA5B3C] hover:bg-white hover:text-[#EA5B3C]"
                >
                  查看更多
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
