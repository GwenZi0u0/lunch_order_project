'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { canAccessAdminPage } from '@/lib/adminPermissions';

export default function SchedulePlaceholderPage({ title, icon, description }) {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth')
      .then(response => {
        if (!response.ok) {
          router.push('/login');
          return null;
        }
        return response.json();
      })
      .then(data => {
        if (!data) return;
        if (!canAccessAdminPage(data.user, 'schedule')) {
          router.push('/portal');
          return;
        }
        setUser(data.user);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#F9F8F5]">
        <div className="flex items-center gap-3 text-sm font-bold text-[#888888]">
          <i className="ti ti-loader text-xl text-[#EA5B3C] animate-spin"></i>
          載入管理者權限中...
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-[1200px] flex-1 space-y-8 px-6 py-10">
        <div className="border-b border-[#EAE8E4] pb-4">
          <h1 className="flex items-center gap-2 text-xl font-bold text-[#333333]">
            <i className={`${icon} text-2xl text-[#EA5B3C]`}></i>
            {title}
          </h1>
        </div>

        <section className="rounded-2xl border border-[#EAE8E4] bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF3EF] text-[#EA5B3C]">
            <i className={`${icon} text-2xl`}></i>
          </div>
          <h2 className="mt-4 text-base font-bold text-[#333333]">{title}頁面已建立</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#666666]">{description}</p>
          <div className="mx-auto mt-5 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-800">
            目前尚未連接獨立排程資料；此頁不會讀寫午餐排程，避免不同排程互相覆蓋。
          </div>
        </section>
      </main>
    </>
  );
}
