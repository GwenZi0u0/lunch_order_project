'use client';

import { useEffect, useState } from 'react';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinutesFromTime(time) {
  const [hours, minutes] = (time || '09:40').split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function notify(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `tsa-lunch-${title}`
  });

  setTimeout(() => notification.close(), 8000);
}

export default function NotificationCenter() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [permission, setPermission] = useState('unsupported');

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);

    fetch('/api/auth')
      .then(res => {
        if (res.ok) setIsAuthed(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthed || permission !== 'granted') return;

    const checkDeadlineReminder = async () => {
      try {
        const today = formatDate(new Date());
        const res = await fetch('/api/schedule', { cache: 'no-store' });
        if (!res.ok) return;

        const schedules = await res.json();
        const todaySchedule = schedules.find(item => item.date === today);
        if (!todaySchedule || !todaySchedule.isOpen || !todaySchedule.restaurant) return;

        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const deadlineMinutes = getMinutesFromTime(todaySchedule.orderDeadline);
        const reminderKey = `tsa-lunch-deadline-reminder-${todaySchedule.id}-${today}`;

        if (
          nowMinutes >= deadlineMinutes - 10
          && nowMinutes < deadlineMinutes
          && localStorage.getItem(reminderKey) !== 'sent'
        ) {
          notify(
            '午餐訂購提醒',
            `${todaySchedule.restaurant.name} 即將於 ${todaySchedule.orderDeadline} 截止訂餐，請記得送出餐點。`
          );
          localStorage.setItem(reminderKey, 'sent');
        }
      } catch {
        // Notification polling should stay silent.
      }
    };

    const checkBroadcast = async () => {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;

        const data = await res.json();
        const item = data.notification;
        if (!item?.id || !item.message) return;

        const notifiedKey = `tsa-lunch-broadcast-${item.id}`;
        if (localStorage.getItem(notifiedKey) === 'sent') return;

        notify(item.title || 'TSA Lunch 通知', item.message);
        localStorage.setItem(notifiedKey, 'sent');
      } catch {
        // Notification polling should stay silent.
      }
    };

    checkDeadlineReminder();
    checkBroadcast();

    const deadlineTimer = setInterval(checkDeadlineReminder, 60 * 1000);
    const broadcastTimer = setInterval(checkBroadcast, 20 * 1000);

    return () => {
      clearInterval(deadlineTimer);
      clearInterval(broadcastTimer);
    };
  }, [isAuthed, permission]);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  };

  if (!isAuthed || permission !== 'default') return null;

  return (
    <button
      type="button"
      onClick={requestPermission}
      className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-2 rounded-full border border-[#EAE8E4] bg-white px-4 py-2 text-xs font-bold text-[#333333] shadow-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
    >
      <i className="ti ti-bell"></i>
      啟用通知
    </button>
  );
}
