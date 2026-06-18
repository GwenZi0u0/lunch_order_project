'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function AnnouncementsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data?.user) return null;
        setUser(data.user);
        return fetch('/api/announcement');
      })
      .then(res => res?.json())
      .then(data => {
        if (Array.isArray(data?.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (!user || loading) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入公告中...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-speakerphone text-2xl text-[#EA5B3C]"></i> 公告欄
          </h2>
        </div>

        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FFF3EF] text-[#EA5B3C] flex items-center justify-center shrink-0">
              <i className="ti ti-speakerphone text-xl"></i>
            </div>
            <div className="min-w-0 flex-1 space-y-5">
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
                        {item.content || '尚無內容'}
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
                  目前沒有公告。
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
