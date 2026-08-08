'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

function getDisplayName(name = '') {
  return name.replace(/\s*\((餘額充足|餘額歸零|帳戶欠款)\)\s*$/, '');
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [draftRole, setDraftRole] = useState('user');
  const [activeRoleInfo, setActiveRoleInfo] = useState('');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    const loadPage = async () => {
      try {
        const authRes = await fetch('/api/auth');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }

        const authData = await authRes.json();
        if (authData.user.role !== 'admin') {
          router.push('/portal');
          return;
        }

        setUser(authData.user);
        const membersRes = await fetch('/api/wallets?action=list_members');
        const membersData = await membersRes.json();
        if (!membersRes.ok) throw new Error(membersData.error || '無法載入人員名冊');
        setMembers(Array.isArray(membersData) ? membersData : []);
      } catch (error) {
        setStatusMsg({ text: error.message, type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [router]);

  useEffect(() => {
    if (!statusMsg.text) return undefined;
    const timer = setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000);
    return () => clearTimeout(timer);
  }, [statusMsg.text]);

  useEffect(() => {
    if (!selectedMember) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = event => {
      if (event.key === 'Escape' && !updatingUserId) setSelectedMember(null);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMember, updatingUserId]);

  const filteredMembers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter(member =>
      member.name.toLowerCase().includes(keyword) || member.email.toLowerCase().includes(keyword)
    );
  }, [members, searchTerm]);

  const adminCount = members.filter(member => member.role === 'admin').length;
  const userCount = members.length - adminCount;

  const openMemberSettings = member => {
    setSelectedMember(member);
    setDraftRole(member.role);
    setActiveRoleInfo('');
  };

  const handleRoleChange = async () => {
    if (!selectedMember || selectedMember.role === draftRole || updatingUserId) {
      setSelectedMember(null);
      return;
    }

    setUpdatingUserId(selectedMember.id);
    setStatusMsg({ text: '', type: '' });
    try {
      const response = await fetch('/api/wallets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedMember.id, role: draftRole })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '角色更新失敗');

      setMembers(current => current.map(item => item.id === selectedMember.id ? { ...item, role: result.user.role } : item));
      setStatusMsg({
        text: `已將「${getDisplayName(selectedMember.name)}」設為${draftRole === 'admin' ? '管理者' : '訂購者'}。`,
        type: 'success'
      });
      setSelectedMember(null);
    } catch (error) {
      setStatusMsg({ text: error.message, type: 'error' });
    } finally {
      setUpdatingUserId('');
    }
  };

  if (!user && loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm font-bold text-[#888888]">載入中...</div>;
  }

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#EAE8E4] pb-6">
          <div className="flex items-center gap-3">
            <i className="ti ti-users text-2xl text-[#EA5B3C]"></i>
            <div>
              <h1 className="text-xl font-bold text-[#333333] sm:text-2xl">人員管理</h1>
              <p className="mt-1 text-xs text-[#888888]">管理系統成員的訂購者與管理者權限。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="rounded-full border border-[#EAE8E4] bg-white px-4 py-2 text-xs font-bold text-[#555555] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
          >
            返回管理總覽
          </button>
        </div>

        <section className="c-box space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="border-l-4 border-[#EA5B3C] pl-3 text-base font-bold text-[#333333] sm:text-lg">成員名冊與角色</h2>
              <p className="mt-2 pl-4 text-xs text-[#888888]">目前共 {members.length} 人：管理者 {adminCount} 人、訂購者 {userCount} 人。</p>
            </div>
          </div>

          {statusMsg.text && (
            <div className={`rounded-lg border px-4 py-3 text-xs font-bold ${
              statusMsg.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-600'
            }`}>
              {statusMsg.text}
            </div>
          )}

          <div className="relative">
            <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2 text-[#888888]"></i>
            <input
              type="search"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="搜尋姓名或 Email..."
              className="w-full rounded-xl border border-[#EAE8E4] bg-white py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-[#EA5B3C]"
            />
          </div>

          <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1 kaizen-scrollbar">
            {loading ? (
              <div className="py-12 text-center text-sm font-bold text-[#888888]">載入人員資料中...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] py-12 text-center text-sm font-bold text-[#888888]">找不到相符的成員。</div>
            ) : filteredMembers.map(member => {
              const isSelf = member.id === user?.id || member.id === user?.userId;
              return (
                <article key={member.id} className="flex items-center justify-between gap-4 rounded-xl border border-[#EAE8E4] bg-white p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-[#333333] sm:text-base">{getDisplayName(member.name)}</h3>
                      <span className="inline-flex rounded-full bg-[#FFF1ED] px-2 py-1 text-[10px] font-bold text-[#EA5B3C]">
                        {member.role === 'admin' ? '管理者' : '訂購者'}
                      </span>
                      {isSelf && <span className="rounded bg-[#FFF1ED] px-2 py-0.5 text-[10px] font-bold text-[#EA5B3C]">目前帳號</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-[#888888]">{member.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openMemberSettings(member)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                    aria-label={`設定 ${getDisplayName(member.name)}`}
                    title="人員設定"
                  >
                    <i className="ti ti-settings text-lg"></i>
                  </button>
                </article>
              );
            })}
          </div>

          <p className="text-[11px] leading-5 text-[#888888]">為避免失去後台存取權，目前登入的管理者不能在此將自己改為訂購者。</p>
        </section>
      </main>

      {selectedMember && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !updatingUserId) setSelectedMember(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-settings-title"
            className="flex h-[380px] max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#EAE8E4] px-5 py-4">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-[#EA5B3C]">人員設定</p>
                <h2 id="member-settings-title" className="mt-1 text-lg font-bold text-[#333333]">{getDisplayName(selectedMember.name)}</h2>
                <p className="mt-1 break-all text-xs text-[#888888]">{selectedMember.email}</p>
              </div>
              <button
                type="button"
                disabled={Boolean(updatingUserId)}
                onClick={() => setSelectedMember(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:opacity-50"
                aria-label="關閉人員設定"
              >
                <i className="ti ti-x text-xl"></i>
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5 kaizen-scrollbar">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3" role="radiogroup" aria-labelledby="member-role-label">
                <span id="member-role-label" className="shrink-0 text-sm font-bold text-[#333333]">角色設定</span>
                <div className="flex items-center gap-5">
                  {[
                    { value: 'user', label: '訂購者', description: '可點餐及查看個人紀錄。' },
                    { value: 'admin', label: '管理者', description: '可進入後台管理系統。' }
                  ].map(option => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="radio"
                        name="member-role"
                        value={option.value}
                        checked={draftRole === option.value}
                        disabled={selectedMember.id === user?.id || selectedMember.id === user?.userId || Boolean(updatingUserId)}
                        onChange={event => setDraftRole(event.target.value)}
                        className="h-4 w-4 shrink-0 accent-[#EA5B3C]"
                      />
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-sm font-bold text-[#333333]">{option.label}</span>
                        <span className="group relative inline-flex shrink-0">
                          <button
                            type="button"
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              setActiveRoleInfo(current => current === option.value ? '' : option.value);
                            }}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#D8D5CF] bg-white text-[10px] font-bold text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                            aria-label={`查看${option.label}角色說明`}
                            aria-expanded={activeRoleInfo === option.value}
                          >
                            i
                          </button>
                          <span
                            className={`pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max max-w-none -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-normal leading-5 text-[#555555] shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-opacity ${
                              activeRoleInfo === option.value ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                            role="tooltip"
                          >
                            {option.description}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {(selectedMember.id === user?.id || selectedMember.id === user?.userId) && (
                <p className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
                  目前登入的管理者不能修改自己的角色。
                </p>
              )}
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-[#EAE8E4] bg-white px-5 py-4 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
              <button
                type="button"
                disabled={Boolean(updatingUserId)}
                onClick={() => setSelectedMember(null)}
                className="rounded-xl border border-[#EAE8E4] bg-white py-3 text-sm font-bold text-[#555555] hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={Boolean(updatingUserId) || selectedMember.id === user?.id || selectedMember.id === user?.userId}
                onClick={handleRoleChange}
                className="rounded-xl bg-[#EA5B3C] py-3 text-sm font-bold text-white hover:bg-[#d94f33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updatingUserId ? '儲存中...' : '儲存'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
