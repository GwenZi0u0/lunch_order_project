'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

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
  const days = [];

  for (let i = 0; i < firstDate.getDay(); i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDate.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function getDateLabel(startDate, endDate) {
  if (!startDate) return '全部日期';
  if (!endDate || startDate === endDate) return startDate;
  return `${startDate} - ${endDate}`;
}

function formatTransactionTime(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [isLedgerCalendarOpen, setIsLedgerCalendarOpen] = useState(false);
  const [ledgerCalendarMonth, setLedgerCalendarMonth] = useState(() => new Date());
  const [selectedTransaction, setSelectedTransaction] = useState(null);

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
          fetchTransactions();
        }
      })
      .catch(() => router.push('/login'));
  }, []);

  useEffect(() => {
    if (!selectedTransaction) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedTransaction]);

  const fetchTransactions = ({
    startDate = ledgerStartDate,
    endDate = ledgerEndDate
  } = {}) => {
    const params = new URLSearchParams({
      action: 'history',
      scope: 'mine'
    });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    fetch(`/api/wallets?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTransactions(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('無法載入交易紀錄:', err);
        setLoading(false);
      });
  };

  const handleLedgerDateSelect = (dateKey) => {
    let nextStartDate = dateKey;
    let nextEndDate = '';

    if (ledgerStartDate && !ledgerEndDate) {
      if (dateKey > ledgerStartDate) {
        nextStartDate = ledgerStartDate;
        nextEndDate = dateKey;
        setIsLedgerCalendarOpen(false);
      } else if (dateKey === ledgerStartDate) {
        nextStartDate = dateKey;
        setIsLedgerCalendarOpen(false);
      }
    }

    setLedgerStartDate(nextStartDate);
    setLedgerEndDate(nextEndDate);
    fetchTransactions({
      startDate: nextStartDate,
      endDate: nextEndDate
    });
  };

  const clearLedgerDateFilter = () => {
    setLedgerStartDate('');
    setLedgerEndDate('');
    setIsLedgerCalendarOpen(false);
    fetchTransactions({
      startDate: '',
      endDate: ''
    });
  };

  if (!user || loading) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入交易明細中...</span>
        </div>
      </div>
    );
  }

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
    }

    return {
      cardBorder: 'border-l-4 border-l-red-600 border-[#EAE8E4] bg-red-[0.005]',
      valueColor: 'text-red-600',
      label: '帳戶欠款'
    };
  };

  const wallet = getWalletStyles();
  const walletAmount = `${user.balance < 0 ? '－' : ''}NT$ ${Math.abs(user.balance)}`;

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-history text-2xl text-[#EA5B3C]"></i> 消費日誌
          </h2>
          <button
            onClick={() => router.push('/portal')}
            className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
          >
            返回訂餐首頁
          </button>
        </div>

        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className={`p-5 bg-[#F9F8F5] rounded-xl border ${wallet.cardBorder}`}>
            <span className="text-xs font-bold text-[#888888] tracking-widest uppercase mb-2 block">{wallet.label}</span>
            <div className={`text-3xl font-bold ${wallet.valueColor}`}>
              {walletAmount}
            </div>
          </div>
        </section>

        {/* Ledger Transactions Grid */}
        <div className="c-box">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <h3 className="font-bold text-[#333333] text-base border-l-4 border-l-[#EA5B3C] pl-2.5">
              個人歷史訂單與扣款紀錄
            </h3>

            <div className="space-y-1.5 relative w-full md:w-[240px]">
              <div className="h-4 flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#888888]">日期</label>
                {(ledgerStartDate || ledgerEndDate) && (
                  <button
                    type="button"
                    onClick={clearLedgerDateFilter}
                    className="text-[10px] font-bold text-[#888888] hover:text-[#EA5B3C] transition-all"
                  >
                    清除
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsLedgerCalendarOpen(prev => !prev)}
                className="w-full h-9 text-xs px-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium text-left flex items-center justify-between gap-2 hover:border-[#D6D1CA] transition-all"
              >
                <span>{getDateLabel(ledgerStartDate, ledgerEndDate)}</span>
                <i className="ti ti-calendar text-[#888888]"></i>
              </button>

              {isLedgerCalendarOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-[280px] rounded-xl border border-[#EAE8E4] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] p-3">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setLedgerCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="w-8 h-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] transition-all"
                    >
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <div className="text-xs font-bold text-[#333333]">
                      {ledgerCalendarMonth.getFullYear()} 年 {ledgerCalendarMonth.getMonth() + 1} 月
                    </div>
                    <button
                      type="button"
                      onClick={() => setLedgerCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="w-8 h-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] transition-all"
                    >
                      <i className="ti ti-chevron-right"></i>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#888888] mb-1">
                    {WEEKDAY_LABELS.map(label => (
                      <div key={label} className="py-1">{label}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getMonthDays(ledgerCalendarMonth).map((date, index) => {
                      if (!date) {
                        return <div key={`empty-${index}`} className="h-8" />;
                      }

                      const dateKey = toDateKey(date);
                      const isStart = dateKey === ledgerStartDate;
                      const isEnd = dateKey === ledgerEndDate;
                      const isInRange = ledgerStartDate && ledgerEndDate && dateKey > ledgerStartDate && dateKey < ledgerEndDate;

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => handleLedgerDateSelect(dateKey)}
                          className={`h-8 rounded-lg text-[11px] font-bold transition-all ${
                            isStart || isEnd
                              ? 'bg-[#EA5B3C] text-white'
                              : isInRange
                                ? 'bg-orange-50 text-[#EA5B3C]'
                                : 'text-[#333333] hover:bg-[#F9F8F5] hover:text-[#EA5B3C]'
                          }`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-16 text-xs text-[#888888] space-y-3">
              <i className="ti ti-receipt-off text-5xl text-[#D6D1CA] block"></i>
              <span>尚無任何交易與扣款明細。</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#EAE8E4] text-[#888888] font-bold">
                    <th className="py-4 font-bold">交易時間</th>
                    <th className="py-4 font-bold">異動金額</th>
                    <th className="py-4 font-bold">來源</th>
                    <th className="hidden py-4 font-bold md:table-cell">內容</th>
                    <th className="hidden py-4 font-bold md:table-cell">經手人</th>
                    <th className="hidden py-4 font-bold md:table-cell">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                  {transactions.map(tx => {
                    return (
                      <tr key={tx.id} className="hover:bg-[#F9F8F5]/50 transition-colors">
                        <td className="py-4 font-medium">
                          {formatTransactionTime(tx.createdAt)}
                        </td>
                        <td className={`py-4 font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '＋' : '－'}NT$ {Math.abs(tx.amount)}
                        </td>
                        <td className="py-4 text-[#555555]">
                          {tx.source || (tx.type === 'charge' ? '訂單扣款' : '-')}
                        </td>
                        <td className="hidden py-4 md:table-cell">
                          {tx.order?.orderItems?.length ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTransaction(tx)}
                              className="font-bold text-[#EA5B3C] underline underline-offset-4"
                            >
                              查看
                            </button>
                          ) : '-'}
                        </td>
                        <td className="hidden py-4 text-[#888888] md:table-cell">
                          {tx.operator ? tx.operator.name : '系統自動'}
                        </td>
                        <td className="hidden py-4 leading-normal max-w-[400px] text-[#555555] md:table-cell">
                          {tx.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-[#EAE8E4] bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-[#333333]">訂單詳細內容</h4>
                  <p className="mt-1 text-xs font-bold text-[#888888]">
                    {selectedTransaction.order?.schedule?.restaurant?.name || '訂單'} · {formatTransactionTime(selectedTransaction.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTransaction(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                  aria-label="關閉訂單詳細內容"
                >
                  <i className="ti ti-x text-base"></i>
                </button>
              </div>
              <div className="space-y-3">
                {selectedTransaction.order?.orderItems?.map(item => (
                  <div key={item.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-bold text-[#333333]">{item.menuItem?.name || '餐點'}</div>
                      <div className="shrink-0 text-sm font-bold text-[#EA5B3C]">x {item.quantity}</div>
                    </div>
                    {item.note && (
                      <div className="mt-2 text-xs font-bold text-[#EA5B3C]">
                        備註: {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#EAE8E4] pt-4 text-sm font-bold">
                <span className="text-[#333333]">總金額</span>
                <span className="text-[#EA5B3C]">NT$ {Math.abs(selectedTransaction.amount)}</span>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
