'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function parseCustomizationOptions(value) {
  if (Array.isArray(value)) {
    return value.map(option => String(option).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(option => String(option).trim()).filter(Boolean);
      }
    } catch {
      return value.split(/[\r\n,;|]+/).map(option => option.trim()).filter(Boolean);
    }
  }

  return [];
}

function formatItemNoteDisplay(note, menuItem) {
  const noteParts = String(note || '').split(';').map(part => part.trim()).filter(Boolean);
  const configuredOptions = parseCustomizationOptions(menuItem?.customizationOptions);
  const configuredSet = new Set(configuredOptions);
  const selectedSet = new Set(noteParts.filter(part => configuredSet.has(part)));
  const freeNoteParts = noteParts.filter(part => !configuredSet.has(part));

  return [
    ...configuredOptions.filter(option => selectedSet.has(option)),
    ...freeNoteParts
  ].join(' ');
}

function getWeeklyDates() {
  const dates = [];
  const now = new Date();
  const day = now.getDay();
  
  // Get Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  
  // Current week Mon-Fri
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `本週 ${['一', '二', '三', '四', '五'][i]}`,
      isNextWeek: false
    });
  }
  
  // Next week Mon-Fri
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  for (let i = 0; i < 5; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: `下週 ${['一', '二', '三', '四', '五'][i]}`,
      isNextWeek: true
    });
  }
  return dates;
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Copy failed');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  
  // Scheduling state
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [orderDeadline, setOrderDeadline] = useState('09:40');
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  
  // Billing action state
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [announcements, setAnnouncements] = useState([]);
  const [savingAnnouncementId, setSavingAnnouncementId] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('');
  const [announcementDrafts, setAnnouncementDrafts] = useState({});
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [copiedItemSummary, setCopiedItemSummary] = useState(false);
  const [copiedTodayOrders, setCopiedTodayOrders] = useState(false);
  const [todayItemsDialogOpen, setTodayItemsDialogOpen] = useState(false);
  const [todayOrdersDialogOpen, setTodayOrdersDialogOpen] = useState(false);
  const [messageFormats, setMessageFormats] = useState([]);
  const [messageFormatDialogOpen, setMessageFormatDialogOpen] = useState(false);
  const [messageFormatDraft, setMessageFormatDraft] = useState({ id: '', title: '', content: '' });
  const [messageFormatOriginal, setMessageFormatOriginal] = useState({ id: '', title: '', content: '' });
  const [discardMessageFormatDialogOpen, setDiscardMessageFormatDialogOpen] = useState(false);
  const [messageFormatToDelete, setMessageFormatToDelete] = useState(null);
  const [savingMessageFormats, setSavingMessageFormats] = useState(false);
  const [copiedMessageFormatId, setCopiedMessageFormatId] = useState('');
  const [messageFormatMessage, setMessageFormatMessage] = useState('');

  useEffect(() => {
    // Check authentication and role
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
            fetchRestaurants();
            fetchSchedules();
            fetchAnnouncement();
            fetchMessageFormats();
          }
        }
      })
      .catch(() => router.push('/login'));

    // Default select today
    const today = new Date();
    setSelectedDate(formatDate(today));
  }, []);

  const fetchRestaurants = () => {
    fetch('/api/restaurants?active=true')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRestaurants(data);
        }
      })
      .catch(err => console.error('無法載入餐廳:', err));
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

  const fetchAnnouncement = () => {
    fetch('/api/announcement')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.announcements)) {
          setAnnouncements(data.announcements);
        }
      })
      .catch(err => console.error('Failed to load announcement:', err));
  };

  const fetchMessageFormats = () => {
    fetch('/api/message-formats')
      .then(res => res.json())
      .then(data => {
        setMessageFormats(Array.isArray(data.messageFormats) ? data.messageFormats : []);
      })
      .catch(err => console.error('Failed to load message formats:', err));
  };

  const persistAnnouncements = async (nextAnnouncements, savingId, successMessage) => {
    setSavingAnnouncementId(savingId);
    setAnnouncementMessage('');

    try {
      const res = await fetch('/api/announcement', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcements: nextAnnouncements })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '公告儲存失敗');
      }

      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : nextAnnouncements);
      setAnnouncementMessage(successMessage);
      setTimeout(() => setAnnouncementMessage(''), 3000);
    } catch (err) {
      setAnnouncementMessage(err.message);
    } finally {
      setSavingAnnouncementId('');
    }
  };

  const getAnnouncementDraft = (item) => (
    announcementDrafts[item.id] || {
      title: item.title || '',
      content: item.content || '',
      pinned: Boolean(item.pinned)
    }
  );

  const isAnnouncementDirty = (item) => {
    const draft = getAnnouncementDraft(item);
    return draft.title !== (item.title || '')
      || draft.content !== (item.content || '')
      || Boolean(draft.pinned) !== Boolean(item.pinned);
  };

  const isLocalAnnouncement = (item) => item.id.startsWith('local-');

  const isAnnouncementDraftBlank = (draft) => (
    !draft.title.trim() && !draft.content.trim()
  );

  const discardAnnouncementEdit = (item, { silentBlank = false } = {}) => {
    const draft = getAnnouncementDraft(item);
    const isBlankLocalDraft = isLocalAnnouncement(item) && isAnnouncementDraftBlank(draft);
    const shouldConfirm = isAnnouncementDirty(item) && !(silentBlank && isBlankLocalDraft);

    if (shouldConfirm && !confirm('公告尚未儲存，確認要放棄此次修改嗎？')) {
      return false;
    }

    clearAnnouncementDraft(item.id);
    if (isLocalAnnouncement(item)) {
      setAnnouncements(prev => prev.filter(announcement => announcement.id !== item.id));
    }
    setEditingAnnouncementId('');
    return true;
  };

  const confirmDiscardActiveAnnouncementEdit = () => {
    if (!editingAnnouncementId) return true;
    const activeItem = announcements.find(item => item.id === editingAnnouncementId);
    if (!activeItem) {
      setEditingAnnouncementId('');
      return true;
    }
    return discardAnnouncementEdit(activeItem, { silentBlank: true });
  };

  const getAnnouncementsAfterConfirmDiscardActiveEdit = () => {
    if (!editingAnnouncementId) return announcements;
    const activeItem = announcements.find(item => item.id === editingAnnouncementId);

    if (!activeItem) {
      setEditingAnnouncementId('');
      return announcements;
    }

    if (!discardAnnouncementEdit(activeItem, { silentBlank: true })) {
      return null;
    }

    return isLocalAnnouncement(activeItem)
      ? announcements.filter(item => item.id !== activeItem.id)
      : announcements;
  };

  const handleAddAnnouncement = () => {
    if (!confirmDiscardActiveAnnouncementEdit()) return;

    const now = new Date().toISOString();
    const id = `local-${Date.now()}`;
    const draft = { title: '', content: '', pinned: false };

    setAnnouncements(prev => [
      {
        id,
        ...draft,
        updatedAt: now
      },
      ...prev
    ]);
    setAnnouncementDrafts(prev => ({ ...prev, [id]: draft }));
    setEditingAnnouncementId(id);
  };

  const handleStartEditAnnouncement = (item) => {
    if (editingAnnouncementId !== item.id && !confirmDiscardActiveAnnouncementEdit()) return;

    setAnnouncementDrafts(prev => ({
      ...prev,
      [item.id]: {
        title: item.title || '',
        content: item.content || '',
        pinned: Boolean(item.pinned)
      }
    }));
    setEditingAnnouncementId(item.id);
  };

  const handleAnnouncementDraftChange = (id, field, value) => {
    setAnnouncementDrafts(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { title: '', content: '', pinned: false }),
        [field]: value
      }
    }));
  };

  const clearAnnouncementDraft = (id) => {
    setAnnouncementDrafts(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleCancelAnnouncementEdit = (item) => {
    discardAnnouncementEdit(item, { silentBlank: true });
  };

  const handleSaveAnnouncementItem = (id) => {
    const target = announcements.find(item => item.id === id);
    if (!target || !isAnnouncementDirty(target)) return;

    const draft = getAnnouncementDraft(target);
    if (isAnnouncementDraftBlank(draft)) {
      if (isLocalAnnouncement(target)) {
        discardAnnouncementEdit(target, { silentBlank: true });
      }
      return;
    }

    const nextAnnouncements = announcements.map(item => (
      item.id === id
        ? {
          ...item,
          title: draft.title,
          content: draft.content,
          pinned: Boolean(draft.pinned),
          updatedAt: new Date().toISOString()
        }
        : item
    ));

    persistAnnouncements(nextAnnouncements, id, '公告已儲存。');
    clearAnnouncementDraft(id);
    setEditingAnnouncementId('');
  };

  const handleToggleAnnouncementPinned = (id) => {
    const sourceAnnouncements = getAnnouncementsAfterConfirmDiscardActiveEdit();
    if (!sourceAnnouncements) return;

    const nextAnnouncements = sourceAnnouncements.map(item => (
      item.id === id
        ? {
          ...item,
          pinned: !item.pinned,
          updatedAt: new Date().toISOString()
        }
        : item
    ));

    persistAnnouncements(nextAnnouncements, id, '公告已儲存。');
  };

  const handleDeleteAnnouncement = (id) => {
    const sourceAnnouncements = editingAnnouncementId && editingAnnouncementId !== id
      ? getAnnouncementsAfterConfirmDiscardActiveEdit()
      : announcements;

    if (!sourceAnnouncements) return;

    if (!confirm('確認要刪除此公告嗎？')) return;
    const nextAnnouncements = sourceAnnouncements.filter(item => item.id !== id);
    persistAnnouncements(nextAnnouncements, id, '公告已刪除。');
    clearAnnouncementDraft(id);
    if (editingAnnouncementId === id) setEditingAnnouncementId('');
  };

  const persistMessageFormats = async (nextFormats, successMessage) => {
    setSavingMessageFormats(true);
    setMessageFormatMessage('');

    try {
      const res = await fetch('/api/message-formats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageFormats: nextFormats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '訊息格式儲存失敗');

      setMessageFormats(Array.isArray(data.messageFormats) ? data.messageFormats : nextFormats);
      setMessageFormatMessage(successMessage);
      setTimeout(() => setMessageFormatMessage(''), 2500);
      return true;
    } catch (err) {
      setMessageFormatMessage(err.message);
      return false;
    } finally {
      setSavingMessageFormats(false);
    }
  };

  const openMessageFormatDialog = (format = null) => {
    const draft = format
      ? { id: format.id, title: format.title || '', content: format.content || '' }
      : { id: '', title: '', content: '' };
    setMessageFormatDraft(draft);
    setMessageFormatOriginal(draft);
    setMessageFormatMessage('');
    setMessageFormatDialogOpen(true);
  };

  const closeMessageFormatDialog = () => {
    setMessageFormatDialogOpen(false);
    setDiscardMessageFormatDialogOpen(false);
    setMessageFormatDraft({ id: '', title: '', content: '' });
    setMessageFormatOriginal({ id: '', title: '', content: '' });
  };

  const cancelMessageFormatEdit = () => {
    const hasChanges = JSON.stringify(messageFormatDraft) !== JSON.stringify(messageFormatOriginal);
    if (hasChanges) {
      setDiscardMessageFormatDialogOpen(true);
      return;
    }
    closeMessageFormatDialog();
  };

  const saveMessageFormat = async () => {
    if (!messageFormatDraft.title.trim() || !messageFormatDraft.content.trim()) {
      setMessageFormatMessage('請填寫主旨與內容。');
      return;
    }

    const now = new Date().toISOString();
    const savedFormat = {
      id: messageFormatDraft.id || `message-format-${Date.now()}`,
      title: messageFormatDraft.title.trim(),
      content: messageFormatDraft.content.trim(),
      updatedAt: now,
    };
    const nextFormats = messageFormatDraft.id
      ? messageFormats.map(format => format.id === messageFormatDraft.id ? savedFormat : format)
      : [savedFormat, ...messageFormats];
    const saved = await persistMessageFormats(nextFormats, '訊息格式已儲存。');
    if (saved) closeMessageFormatDialog();
  };

  const copyMessageFormat = async (format) => {
    try {
      await writeClipboardText(format.content);
      setCopiedMessageFormatId(format.id);
      setTimeout(() => setCopiedMessageFormatId(''), 1600);
    } catch (err) {
      setMessageFormatMessage('複製失敗，請再試一次。');
    }
  };

  const deleteMessageFormat = async () => {
    if (!messageFormatToDelete) return;
    const nextFormats = messageFormats.filter(format => format.id !== messageFormatToDelete.id);
    const deleted = await persistMessageFormats(nextFormats, '訊息格式已刪除。');
    if (deleted) setMessageFormatToDelete(null);
  };

  const activeSchedule = schedules.find(s => s.date === selectedDate);
  const todayDate = formatDate(new Date());
  const todaySchedule = schedules.find(s => s.date === todayDate);
  const weeklyDates = getWeeklyDates();

  // Update schedule selection inputs
  useEffect(() => {
    if (activeSchedule) {
      setSelectedRestaurantId(activeSchedule.restaurantId);
      setOrderDeadline(activeSchedule.orderDeadline || '09:40');
    } else {
      setSelectedRestaurantId('');
      setOrderDeadline('09:40');
    }
    setMessage({ text: '', type: '' });
  }, [selectedDate, activeSchedule]);

  const handleSaveSchedule = async () => {
    if (!selectedRestaurantId) {
      setMessage({ text: '請選擇一個餐廳！', type: 'error' });
      return;
    }

    setIsUpdatingSchedule(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          restaurantId: selectedRestaurantId,
          orderDeadline
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '排程儲存失敗');
      }

      setMessage({ text: '排程設定已成功儲存！', type: 'success' });
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  // Deliver and deduct balance API trigger
  const handleConfirmDelivery = async () => {
    if (!activeSchedule) return;
    
    // Count orders
    const orderCount = activeSchedule.userOrder ? 1 : (activeSchedule.orders?.length || 0);
    if (orderCount === 0) {
      alert('今天沒有任何訂餐訂單，不需進行點收扣款。');
      return;
    }

    if (!confirm(`您確定要確認「${selectedDate}」的餐點已送達並自動執行帳戶扣款嗎？\n此動作將自動扣除所有訂餐者的錢包餘額！`)) {
      return;
    }

    setIsProcessingDelivery(true);
    setMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/admin/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule.id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '點收失敗');
      }

      setMessage({ text: `點收扣款成功！${data.message}`, type: 'success' });
      fetchSchedules();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setIsProcessingDelivery(false);
    }
  };

  // Compile daily items ordered statistics
  const getOrderedItemsSummary = () => {
    if (!activeSchedule || !activeSchedule.orders) return [];
    
    const summary = {}; // { menuItemId: { name, qty, price } }
    
    // Loop through each active order
    activeSchedule.orders.forEach(order => {
      if (order.status === 'cancelled') return;
      order.orderItems.forEach(oi => {
        const menuItemId = oi.menuItemId;
        const name = oi.menuItem?.name || '未知餐點';
        const qty = oi.quantity;
        const price = oi.unitPrice;
        
        if (summary[menuItemId]) {
          summary[menuItemId].qty += qty;
        } else {
          summary[menuItemId] = { name, qty, price };
        }
      });
    });
    
    return Object.values(summary).sort((a, b) => b.qty - a.qty);
  };

  const itemSummaries = getOrderedItemsSummary();
  const totalQuantity = itemSummaries.reduce((sum, item) => sum + item.qty, 0);
  const totalOrderAmount = itemSummaries.reduce((sum, item) => sum + item.price * item.qty, 0);

  const todayOrders = todaySchedule?.orders?.filter(order => order.status !== 'cancelled') || [];
  const todayTotalAmount = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const todayItemSummary = todayOrders.reduce((summary, order) => {
    order.orderItems.forEach(item => {
      const name = item.menuItem?.name || '未命名品項';
      const note = formatItemNoteDisplay(item.note || order.note, item.menuItem);
      const summaryKey = `${item.menuItemId || name}__${note}`;
      if (!summary[summaryKey]) {
        summary[summaryKey] = { name, note, qty: 0, price: item.unitPrice, menuItem: item.menuItem, orders: [] };
      }
      summary[summaryKey].qty += item.quantity;
      if (!summary[summaryKey].orders.some(existingOrder => existingOrder.id === order.id)) {
        summary[summaryKey].orders.push(order);
      }
    });
    return summary;
  }, {});
  const todayItems = Object.values(todayItemSummary).sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name, 'zh-Hant');
    return (a.note || '').localeCompare(b.note || '', 'zh-Hant');
  });
  const todayDateObject = new Date(`${todayDate}T00:00:00`);
  const isTodayWeekend = todayDateObject.getDay() === 0 || todayDateObject.getDay() === 6;
  const isTodayHoliday = Boolean(todaySchedule && !todaySchedule.isOpen) || isTodayWeekend;
  const todayRestaurantLabel = todaySchedule?.restaurant?.name || (isTodayHoliday ? '休假' : '未排定');
  const formatTodayItemSummaryText = () => {
    if (todayItems.length === 0) {
      return '今日尚無訂餐內容。';
    }

    return todayItems.map(item => {
      const noteText = formatItemNoteDisplay(item.note);
      return `${item.name}${noteText ? `/${noteText}` : ''}*${item.qty}`;
    }).join('\n');
  };
  const copyTodayItemSummary = async () => {
    try {
      await writeClipboardText(formatTodayItemSummaryText());
      setCopiedItemSummary(true);
      setTimeout(() => setCopiedItemSummary(false), 1600);
    } catch (err) {
      console.error('Failed to copy item summary:', err);
    }
  };
  const getSeatArea = (order) => {
    const directArea = (order.seatArea || '').trim().toUpperCase();
    if (directArea === 'A' || directArea === 'B') return directArea;

    const searchableNote = [
      order.note,
      ...(order.orderItems || []).map(item => item.note)
    ].filter(Boolean).join(' ');

    if (/A\s*[\u5340\u533A]|\uFF21\s*[\u5340\u533A]/i.test(searchableNote)) return 'A';
    if (/B\s*[\u5340\u533A]|\uFF22\s*[\u5340\u533A]/i.test(searchableNote)) return 'B';
    return 'A';
  };
  const sortedTodayOrders = [...todayOrders].sort((a, b) => {
    const areaA = getSeatArea(a);
    const areaB = getSeatArea(b);
    if (areaA !== areaB) return areaA.localeCompare(areaB);
    return (a.orderNumber || '').localeCompare(b.orderNumber || '');
  });
  const todayOrdersBySeatArea = [
    {
      key: 'A',
      title: 'A \u5340',
      orders: sortedTodayOrders.filter(order => getSeatArea(order) === 'A')
    },
    {
      key: 'B',
      title: 'B \u5340',
      orders: sortedTodayOrders.filter(order => getSeatArea(order) === 'B')
    }
  ].filter(group => group.orders.length > 0);
  const displayUserName = (name) => (name || '未命名成員').replace(/\s*\(欠款警示\)\s*/g, '').trim();
  const getAreaOrderNumber = (groupKey, order) => {
    const rawSerial = parseInt((order.orderNumber || '').slice(-3), 10);
    const serial = order.orderNumberDisplay
      || (Number.isNaN(rawSerial) ? '--' : String(rawSerial).padStart(2, '0'));
    return `${groupKey}${serial}`;
  };
  const getTodayItemOrderNumbers = item => (item.orders || [])
    .map(order => getAreaOrderNumber(getSeatArea(order), order))
    .filter(number => !number.endsWith('--'))
    .sort((a, b) => {
      const areaCompare = a[0].localeCompare(b[0]);
      return areaCompare || Number(a.slice(1)) - Number(b.slice(1));
    });
  const formatTodayOrdersCopyText = () => {
    const areaSections = todayOrdersBySeatArea.map(group => (
      group.orders.flatMap(order => {
        const orderNumber = getAreaOrderNumber(group.key, order);
        const customerLabel = `${orderNumber} ${displayUserName(order.user?.name)}`;
        const itemLines = (order.orderItems || []).map(item => {
          const itemName = item.menuItem?.name || '未命名品項';
          const itemNote = formatItemNoteDisplay(item.note, item.menuItem);
          const quantityText = item.quantity > 1 ? ` *${item.quantity}` : '';
          return `${customerLabel} ${itemName}${itemNote ? `/${itemNote}` : ''}${quantityText}`;
        });

        if (itemLines.length === 0) return [customerLabel];
        return itemLines;
      })
    ));

    return areaSections.map(lines => lines.join('\n')).join('\n----\n');
  };
  const copyTodayOrders = async () => {
    try {
      await writeClipboardText(formatTodayOrdersCopyText());
      setCopiedTodayOrders(true);
      setTimeout(() => setCopiedTodayOrders(false), 1600);
    } catch (err) {
      console.error('Failed to copy today orders:', err);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入管理者權限中...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Header Title */}
        <div className="flex justify-between items-center border-b border-[#EAE8E4] pb-4">
          <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
            <i className="ti ti-chart-bar text-2xl text-[#EA5B3C]"></i> 訂單統計與公告
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/admin#announcement-editor')}
              className="text-xs font-bold bg-[#333333] text-white px-4 py-2 rounded-lg hover:bg-[#EA5B3C] transition-colors"
            >
              公告欄編輯
            </button>
          </div>
        </div>

        {/* Admin Home Overview */}
        <section id="order-stats-announcement" className="scroll-mt-24 space-y-6">
          <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-[#EAE8E4] pb-4">
              <div>
                <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">今日總覽</p>
                <h3 className="text-lg font-bold text-[#333333] mt-1">本日餐廳與訂餐結果</h3>
              </div>
              <div className="text-sm font-bold text-[#EA5B3C]">{todayDate}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">本日餐廳</p>
                <p className="text-base font-bold text-[#333333] truncate">
                  {todayRestaurantLabel}
                </p>
              </div>
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">今日訂購者</p>
                <p className="text-base font-bold text-[#333333]">{todayOrders.length} 人</p>
              </div>
              <div className="bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg p-4">
                <p className="text-xs text-[#888888] font-bold mb-1">訂單金額</p>
                <p className="text-base font-bold text-[#EA5B3C]">NT$ {todayTotalAmount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-[#333333] flex items-center gap-2">
                    <i className="ti ti-list-check text-[#EA5B3C]"></i> 品項總計
                  </h4>
                  <div className="flex items-center gap-2">
                    {copiedItemSummary && (
                      <span className="text-[11px] font-bold text-green-600">已複製</span>
                    )}
                    <button
                      type="button"
                      onClick={copyTodayItemSummary}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                      title="複製統計結果"
                      aria-label="複製品項統計結果"
                    >
                      <i className="ti ti-copy text-sm"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTodayItemsDialogOpen(true)}
                      disabled={todayItems.length === 0}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40"
                      title="展開"
                      aria-label="展開品項總計"
                    >
                      <i className="ti ti-arrows-maximize text-sm"></i>
                    </button>
                  </div>
                </div>
                <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2 kaizen-scrollbar">
                  {todayItems.length > 0 ? todayItems.map(item => (
                    <div key={`${item.name}-${item.note || 'no-note'}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#EAE8E4] px-3 py-2 text-xs">
                      <span className="min-w-0">
                        <span className="block font-bold text-[#333333] truncate">{item.name}</span>
                        {item.note && (
                          <span className="mt-1 block truncate text-[11px] text-[#888888]">備註：{formatItemNoteDisplay(item.note, item.menuItem)}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[#888888]">x {item.qty}</span>
                    </div>
                  )) : (
                    <div className="text-xs text-[#888888] bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg px-3 py-8 text-center">
                      今日尚無訂餐內容。
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="flex items-center justify-between gap-3 text-sm font-bold text-[#333333]">
                  <span className="flex items-center gap-2">
                    <i className="ti ti-users text-[#EA5B3C]"></i>
                    今日訂購者訂餐內容
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={copyTodayOrders}
                      disabled={todayOrders.length === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#EA5B3C] transition-all hover:border-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="複製今日訂購者訂單"
                      title="複製"
                    >
                      <i className={`ti ${copiedTodayOrders ? 'ti-check text-green-600' : 'ti-copy'}`}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTodayOrdersDialogOpen(true)}
                      disabled={todayOrders.length === 0}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="展開今日訂購者訂餐內容"
                      title="展開"
                    >
                      <i className="ti ti-arrows-maximize"></i>
                    </button>
                  </span>
                </h4>
                <div className="max-h-[240px] overflow-y-auto pr-1 space-y-3 kaizen-scrollbar">
                  {todayOrders.length > 0 ? todayOrdersBySeatArea.map(group => (
                    <div key={group.key} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-3 py-2 text-xs font-bold text-[#333333]">
                        <span>{group.title}</span>
                        <span className="text-[#888888]">{group.orders.length} {'\u4EBA'}</span>
                      </div>
                      <div className="space-y-3">
                        {group.orders.map(order => (
                    <div key={order.id} className="flex gap-3 rounded-lg border border-[#EAE8E4] p-3 text-xs">
                      <div className="flex w-12 shrink-0 items-start justify-center">
                        <span className="inline-flex min-w-9 items-center justify-center rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-2 py-1 text-[11px] font-bold text-[#EA5B3C]">
                          {getAreaOrderNumber(group.key, order)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-[#333333] truncate">{displayUserName(order.user?.name)}</span>
                          <span className="font-bold text-[#EA5B3C] shrink-0">NT$ {order.totalAmount}</span>
                        </div>
                        <div className="text-[#888888] leading-relaxed">
                          {order.orderItems.map(item => (
                            <div key={item.id} className="flex justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate">{item.menuItem?.name || '未命名品項'}</span>
                                {item.note && (
                                  <span className="mt-0.5 block truncate text-[11px] text-[#888888]">備註：{formatItemNoteDisplay(item.note, item.menuItem)}</span>
                                )}
                              </span>
                              <span className="shrink-0">x {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        {order.note && <p className="text-[#888888] border-t border-[#EAE8E4] pt-2">備註：{order.note}</p>}
                      </div>
                    </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="text-xs text-[#888888] bg-[#F9F8F5] border border-[#EAE8E4] rounded-lg px-3 py-8 text-center">
                      今日尚無訂購者。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-[#EAE8E4] pb-4">
              <div>
                <p className="text-xs font-bold text-[#888888] tracking-widest">管理者常用內容</p>
                <h3 className="mt-1 text-lg font-bold text-[#333333]">訊息格式</h3>
              </div>
              <button
                type="button"
                onClick={() => openMessageFormatDialog()}
                className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#EA5B3C] text-white transition-colors hover:bg-[#333333]"
                aria-label="新增訊息格式"
                title="新增訊息格式"
              >
                <i className="ti ti-plus text-sm"></i>
              </button>
            </div>

            {messageFormatMessage && (
              <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-3 py-2 text-xs font-bold text-[#666666]">
                {messageFormatMessage}
              </div>
            )}

            <div className="space-y-3">
              {messageFormats.length > 0 ? messageFormats.map(format => (
                <div key={format.id} className="rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="min-w-0 flex-1 break-words text-base font-bold text-[#333333]">{format.title}</h4>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyMessageFormat(format)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                        aria-label={`複製 ${format.title}`}
                        title="複製"
                      >
                        <i className={`ti ${copiedMessageFormatId === format.id ? 'ti-check text-green-600' : 'ti-copy'}`}></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => openMessageFormatDialog(format)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                        aria-label={`編輯 ${format.title}`}
                        title="編輯"
                      >
                        <i className="ti ti-pencil"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageFormatToDelete(format)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 transition-all hover:bg-red-50"
                        aria-label={`刪除 ${format.title}`}
                        title="刪除"
                      >
                        <i className="ti ti-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-[#D6D1CA] bg-[#F9F8F5] px-4 py-10 text-center text-xs text-[#888888]">
                  尚未建立訊息格式，請點擊右上角新增。
                </div>
              )}
            </div>
          </div>

          <div id="announcement-editor" className="scroll-mt-24 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex flex-row items-end justify-between gap-3 border-b border-[#EAE8E4] pb-4">
              <div>
                <p className="text-xs font-bold text-[#888888] tracking-widest uppercase">訂購者首頁管理</p>
                <h3 className="text-lg font-bold text-[#333333] mt-1">公告欄編輯</h3>
              </div>
              <button
                type="button"
                onClick={handleAddAnnouncement}
                className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#EA5B3C] text-white transition-colors hover:bg-[#333333]"
                aria-label="新增公告"
                title="新增公告"
              >
                <i className="ti ti-plus text-sm"></i>
              </button>
            </div>

            {announcementMessage && (
              <div className="p-3 text-xs rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-1.5">
                <i className="ti ti-info-circle"></i>
                {announcementMessage}
              </div>
            )}

            <div className="space-y-4">
              {announcements.length > 0 ? announcements.map(item => {
                const draft = getAnnouncementDraft(item);
                const isEditing = editingAnnouncementId === item.id;
                const isDirty = isAnnouncementDirty(item);

                return (
                  <div key={item.id} className="border border-[#EAE8E4] rounded-xl bg-[#F9F8F5] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      {item.pinned && (
                        <span className="pt-2 text-xs font-bold uppercase tracking-widest text-[#888888]">
                          釘選公告
                        </span>
                      )}
                      {isEditing ? (
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => handleSaveAnnouncementItem(item.id)}
                            disabled={savingAnnouncementId === item.id || !isDirty}
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all disabled:cursor-not-allowed ${
                              isDirty
                                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300'
                                : 'border-[#EAE8E4] bg-white text-[#D6D1CA] opacity-60'
                            }`}
                            title="儲存公告"
                            aria-label="儲存公告"
                          >
                            <i className={savingAnnouncementId === item.id ? 'ti ti-loader animate-spin text-base' : 'ti ti-check text-base'}></i>
                          </button>
                          <button
                            onClick={() => handleCancelAnnouncementEdit(item)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#333333] hover:text-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="取消編輯"
                            aria-label="取消編輯"
                          >
                            <i className="ti ti-x text-base"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => handleToggleAnnouncementPinned(item.id)}
                            disabled={savingAnnouncementId === item.id}
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              item.pinned
                                ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C] hover:bg-[#FFE7DE]'
                                : 'border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                            }`}
                            title={item.pinned ? '取消釘選' : '釘選公告'}
                            aria-label={item.pinned ? '取消釘選' : '釘選公告'}
                          >
                            <i className="ti ti-pin text-base"></i>
                          </button>
                          <button
                            onClick={() => handleStartEditAnnouncement(item)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="編輯公告"
                            aria-label="編輯公告"
                          >
                            <i className="ti ti-pencil text-base"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteAnnouncement(item.id)}
                            disabled={savingAnnouncementId === item.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="刪除公告"
                            aria-label="刪除公告"
                          >
                            <i className="ti ti-trash text-base"></i>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) => handleAnnouncementDraftChange(item.id, 'title', e.target.value)}
                          className="w-full text-sm px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white font-bold"
                          placeholder="請輸入公告標題"
                        />
                        <textarea
                          value={draft.content}
                          onChange={(e) => handleAnnouncementDraftChange(item.id, 'content', e.target.value)}
                          rows={6}
                          className="w-full resize-none text-sm leading-6 px-4 py-3 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white"
                          placeholder="請輸入公告內容"
                        />
                      </>
                    ) : (
                      <article className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-base font-bold text-[#333333] break-words">
                            {item.title || '未命名公告'}
                          </h4>
                        </div>
                        <div className="text-sm text-[#555555] leading-7 whitespace-pre-wrap break-words">
                          {item.content || '此公告尚無內容。'}
                        </div>
                      </article>
                    )}

                    {item.updatedAt && (
                      <p className="text-[11px] text-[#888888] text-right">
                        最後更新：{new Date(item.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-10 text-xs text-[#888888] border border-dashed border-[#D6D1CA] rounded-xl bg-[#F9F8F5]">
                  目前尚無公告，請點擊「新增公告」建立第一則公告。
                </div>
              )}
            </div>
          </div>
        </section>


      </main>

      {todayItemsDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center"
          onClick={() => setTodayItemsDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-items-dialog-title"
            className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#888888]">{todayDate}</p>
                <h3 id="today-items-dialog-title" className="mt-1 flex items-center gap-2 text-lg font-bold text-[#333333]">
                  <i className="ti ti-list-check text-[#EA5B3C]"></i>
                  品項總計
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTodayItemsDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                aria-label="關閉品項總計"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>

            <div className="overflow-y-auto p-5 kaizen-scrollbar sm:p-6">
              <div className="divide-y divide-[#EAE8E4]">
                {todayItems.map(item => {
                  const orderNumbers = getTodayItemOrderNumbers(item);
                  return (
                    <div key={`${item.name}-${item.note || 'no-note'}`} className="py-3 text-sm leading-6">
                      <span className="font-bold text-[#333333]">{item.name}</span>
                      {item.note && <span className="text-[#888888]">/{item.note}</span>}
                      <span className="ml-1 font-bold text-[#EA5B3C]">*{item.qty}</span>
                      <span className="ml-2 text-xs font-bold text-[#888888]">
                        [編號:{orderNumbers.join('、')}]
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {todayOrdersDialogOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center"
          onClick={() => setTodayOrdersDialogOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-orders-dialog-title"
            className="flex max-h-[88vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold tracking-widest text-[#888888]">{todayDate}</p>
                <h3 id="today-orders-dialog-title" className="mt-1 flex items-center gap-2 text-lg font-bold text-[#333333]">
                  <i className="ti ti-users text-[#EA5B3C]"></i>
                  今日訂購者訂餐內容
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTodayOrdersDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                aria-label="關閉今日訂購者訂餐內容"
              >
                <i className="ti ti-x text-lg"></i>
              </button>
            </div>

            <div className="overflow-y-auto p-5 kaizen-scrollbar sm:p-6">
              {todayOrdersBySeatArea.map((group, groupIndex) => (
                <section
                  key={group.key}
                  className={groupIndex > 0 ? 'mt-4 border-t-2 border-dashed border-[#D6D1CA] pt-4' : ''}
                >
                  <div className="divide-y divide-[#EAE8E4]">
                    {group.orders.map(order => (
                      <div key={order.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1 py-3 text-sm leading-6">
                        <span className="shrink-0 font-bold text-[#EA5B3C]">
                          {getAreaOrderNumber(group.key, order)}
                        </span>
                        <span className="shrink-0 font-bold text-[#333333]">
                          {displayUserName(order.user?.name)}
                        </span>
                        <span className="min-w-0 text-[#555555]">
                          {(order.orderItems || []).map((item, itemIndex) => (
                            <span key={item.id}>
                              {itemIndex > 0 && <span className="text-[#B0AAA2]">／</span>}
                              <span>{item.menuItem?.name || '未命名餐點'}</span>
                              {item.quantity > 1 && (
                                <span className="ml-0.5 font-bold text-[#EA5B3C]">*{item.quantity}</span>
                              )}
                              {item.note && (
                                <span className="text-[#888888]">／備註：{formatItemNoteDisplay(item.note, item.menuItem)}</span>
                              )}
                            </span>
                          ))}
                          {order.note && (
                            <span className="text-[#888888]">／訂單備註：{order.note}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {messageFormatDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-format-dialog-title"
            className="w-full max-w-[600px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#EAE8E4] px-6 py-4">
              <h3 id="message-format-dialog-title" className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <i className="ti ti-message-2 text-[#EA5B3C]"></i>
                {messageFormatDraft.id ? '編輯訊息格式' : '新增訊息格式'}
              </h3>
              <button
                type="button"
                onClick={cancelMessageFormatEdit}
                disabled={savingMessageFormats}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#888888] transition-all hover:bg-[#F9F8F5] hover:text-[#333333] disabled:opacity-40"
                aria-label="關閉訊息格式視窗"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>

            <div className="space-y-5 p-6">
              {messageFormatMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  {messageFormatMessage}
                </div>
              )}
              <label className="block space-y-2">
                <span className="text-xs font-bold text-[#666666]">主旨：</span>
                <input
                  type="text"
                  value={messageFormatDraft.title}
                  onChange={(event) => setMessageFormatDraft(prev => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-lg border border-[#EAE8E4] bg-white px-4 py-3 text-sm font-bold text-[#333333] focus:border-[#EA5B3C] focus:outline-none"
                  placeholder="請輸入訊息主旨"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-bold text-[#666666]">內容：</span>
                <textarea
                  value={messageFormatDraft.content}
                  onChange={(event) => setMessageFormatDraft(prev => ({ ...prev, content: event.target.value }))}
                  rows={8}
                  className="w-full resize-y rounded-lg border border-[#EAE8E4] bg-white px-4 py-3 text-sm leading-7 text-[#333333] focus:border-[#EA5B3C] focus:outline-none"
                  placeholder="請輸入訊息內容"
                />
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-[#EAE8E4] pt-4">
                <button
                  type="button"
                  onClick={cancelMessageFormatEdit}
                  disabled={savingMessageFormats}
                  className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2.5 text-xs font-bold text-[#333333] transition-all hover:border-[#333333] disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveMessageFormat}
                  disabled={savingMessageFormats}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#EA5B3C] px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className={`ti ${savingMessageFormats ? 'ti-loader-2 animate-spin' : 'ti-check'}`}></i>
                  {savingMessageFormats ? '儲存中...' : '儲存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {discardMessageFormatDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-message-format-title"
            className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
          >
            <div className="border-b border-[#EAE8E4] px-6 py-4">
              <h3 id="discard-message-format-title" className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <i className="ti ti-alert-triangle text-[#EA5B3C]"></i>
                放棄內容變更？
              </h3>
            </div>
            <div className="space-y-5 p-6">
              <p className="text-sm leading-7 text-[#666666]">
                主旨或內容已修改，確定要放棄此次內容變更嗎？
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDiscardMessageFormatDialogOpen(false)}
                  className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2.5 text-xs font-bold text-[#333333] transition-all hover:border-[#333333]"
                >
                  繼續編輯
                </button>
                <button
                  type="button"
                  onClick={closeMessageFormatDialog}
                  className="rounded-lg bg-[#EA5B3C] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#333333]"
                >
                  放棄變更
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {messageFormatToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-message-format-title"
            className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
          >
            <div className="border-b border-[#EAE8E4] px-6 py-4">
              <h3 id="delete-message-format-title" className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <i className="ti ti-trash text-red-600"></i>
                刪除訊息格式？
              </h3>
            </div>
            <div className="space-y-5 p-6">
              <p className="text-sm leading-7 text-[#666666]">
                確定要刪除「{messageFormatToDelete.title}」嗎？
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMessageFormatToDelete(null)}
                  disabled={savingMessageFormats}
                  className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2.5 text-xs font-bold text-[#333333] transition-all hover:border-[#333333] disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={deleteMessageFormat}
                  disabled={savingMessageFormats}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#333333] disabled:opacity-60"
                >
                  {savingMessageFormats ? '刪除中...' : '確認刪除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
