'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function WalletsManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [selectedLedgerUserId, setSelectedLedgerUserId] = useState('');
  
  // Deposit Modal State
  const [selectedUser, setSelectedUser] = useState(null); // User object to deposit to
  const [walletMode, setWalletMode] = useState('topup');
  const [depositAmount, setDepositAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [adjustmentDirection, setAdjustmentDirection] = useState('increase');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

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
            fetchUsers();
            fetchTransactions('');
          }
        }
      })
      .catch(() => router.push('/login'));
  }, []);

  const fetchUsers = () => {
    fetch('/api/wallets?action=list_users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        }
      })
      .catch(err => console.error('無法載入使用者:', err));
  };

  const fetchTransactions = (userId = selectedLedgerUserId) => {
    const query = userId ? `&userId=${userId}` : '';
    fetch(`/api/wallets?action=history${query}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTransactions(data);
        }
      })
      .catch(err => console.error('無法載入交易日誌:', err));
  };

  const handleLedgerUserChange = (userId) => {
    setSelectedLedgerUserId(userId);
    fetchTransactions(userId);
  };

  const handleRoleChange = async (targetUser, role) => {
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          role
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '角色更新失敗');
      }

      setUsers(prev => prev.map(u => u.id === targetUser.id ? result.user : u));
      setStatusMsg({ text: `已將「${targetUser.name}」角色更新為${role === 'admin' ? '管理者' : '訂購者'}。`, type: 'success' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    const finalAmount = customAmount ? parseInt(customAmount, 10) : depositAmount;
    if (!finalAmount || finalAmount <= 0) {
      alert('請輸入或選擇大於 0 的金額！');
      return;
    }

    const signedAmount = walletMode === 'adjustment' && adjustmentDirection === 'decrease'
      ? -finalAmount
      : finalAmount;

    setIsSubmittingDeposit(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          type: walletMode === 'topup' ? 'topup' : 'adjustment',
          amount: signedAmount
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '儲值加值失敗');
      }

      const actionText = walletMode === 'topup'
        ? `加值 NT$ ${finalAmount}`
        : `${signedAmount > 0 ? '調增' : '調減'} NT$ ${Math.abs(signedAmount)}`;

      setStatusMsg({ 
        text: `帳務處理成功！已為「${selectedUser.name}」${actionText}。`, 
        type: 'success' 
      });
      fetchUsers();
      fetchTransactions();
      
      // Close modal/form
      setSelectedUser(null);
      setWalletMode('topup');
      setAdjustmentDirection('increase');
      setCustomAmount('');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmittingDeposit(false);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openWalletAction = (targetUser, mode) => {
    setSelectedUser(targetUser);
    setWalletMode(mode);
    setDepositAmount(mode === 'topup' ? 500 : 100);
    setCustomAmount('');
    setAdjustmentDirection('increase');
    setStatusMsg({ text: '', type: '' });
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
            <i className="ti ti-wallet text-2xl text-[#EA5B3C]"></i> 儲值金與異動管理後台
          </h2>
          <button
            onClick={() => router.push('/admin')}
            className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
          >
            返回排程總覽
          </button>
        </div>

        {statusMsg.text && (
          <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-xl flex items-center gap-2">
            <i className="ti ti-discount-check text-lg"></i>
            {statusMsg.text}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* User List and Search (Col-span 3) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="c-box space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                  成員錢包名冊與狀態
                </h3>
                
                {/* Search Input */}
                <div className="relative w-full md:w-[250px]">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋姓名或 Email..."
                    className="w-full text-xs pl-8 pr-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C]"
                  />
                  <i className="ti ti-search absolute left-2.5 top-2.5 text-[#888888]"></i>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#EAE8E4] rounded-xl bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F9F8F5] text-[#888888] font-bold border-b border-[#EAE8E4]">
                      <th className="p-3">姓名</th>
                      <th className="p-3">電子信箱</th>
                      <th className="p-3">角色</th>
                      <th className="p-3 text-right">當前餘額</th>
                      <th className="p-3 text-center">帳務操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-8 text-[#888888]">
                          找不到相符的成員。
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => {
                        const balance = u.balance;
                        let balanceColor = 'text-[#333333] font-bold';
                        let warningBadge = null;
                        
                        if (balance > 0) {
                          balanceColor = 'text-green-600 font-bold';
                        } else if (balance < 0) {
                          balanceColor = 'text-red-600 font-bold';
                          warningBadge = (
                            <span className="text-[9px] text-red-600 bg-red-50 border border-red-200 px-1 rounded ml-1 animate-pulse font-normal">
                              欠款
                            </span>
                          );
                        }

                        return (
                          <tr
                            key={u.id}
                            onClick={() => handleLedgerUserChange(u.id)}
                            className={`hover:bg-[#F9F8F5]/30 cursor-pointer ${selectedLedgerUserId === u.id ? 'bg-orange-50/50' : ''}`}
                          >
                            <td className="p-3 font-bold flex items-center gap-2">
                              {u.avatarUrl && (
                                <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                              )}
                              {u.name}
                            </td>
                            <td className="p-3 text-[#888888]">{u.email}</td>
                            <td className="p-3">
                              <select
                                value={u.role}
                                disabled={u.id === user.id}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleRoleChange(u, e.target.value);
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded border bg-white focus:outline-none focus:border-[#EA5B3C] ${
                                  u.role === 'admin'
                                    ? 'text-orange-700 border-orange-200'
                                    : 'text-gray-700 border-[#EAE8E4]'
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <option value="admin">管理者</option>
                                <option value="user">訂購者</option>
                              </select>
                            </td>
                            <td className="p-3 text-right font-bold text-sm">
                              <span className={balanceColor}>
                                {balance > 0 ? '＋' : balance < 0 ? '－' : ''}NT$ {Math.abs(balance)}
                              </span>
                              {warningBadge}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWalletAction(u, 'topup');
                                  }}
                                  className="text-[10px] font-bold border border-[#EAE8E4] px-2.5 py-1 rounded bg-white hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
                                >
                                  <i className="ti ti-plus mr-0.5"></i>儲值
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openWalletAction(u, 'adjustment');
                                  }}
                                  className="text-[10px] font-bold border border-[#EAE8E4] px-2.5 py-1 rounded bg-white hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
                                >
                                  <i className="ti ti-adjustments-dollar mr-0.5"></i>異動
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Deposit Action Form (Col-span 1) */}
          <div className="space-y-6">
            {selectedUser ? (
              <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-6 sticky top-24">
                <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-3">
                  <h3 className="font-bold text-base text-[#333333] flex items-center gap-1.5">
                    <i className={`${walletMode === 'topup' ? 'ti ti-piggy-bank' : 'ti ti-adjustments-dollar'} text-[#EA5B3C]`}></i>
                    {walletMode === 'topup' ? '儲值' : '異動'}
                  </h3>
                  <button 
                    onClick={() => {
                      setSelectedUser(null);
                      setWalletMode('topup');
                      setAdjustmentDirection('increase');
                      setCustomAmount('');
                    }}
                    className="text-[#888888] hover:text-[#EA5B3C] text-sm"
                  >
                    取消
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#F9F8F5] p-4 rounded-xl border border-[#EAE8E4] space-y-1">
                    <div className="text-[11px] text-[#888888] font-bold">儲值對象</div>
                    <div className="font-bold text-sm text-[#333333]">{selectedUser.name}</div>
                    <div className="text-xs text-[#888888] truncate">{selectedUser.email}</div>
                    <div className="text-xs font-bold text-[#333333] mt-2 pt-2 border-t border-[#EAE8E4]">
                      當前餘額: <span className={selectedUser.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        NT$ {selectedUser.balance}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleDepositSubmit} className="space-y-4">
                    {walletMode === 'adjustment' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#888888]">異動方向</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'increase', label: '調增金額', icon: 'ti ti-plus' },
                            { value: 'decrease', label: '調減金額', icon: 'ti ti-minus' },
                          ].map(option => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setAdjustmentDirection(option.value)}
                              className={`py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                adjustmentDirection === option.value
                                  ? 'border-[#EA5B3C] bg-orange-[0.005] text-[#EA5B3C]'
                                  : 'border-[#EAE8E4] bg-white text-[#333333] hover:border-[#D6D1CA]'
                              }`}
                            >
                              <i className={option.icon}></i>{option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Preset Amounts */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#888888]">
                        {walletMode === 'topup' ? '選擇儲值金額' : '選擇異動金額'}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[100, 500, 1000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setDepositAmount(amt);
                              setCustomAmount('');
                            }}
                            className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                              depositAmount === amt && !customAmount
                                ? 'border-[#EA5B3C] bg-orange-[0.005] text-[#EA5B3C]'
                                : 'border-[#EAE8E4] bg-white text-[#333333] hover:border-[#D6D1CA]'
                            }`}
                          >
                            NT$ {amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Amount */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#888888]">或輸入自訂金額 (NT$)</label>
                      <input
                        type="number"
                        placeholder="例如: 250"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setDepositAmount(0);
                        }}
                        className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingDeposit}
                      className="w-full py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingDeposit
                        ? '處理中...'
                        : walletMode === 'topup'
                          ? `確認加值 NT$ ${customAmount || depositAmount}`
                          : `確認${adjustmentDirection === 'increase' ? '調增' : '調減'} NT$ ${customAmount || depositAmount}`}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="bg-[#F9F8F5] border border-dashed border-[#D6D1CA] rounded-xl p-8 text-center text-xs text-[#888888] space-y-2 sticky top-24">
                <i className="ti ti-pointer-hand text-3xl text-[#888888]"></i>
                <p className="font-bold">請點擊成員右側的「儲值」或「異動」開始處理錢包金額。</p>
              </div>
            )}
          </div>

        </section>

        {/* Global Transaction Audit Ledger (Full width) */}
        <section className="c-box space-y-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-[#333333] text-base border-l-4 border-l-[#EA5B3C] pl-2.5">
                全站儲值與扣款異動日誌 (帳務審計軌跡)
              </h3>
              <p className="text-xs text-[#888888] pl-3">
                點擊上方成員列，或使用右側下拉選單查看指定成員紀錄。
              </p>
            </div>

            <div className="space-y-1.5 w-full md:w-[280px]">
              <label className="text-xs font-bold text-[#888888]">成員</label>
              <select
                value={selectedLedgerUserId}
                onChange={(e) => handleLedgerUserChange(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
              >
                <option value="">全部成員</option>
                {users.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#888888]">
              {selectedLedgerUserId ? '此成員尚無任何交易明細與變動日誌。' : '系統尚無任何交易明細與變動日誌。'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#EAE8E4] text-[#888888] font-bold">
                    <th className="py-3 font-bold">交易日期</th>
                    <th className="py-3 font-bold">對象成員</th>
                    <th className="py-3 font-bold">類別</th>
                    <th className="py-3 font-bold">異動金額</th>
                    <th className="py-3 font-bold">內容說明</th>
                    <th className="py-3 font-bold">操作經手人</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                  {transactions.map(tx => {
                    const isTopup = tx.type === 'topup';
                    const isAdjustment = tx.type === 'adjustment';
                    const isPositive = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-[#F9F8F5]/30">
                        <td className="py-3">
                          {new Date(tx.createdAt).toLocaleString('zh-TW', { hour12: false })}
                        </td>
                        <td className="py-3 font-bold">
                          {tx.user?.name} <span className="text-[10px] text-[#888888] font-normal">({tx.user?.email})</span>
                        </td>
                        <td className="py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                            isTopup || (isAdjustment && isPositive)
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : isAdjustment
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }`}>
                            {isTopup
                              ? '帳戶加值'
                              : isAdjustment
                                ? (isPositive ? '帳務調增' : '帳務調減')
                                : '餐點扣款'}
                          </span>
                        </td>
                        <td className={`py-3 font-bold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.amount >= 0 ? '＋' : '－'}NT$ {Math.abs(tx.amount)}
                        </td>
                        <td className="py-3">
                          {isTopup ? (
                            <span>後台管理員手動加值儲值金</span>
                          ) : isAdjustment ? (
                            <span>後台管理員帳務{isPositive ? '調增' : '調減'}</span>
                          ) : (
                            tx.order ? (
                              <span>
                                便當點餐扣款：<b>{tx.order.schedule.restaurant.name}</b> ({tx.order.schedule.date})
                              </span>
                            ) : (
                              <span>餐點自動扣款</span>
                            )
                          )}
                        </td>
                        <td className="py-3 text-[#888888]">
                          {tx.operator ? tx.operator.name : '系統自動'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </main>
    </>
  );
}
