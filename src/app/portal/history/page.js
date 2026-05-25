'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

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
          if (data.user.role === 'admin') {
            router.push('/admin');
          } else {
            fetchTransactions();
          }
        }
      })
      .catch(() => router.push('/login'));
  }, []);

  const fetchTransactions = () => {
    fetch('/api/wallets?action=history')
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

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Page Header */}
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-history text-2xl text-[#EA5B3C]"></i> 個人歷史訂單與扣款紀錄
          </h2>
          <button
            onClick={() => router.push('/portal')}
            className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
          >
            返回訂餐首頁
          </button>
        </div>

        {/* Ledger Transactions Grid */}
        <div className="c-box">
          <h3 className="font-bold text-[#333333] text-base mb-6 border-l-4 border-l-[#EA5B3C] pl-2.5">
            儲值金變動與消費日誌
          </h3>

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
                    <th className="py-4 font-bold">交易日期</th>
                    <th className="py-4 font-bold">類別</th>
                    <th className="py-4 font-bold">異動金額</th>
                    <th className="py-4 font-bold">交易內容說明</th>
                    <th className="py-4 font-bold">經手人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                  {transactions.map(tx => {
                    const isTopup = tx.type === 'topup';
                    return (
                      <tr key={tx.id} className="hover:bg-[#F9F8F5]/50 transition-colors">
                        <td className="py-4 font-medium">
                          {new Date(tx.createdAt).toLocaleString('zh-TW', { hour12: false })}
                        </td>
                        <td className="py-4">
                          <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold ${
                            isTopup 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}>
                            {isTopup ? '帳戶加值' : '餐點扣款'}
                          </span>
                        </td>
                        <td className={`py-4 font-bold text-sm ${isTopup ? 'text-green-600' : 'text-red-600'}`}>
                          {isTopup ? '＋' : '－'}NT$ {Math.abs(tx.amount)}
                        </td>
                        <td className="py-4 leading-normal max-w-[400px]">
                          {isTopup ? (
                            <span>管理者為您的帳戶手動儲值</span>
                          ) : (
                            tx.order ? (
                              <div>
                                <span className="font-bold">{tx.order.schedule.restaurant.name}</span>
                                <span className="text-[#888888] ml-2 font-normal">
                                  ({tx.order.schedule.date})
                                </span>
                                {tx.order.note && (
                                  <div className="text-[10px] text-[#888888] mt-1 bg-[#F9F8F5] inline-block px-1.5 py-0.5 rounded border border-[#EAE8E4]">
                                    備註: {tx.order.note}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span>系統自動扣款</span>
                            )
                          )}
                        </td>
                        <td className="py-4 text-[#888888]">
                          {tx.operator ? tx.operator.name : '系統自動'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </>
  );
}
