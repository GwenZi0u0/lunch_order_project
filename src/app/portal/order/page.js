'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

const DEFAULT_CUSTOMIZATION_OPTIONS = ['\u98ef\u5c11', '\u63db\u83dc', '\u63db\u83dc+$20'];
const MIN_AVAILABLE_BALANCE = -200;

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

  return DEFAULT_CUSTOMIZATION_OPTIONS;
}

function splitExistingItemNote(menuItem, note) {
  const options = parseCustomizationOptions(menuItem?.customizationOptions);
  const selectedOptions = options.filter(option => (note || '').includes(option));
  const cleanedNote = selectedOptions.reduce((current, option) => {
    return current.split(option).join(' ');
  }, note || '').replace(/[;,\s]+/g, ' ').trim();

  return { selectedOptions, note: cleanedNote };
}

function getCustomizationExtraAmount(value) {
  const matches = String(value || '').matchAll(/\+\s*(?:NT\$|\$)?\s*(\d+)/gi);
  return Array.from(matches).reduce((sum, match) => sum + (parseInt(match[1], 10) || 0), 0);
}

function getMenuCategory(item) {
  return String(item?.category || '餐盒').trim() || '餐盒';
}

function getMenuCategoryPriority(category) {
  if (category.includes('餐盒')) return 0;
  if (category.includes('主食')) return 1;
  if (category.includes('單點')) return 2;
  if (category.includes('飲料')) return 3;
  if (category.includes('湯')) return 4;
  return 5;
}

function getMainDishPriority(itemName) {
  const name = String(itemName || '');
  if (/雞|鴨|鵝/.test(name)) return 0;
  if (/豬|松阪|排骨/.test(name)) return 1;
  if (/牛/.test(name)) return 2;
  if (/魚|蝦|蟹|透抽|魷魚|花枝|干貝|蛤|蚵|貝/.test(name)) return 3;
  if (/蔬|素|菜/.test(name)) return 4;
  return 5;
}

function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function getWeeklyDates() {
  const dates = [];
  const now = new Date();
  const day = now.getDay();
  const weekdayLabels = ['\u9031\u4e00', '\u9031\u4e8c', '\u9031\u4e09', '\u9031\u56db', '\u9031\u4e94', '\u9031\u516d', '\u9031\u65e5'];
  
  // Get Monday of current week
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  
  // Current week Mon-Sun
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: weekdayLabels[i],
      isWeekend: i >= 5,
      isNextWeek: false
    });
  }
  
  // Next week Mon-Sun
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    dates.push({
      dateStr: formatDate(d),
      label: weekdayLabels[i],
      isWeekend: i >= 5,
      isNextWeek: true
    });
  }
  return dates;
}

function getDefaultDateForWeek(weekTab) {
  const dates = getWeeklyDates();
  return weekTab === 'next'
    ? dates.find(d => d.isNextWeek)?.dateStr || formatDate(new Date())
    : formatDate(new Date());
}

function getSeatAreaFromOrder(order) {
  if (order?.seatArea) return order.seatArea;
  const match = (order?.note || '').trim().match(/^([AB])區(?:\s|$|[;；,，、])/i);
  return match ? match[1].toUpperCase() : 'A';
}

function getOrderDisplayNumber(order) {
  const orderNumber = order?.orderNumberDisplay || '-';
  const seatArea = getSeatAreaFromOrder(order);
  return seatArea && orderNumber !== '-' ? `${seatArea}${orderNumber}` : orderNumber;
}

function getDisplayOrderNote(order) {
  return (order?.note || '').replace(/^([AB])區\s*[;；,，、]?\s*/i, '').trim();
}

function formatItemNoteDisplay(note) {
  return String(note || '').replace(/\s*;\s*/g, ' ').trim();
}

function getFreeShippingThreshold(note) {
  const match = String(note || '').match(/([\d,]+)\s*(?:元)?\s*(?:免運|免外送費)/);
  return match ? Number(match[1].replace(/,/g, '')) || 0 : 0;
}

function MarkdownPreview({ content }) {
  const renderInline = text => String(text || '').split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>
  ));

  return String(content || '').split(/\r?\n/).map((line, index) => {
    if (!line.trim()) return <div key={index} className="h-2" />;
    if (line.startsWith('### ')) return <h5 key={index} className="text-sm font-bold text-[#333333]">{renderInline(line.slice(4))}</h5>;
    if (line.startsWith('## ')) return <h4 key={index} className="text-base font-bold text-[#333333]">{renderInline(line.slice(3))}</h4>;
    if (line.startsWith('# ')) return <h3 key={index} className="text-lg font-bold text-[#333333]">{renderInline(line.slice(2))}</h3>;
    if (/^[-*]\s+/.test(line)) return <div key={index} className="flex gap-2"><span>•</span><span>{renderInline(line.replace(/^[-*]\s+/, ''))}</span></div>;
    return <p key={index}>{renderInline(line)}</p>;
  });
}

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeWeekTab, setActiveWeekTab] = useState('current'); // 'current' or 'next'
  const [allowNextWeekMenu, setAllowNextWeekMenu] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Order state
  const [cartItems, setCartItems] = useState([]);
  const [editingMenuItemId, setEditingMenuItemId] = useState('');
  const [editingMenuItemDraft, setEditingMenuItemDraft] = useState({ quantity: 0, note: '', options: [] });
  const [orderNote, setOrderNote] = useState('');
  const [seatArea, setSeatArea] = useState('');
  const [useSavedOrderNote, setUseSavedOrderNote] = useState(false);
  const [saveOrderPreference, setSaveOrderPreference] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [isCumulativeTipOpen, setIsCumulativeTipOpen] = useState(false);
  const [isOrderNoteTipOpen, setIsOrderNoteTipOpen] = useState(false);
  const [isRestaurantNoteTipOpen, setIsRestaurantNoteTipOpen] = useState(false);
  const [isOrderSummaryVisible, setIsOrderSummaryVisible] = useState(false);
  const [activeMenuCategory, setActiveMenuCategory] = useState('');
  const [isMenuImageOpen, setIsMenuImageOpen] = useState(false);
  const [activeRestaurantId, setActiveRestaurantId] = useState('');
  
  // Current system date/time check
  const [currentDateTime, setCurrentDateTime] = useState({ dateStr: '', timeStr: '' });
  
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
        }
      })
      .catch(() => router.push('/login'));
      
    // Get current Taipei/system date & time for deadline checking
    const timer = setInterval(updateTime, 1000);
    updateTime();
    
    // Default selection
    const searchParams = new URLSearchParams(window.location.search);
    const weekTarget = searchParams.get('week');
    const dateTarget = searchParams.get('date');
    setIsPreviewMode(searchParams.get('preview') === '1');
    if (weekTarget === 'next') {
      setSelectedDate(/^\d{4}-\d{2}-\d{2}$/.test(dateTarget || '') ? dateTarget : getDefaultDateForWeek('next'));
      setActiveWeekTab('next');
    } else {
      setSelectedDate(/^\d{4}-\d{2}-\d{2}$/.test(dateTarget || '') ? dateTarget : getDefaultDateForWeek('current'));
      setActiveWeekTab('current');
    }

    fetchSchedules();
    fetchOrderSettings();

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isCumulativeTipOpen && !isOrderNoteTipOpen && !isRestaurantNoteTipOpen) return;

    const handlePointerDown = (event) => {
      if (event.target.closest('[data-cumulative-tip]')) return;
      if (event.target.closest('[data-order-note-tip]')) return;
      if (event.target.closest('[data-restaurant-note-tip]')) return;
      setIsCumulativeTipOpen(false);
      setIsOrderNoteTipOpen(false);
      setIsRestaurantNoteTipOpen(false);
    };

    const handleScroll = () => {
      setIsCumulativeTipOpen(false);
      setIsOrderNoteTipOpen(false);
      setIsRestaurantNoteTipOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isCumulativeTipOpen, isOrderNoteTipOpen, isRestaurantNoteTipOpen]);

  const updateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setCurrentDateTime({
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hours}:${minutes}`
    });
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

  const fetchOrderSettings = () => {
    fetch('/api/order-settings')
      .then(res => res.json())
      .then(data => {
        if (typeof data.allowNextWeekMenu === 'boolean') {
          setAllowNextWeekMenu(data.allowNextWeekMenu);
        }
      })
      .catch(err => console.error('Failed to load order settings:', err));
  };

  const refreshUser = () => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data?.user) setUser(data.user);
      });
  };

  const removeSeatAreaFromNote = (value) => (value || '').replace(/(^|\s)(A區|B區)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();

  // Find schedule details for selected date
  const activeSchedule = schedules.find(s => s.date === selectedDate);
  const restaurantConfigs = activeSchedule?.restaurantConfigs?.length
    ? activeSchedule.restaurantConfigs
    : activeSchedule?.restaurant
      ? [{
          restaurantId: activeSchedule.restaurant.id,
          orderDeadlineDate: activeSchedule.orderDeadlineDate || activeSchedule.date,
          orderDeadline: activeSchedule.orderDeadline || '09:40',
          restaurant: activeSchedule.restaurant
        }]
      : [];
  const activeRestaurantConfig = restaurantConfigs.find(config => config.restaurantId === activeRestaurantId)
    || restaurantConfigs[0]
    || null;
  const activeRestaurant = activeRestaurantConfig?.restaurant || null;
  const availableMenuCategories = Array.from(new Set(
    (activeRestaurant?.menuItems || []).map(getMenuCategory)
  ));
  const savedMenuCategoryOrder = Array.isArray(activeRestaurant?.categoryOrder)
    ? activeRestaurant.categoryOrder.filter(category => availableMenuCategories.includes(category))
    : [];
  const menuCategories = [
    ...savedMenuCategoryOrder,
    ...availableMenuCategories
      .filter(category => !savedMenuCategoryOrder.includes(category))
      .sort((a, b) => {
        const priorityDifference = getMenuCategoryPriority(a) - getMenuCategoryPriority(b);
        return priorityDifference || a.localeCompare(b, 'zh-Hant');
      })
  ];
  const selectedMenuCategory = menuCategories.includes(activeMenuCategory)
    ? activeMenuCategory
    : menuCategories[0] || '';
  const visibleMenuItems = (activeRestaurant?.menuItems || [])
    .filter(item => getMenuCategory(item) === selectedMenuCategory)
    .sort((a, b) => {
      const mainDishDifference = getMainDishPriority(a.name) - getMainDishPriority(b.name);
      if (mainDishDifference) return mainDishDifference;
      return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
    });
  const todayDate = currentDateTime.dateStr || formatDate(new Date());
  const todaySchedule = schedules.find(s => s.date === todayDate);
  const todayOrder = todaySchedule?.userOrder || null;
  const weeklyDates = getWeeklyDates();
  const selectedOrderDateLabel = weeklyDates.find(d => d.dateStr === selectedDate)?.label || selectedDate;

  const handleWeekTabChange = (weekTab) => {
    if (weekTab === 'next' && !allowNextWeekMenu) return;
    setActiveWeekTab(weekTab);
    setSelectedDate(getDefaultDateForWeek(weekTab));
  };

  useEffect(() => {
    if (!allowNextWeekMenu && activeWeekTab === 'next') {
      setActiveWeekTab('current');
      setSelectedDate(getDefaultDateForWeek('current'));
    }
  }, [allowNextWeekMenu, activeWeekTab]);

  useEffect(() => {
    setActiveRestaurantId(restaurantConfigs[0]?.restaurantId || '');
  }, [selectedDate, activeSchedule?.id]);

  useEffect(() => {
    setActiveMenuCategory('');
    setIsMenuImageOpen(false);
  }, [activeRestaurant?.id]);

  useEffect(() => {
    if (!useSavedOrderNote || !user) return;
    const defaultSeatArea = user.defaultSeatArea || '';
    setOrderNote(removeSeatAreaFromNote(user.defaultOrderNote || ''));
    setSeatArea(defaultSeatArea);
  }, [useSavedOrderNote, user]);

  const resetOrderDraft = (schedule = activeSchedule) => {
    if (!schedule) {
      setCartItems([]);
      setEditingMenuItemId('');
      setEditingMenuItemDraft({ quantity: 0, note: '', options: [] });
      setOrderNote('');
      setSeatArea('A');
      setUseSavedOrderNote(false);
      setSaveOrderPreference(false);
      return;
    }

    const userOrderSeatArea = schedule.userOrder?.seatArea || 'A';
    const restoredCartItems = [];

    if (schedule.userOrder) {
      schedule.userOrder.items.forEach(item => {
        const menuItem = (schedule.restaurantConfigs?.length
          ? schedule.restaurantConfigs.flatMap(config => config.restaurant?.menuItems || [])
          : schedule.restaurant?.menuItems || []).find(mi => mi.id === item.menuItemId);
        const parsedNote = splitExistingItemNote(menuItem, item.note || '');
        const normalizedNote = normalizeOrderText(item.note);
        const key = `${item.menuItemId}::${normalizedNote}`;
        const matchingItem = restoredCartItems.find(cartItem => cartItem.key === key);
        if (matchingItem) {
          matchingItem.quantity += item.quantity;
        } else {
          restoredCartItems.push({
            key,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            note: parsedNote.note,
            options: parsedNote.selectedOptions
          });
        }
      });
    }

    setOrderNote(removeSeatAreaFromNote(schedule.userOrder?.note || ''));
    setSeatArea(userOrderSeatArea);
    setUseSavedOrderNote(false);
    setSaveOrderPreference(false);
    setCartItems(restoredCartItems);
    setEditingMenuItemId('');
    setEditingMenuItemDraft({ quantity: 0, note: '', options: [] });
  };

  const handleCancelDraftModification = () => {
    resetOrderDraft();
    setOrderError('');
    setOrderSuccess('');
  };
  
  // Setup order input when selected schedule changes
  useEffect(() => {
    resetOrderDraft(activeSchedule);
    setOrderError('');
    setOrderSuccess('');
  }, [selectedDate, activeSchedule]);

  const getMenuItemById = (menuItemId) => restaurantConfigs
    .flatMap(config => config.restaurant?.menuItems || [])
    .find(item => item.id === menuItemId);
  const getRestaurantForMenuItem = (menuItemId) => restaurantConfigs
    .find(config => config.restaurant?.menuItems?.some(item => item.id === menuItemId))?.restaurant || null;

  const sortSelectedOptions = (menuItemId, selectedOptions = []) => {
    const menuItem = getMenuItemById(menuItemId);
    const configuredOptions = parseCustomizationOptions(menuItem?.customizationOptions);
    const selectedSet = new Set(selectedOptions);
    return configuredOptions.filter(option => selectedSet.has(option));
  };

  const composeCartItemNote = (cartItem) => {
    const selectedOptions = sortSelectedOptions(cartItem.menuItemId, cartItem.options);
    const freeNote = normalizeOrderText(cartItem.note);
    return [...selectedOptions, freeNote].filter(Boolean).join('; ');
  };

  const getCartItemExtraAmount = (cartItem) => {
    return (cartItem.options || []).reduce((sum, option) => {
      return sum + getCustomizationExtraAmount(option);
    }, 0);
  };

  const getCartItemUnitPrice = (cartItem) => {
    const menuItem = getMenuItemById(cartItem.menuItemId);
    return (menuItem?.price || 0) + getCartItemExtraAmount(cartItem);
  };

  const openMenuItemDialog = (item) => {
    if (isClosed()) return;
    setEditingMenuItemId(item.id);
    setEditingMenuItemDraft({
      quantity: 1,
      note: '',
      options: []
    });
  };

  const closeMenuItemDialog = () => {
    setEditingMenuItemId('');
    setEditingMenuItemDraft({ quantity: 0, note: '', options: [] });
  };

  const handleDialogQtyChange = (delta) => {
    setEditingMenuItemDraft(prev => ({
      ...prev,
      quantity: Math.max(0, (prev.quantity || 0) + delta)
    }));
  };

  const handleCustomOptionToggle = (option) => {
    setEditingMenuItemDraft(prev => {
      const current = prev.options || [];
      const next = current.includes(option)
        ? current.filter(item => item !== option)
        : [...current, option];

      return { ...prev, options: next };
    });
  };

  const applyMenuItemDialog = () => {
    if (!editingMenuItem) return;

    const options = sortSelectedOptions(editingMenuItem.id, editingMenuItemDraft.options);
    const note = normalizeOrderText(editingMenuItemDraft.note);
    const composedNote = [...options, note].filter(Boolean).join('; ');
    const key = `${editingMenuItem.id}::${composedNote}`;

    setCartItems(prev => {
      const matchingItem = prev.find(item => item.key === key);
      if (matchingItem) {
        return prev.map(item => item.key === key
          ? { ...item, quantity: item.quantity + editingMenuItemDraft.quantity }
          : item);
      }

      return [...prev, {
        key,
        menuItemId: editingMenuItem.id,
        quantity: editingMenuItemDraft.quantity,
        note,
        options
      }];
    });
    closeMenuItemDialog();
  };

  const removeOrderItem = (cartItemKey) => {
    if (isClosed() || isSubmitting) return;
    setCartItems(prev => prev.filter(item => item.key !== cartItemKey));
  };

  const updateOrderItemQuantity = (cartItemKey, delta) => {
    if (isClosed() || isSubmitting) return;
    setCartItems(prev => prev
      .map(item => item.key === cartItemKey
        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
        : item)
      .filter(item => item.quantity > 0));
  };

  const handleSeatAreaToggle = (area) => {
    if (isClosed() || isSubmitting) return;
    setSeatArea(area);
  };

  const scrollToOrderSummary = () => {
    document.getElementById('order-summary')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  // Calculate order closed status for each restaurant.
  const isRestaurantConfigClosed = (config = activeRestaurantConfig) => {
    if (!activeSchedule) return true;
    if (isPreviewMode) return false;
    if (!activeSchedule.isOpen) return true;
    
    const { dateStr: currentDate, timeStr: currentTime } = currentDateTime;
    const deadlineDate = config?.orderDeadlineDate || activeSchedule.orderDeadlineDate || activeSchedule.date;
    if (currentDate > deadlineDate) return true;
    if (currentDate === deadlineDate) {
      const deadline = config?.orderDeadline || activeSchedule.orderDeadline || '09:40';
      return currentTime >= deadline;
    }
    return false;
  };
  const isClosed = () => isRestaurantConfigClosed(activeRestaurantConfig);
  const cartHasClosedRestaurant = cartItems.some(cartItem => {
    const config = restaurantConfigs.find(item => item.restaurant?.menuItems?.some(menuItem => menuItem.id === cartItem.menuItemId));
    return isRestaurantConfigClosed(config);
  });

  const calculateTotal = () => {
    if (!activeSchedule) return 0;
    return cartItems.reduce((sum, item) => sum + getCartItemUnitPrice(item) * item.quantity, 0);
  };

  const normalizeOrderText = (value) => (value || '').trim();

  const getCurrentOrderItems = () => cartItems
    .filter(item => item.quantity > 0)
    .map(item => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: composeCartItemNote(item)
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId) || a.note.localeCompare(b.note));

  const hasOrderChanges = () => {
    if (!activeSchedule?.userOrder) return true;
    if (normalizeOrderText(orderNote) !== normalizeOrderText(removeSeatAreaFromNote(activeSchedule.userOrder.note))) return true;
    if ((seatArea || '') !== getSeatAreaFromOrder(activeSchedule.userOrder)) return true;
    if (saveOrderPreference) return true;

    const currentItems = getCurrentOrderItems();
    const originalItems = activeSchedule.userOrder.items
      .map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        note: normalizeOrderText(item.note)
      }))
      .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId) || a.note.localeCompare(b.note));

    return JSON.stringify(currentItems) !== JSON.stringify(originalItems);
  };

  const shouldShowModifyShortcut = Boolean(
    activeSchedule?.userOrder
      && activeRestaurant
      && !isClosed()
      && hasOrderChanges()
      && !isOrderSummaryVisible
  );
  const shouldShowConfirmOrderShortcut = Boolean(
    activeRestaurant
      && !activeSchedule?.userOrder
      && !isClosed()
      && calculateTotal() > 0
      && !isOrderSummaryVisible
  );

  useEffect(() => {
    const orderSummary = document.getElementById('order-summary');
    if (!orderSummary) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsOrderSummaryVisible(entry.isIntersecting),
      { threshold: 0.15 }
    );

    observer.observe(orderSummary);
    return () => observer.disconnect();
  }, [selectedDate, activeSchedule?.id]);

  useEffect(() => {
    document.body.classList.toggle('has-bottom-order-shortcut', shouldShowModifyShortcut || shouldShowConfirmOrderShortcut);

    return () => {
      document.body.classList.remove('has-bottom-order-shortcut');
    };
  }, [shouldShowModifyShortcut, shouldShowConfirmOrderShortcut]);

  const handlePlaceOrder = async () => {
    if (isPreviewMode) return;
    if (cartHasClosedRestaurant) {
      setOrderError('訂購清單中包含已截止訂購的餐廳，請先移除該餐廳餐點。');
      return;
    }
    
    if (activeSchedule.userOrder && !hasOrderChanges()) return;

    if (projectedAvailableBalance < MIN_AVAILABLE_BALANCE) {
      setOrderError('餘額不足無法點餐，請向管理員儲值。');
      return;
    }

    const items = getCurrentOrderItems();
    const submittedItems = items.map(item => {
      const menuItem = getMenuItemById(item.menuItemId);
      return {
        ...item,
        name: menuItem?.name || '餐點',
        unitPrice: menuItem
          ? menuItem.price + getCustomizationExtraAmount(item.note)
          : 0
      };
    });

    if (items.length === 0) {
      setOrderError('請至少選擇一項餐點！');
      return;
    }

    if (!seatArea) {
      setOrderError('請選擇座位區！');
      return;
    }

    setIsSubmitting(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: activeSchedule.id,
          items,
          note: removeSeatAreaFromNote(orderNote),
          seatArea,
          saveOrderPreference
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '點餐失敗');
      }

      setOrderSuccess('訂單提交成功！');
      setSubmittedOrder({
        number: getOrderDisplayNumber(data.order),
        items: submittedItems,
        totalAmount: data.order.totalAmount ?? calculateTotal()
      });
      fetchSchedules();
      refreshUser();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (isPreviewMode || isClosed() || !activeSchedule.userOrder) return;

    if (!confirm('您確定要取消此筆午餐訂單嗎？')) return;

    setIsSubmitting(true);
    setOrderError('');
    setOrderSuccess('');

    try {
      const res = await fetch(`/api/orders?orderId=${activeSchedule.userOrder.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '取消失敗');
      }

      setOrderSuccess('訂單已取消！');
      setCartItems([]);
      setOrderNote('');
      setSeatArea('A');
      setUseSavedOrderNote(false);
      setSaveOrderPreference(false);
      fetchSchedules();
      refreshUser();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center bg-[#F9F8F5]">
        <div className="flex flex-col items-center gap-3">
          <i className="ti ti-loader text-4xl text-[#EA5B3C] animate-spin"></i>
          <span className="text-sm text-[#888888] font-bold">載入個人資料中...</span>
        </div>
      </div>
    );
  }

  // Wallet styling based on balance logic
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
    } else {
      return {
        cardBorder: 'border-l-4 border-l-red-600 border-[#EAE8E4] bg-red-[0.005]',
        valueColor: 'text-red-600',
        label: '帳戶欠款'
      };
    }
  };

  const wallet = getWalletStyles();
  const walletAmount = `${user.balance < 0 ? '－' : ''}NT$ ${Math.abs(user.balance)}`;
  const pendingHoldAmount = user.pendingHoldAmount || 0;
  const availableBalance = user.availableBalance ?? (user.balance - pendingHoldAmount);
  const currentOrderHoldAmount = activeSchedule?.userOrder?.totalAmount || 0;
  const projectedHoldAmount = Math.max(0, pendingHoldAmount - currentOrderHoldAmount + calculateTotal());
  const projectedAvailableBalance = user.balance - projectedHoldAmount;
  const isBelowAvailableLimit = projectedAvailableBalance < MIN_AVAILABLE_BALANCE;
  const editingMenuItem = getMenuItemById(editingMenuItemId);
  const editingMenuItemQty = editingMenuItem ? editingMenuItemDraft.quantity || 0 : 0;
  const editingMenuItemOptions = editingMenuItem ? parseCustomizationOptions(editingMenuItem.customizationOptions) : [];
  const currentCumulativeAmount = activeSchedule?.stats?.totalAmount || 0;
  const freeShippingThreshold = getFreeShippingThreshold(activeRestaurant?.note);
  const cumulativeProgress = freeShippingThreshold
    ? Math.min(100, Math.round((currentCumulativeAmount / freeShippingThreshold) * 100))
    : 0;

  return (
    <>
      <Navbar user={user} interactionDisabled={isPreviewMode} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-6 py-10 space-y-10">
        {isPreviewMode && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-[#EA5B3C]/30 bg-[#FFF3EF] px-4 py-3 text-xs font-bold text-[#EA5B3C]">
            <i className="ti ti-eye text-lg"></i>
            預覽模式｜可操作畫面，無法送出訂單
          </div>
        )}
        
        {/* Wallet Banner */}
        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Wallet Info */}
            <div className={`self-start p-5 bg-[#F9F8F5] rounded-xl border ${wallet.cardBorder} flex flex-col justify-start`}>
              <span className="text-xs font-bold text-[#888888] tracking-widest uppercase mb-2">{wallet.label}</span>
              <div className="mb-2 space-y-1">
                <span className={`text-3xl font-bold ${wallet.valueColor}`}>
                  {walletAmount}
                </span>
                {pendingHoldAmount > 0 && (
                  <span className="block text-xs font-bold text-[#888888]">
                    可用金額 {availableBalance < 0 ? '－' : ''}NT$ {Math.abs(availableBalance)}
                  </span>
                )}
              </div>
            </div>

            {/* Today Order */}
            <div className="md:col-span-2 space-y-4 md:pl-6 border-t md:border-t-0 md:border-l border-[#EAE8E4] pt-6 md:pt-0">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold text-base text-[#333333] flex items-center gap-2">
                  <i className="ti ti-shopping-bag text-lg text-[#EA5B3C]"></i> 今日訂購餐點
                </h3>
                <span className="text-xs font-bold text-[#888888]">{todayDate}</span>
              </div>

              {todayOrder ? (
                <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] overflow-hidden">
                  <div className="bg-white px-4 py-3">
                    <div className="space-y-1">
                      <span className="block text-[11px] font-bold tracking-widest text-[#888888]">
                        {'\u4eca\u65e5\u8a02\u55ae\u7de8\u865f'}
                      </span>
                      <span className="inline-flex min-w-12 items-center justify-center rounded-full border border-[#EA5B3C]/20 bg-[#FFF3EF] px-3 py-1.5 text-sm font-bold text-[#EA5B3C]">
                        {getOrderDisplayNumber(todayOrder)}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[180px] overflow-y-auto bg-white px-4 py-3 kaizen-scrollbar">
                    {todayOrder.items.map(item => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#EAE8E4] py-2 text-xs last:border-b-0">
                        <span className="font-bold text-[#333333] truncate">
                          {item.name}
                          {item.note && (
                            <span className="block truncate text-[11px] font-bold text-[#EA5B3C]">
                              備註: {formatItemNoteDisplay(item.note)}
                            </span>
                          )}
                        </span>
                        <span className="rounded-full bg-[#F9F8F5] px-2 py-0.5 font-bold text-[#888888] shrink-0">x {item.quantity}</span>
                        <span className="font-bold text-[#EA5B3C] shrink-0">NT$ {item.unitPrice * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#888888]">今日訂單金額</span>
                    <span className="text-xl font-bold text-[#EA5B3C]">NT$ {todayOrder.totalAmount}</span>
                  </div>

                  {getDisplayOrderNote(todayOrder) && (
                    <p className="border-t border-[#EAE8E4] bg-white px-4 py-3 text-xs leading-5 text-[#888888]">
                      備註：{getDisplayOrderNote(todayOrder)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-8 text-center text-xs text-[#888888]">
                  今日尚未訂購餐點。
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Announcement Board moved to /portal/announcements.
        <section className="bg-white rounded-xl border border-[#EAE8E4] p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FFF3EF] text-[#EA5B3C] flex items-center justify-center shrink-0">
              <i className="ti ti-speakerphone text-xl"></i>
            </div>
            <div className="min-w-0 flex-1 space-y-5">
              <h2 className="text-lg font-bold text-[#333333]">公告欄</h2>

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
                        {item.content || '此公告尚無內容。'}
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
                  目前尚無公告。
                </div>
              )}
            </div>
          </div>
        </section>

        */}

        {/* Date Selector Tabs */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-[#333333] flex items-center gap-2">
              <i className="ti ti-calendar-event text-2xl text-[#EA5B3C]"></i> 週供餐日期選擇
            </h2>
            
            {/* Week Tab Switcher */}
            <div className="inline-flex bg-[#F9F8F5] border border-[#EAE8E4] p-1 rounded-xl">
              <button
                onClick={() => handleWeekTabChange('current')}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all ${
                  activeWeekTab === 'current' ? 'bg-[#EA5B3C] text-white' : 'text-[#888888] hover:text-[#333333]'
                }`}
              >
                本週菜單
              </button>
              <button
                onClick={() => handleWeekTabChange('next')}
                disabled={!allowNextWeekMenu}
                className={`px-5 py-2 text-xs font-bold rounded-md transition-all disabled:cursor-not-allowed disabled:opacity-45 ${
                  activeWeekTab === 'next'
                    ? 'bg-[#EA5B3C] text-white'
                    : allowNextWeekMenu
                      ? 'text-[#888888] hover:text-[#333333]'
                      : 'text-[#888888]'
                }`}
              >
                下週菜單
              </button>
            </div>
          </div>

          {/* Monday-Sunday Daily Buttons */}
          <div className="grid grid-cols-7 gap-1 md:gap-3">
            {weeklyDates
              .filter(d => (activeWeekTab === 'current' ? !d.isNextWeek : d.isNextWeek))
              .map(d => {
                const sched = schedules.find(s => s.date === d.dateStr);
                const hasOrdered = sched?.userOrder;
                const isSelected = selectedDate === d.dateStr;
                const isHolidayCard = sched ? !sched.isOpen && !sched.deliveredAt : d.isWeekend;
                
                return (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedDate(d.dateStr)}
                    className={`min-h-12 p-2 md:min-h-0 md:p-4 rounded-lg md:rounded-xl border text-center md:text-left transition-all relative ${
                      isSelected
                        ? 'border-[#EA5B3C] bg-white ring-1 ring-[#EA5B3C]'
                        : 'border-[#EAE8E4] bg-white hover:border-[#D6D1CA]'
                    }`}
                  >
                    <div className="text-[11px] md:text-xs text-[#888888] md:mb-1 font-bold leading-tight">{d.label}</div>
                    <div className="hidden md:block text-sm font-bold text-[#333333] truncate">
                      {isHolidayCard ? '\u4f11\u5047' : (sched?.restaurantConfigs?.length
                        ? sched.restaurantConfigs.map(config => config.restaurant?.name).filter(Boolean).join('、')
                        : sched?.restaurant ? sched.restaurant.name : '（未排定）')}
                    </div>
                    {/* Status Badge */}
                    {isHolidayCard && (
                      <span className="mt-0.5 block text-center text-[8px] font-bold leading-none text-[#888888] md:absolute md:top-2 md:right-2 md:mt-0 md:inline-flex md:px-1 md:rounded md:border md:border-[#EAE8E4] md:bg-[#F2EFEA]">
                        {'\u5047\u671f'}
                      </span>
                    )}
                    {!isHolidayCard && hasOrdered && (
                      <>
                        <span className="mt-0.5 block text-center text-[9px] font-bold leading-none text-green-600 md:absolute md:top-2 md:right-2 md:mt-0 md:inline-flex md:rounded md:bg-green-500 md:px-1.5 md:py-0.5 md:text-white">
                          已訂
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
          </div>
        </section>

        {/* Menu and Ordering Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Menu Selection (Col-span 2) */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">
            <div className="c-box">
              {restaurantConfigs.length > 1 && (
                <div className="mb-6 space-y-3 border-b border-[#EAE8E4] pb-5">
                  <div className="text-xs font-bold text-[#888888]">選擇餐廳</div>
                  <div className="flex flex-wrap gap-2">
                    {restaurantConfigs.map(config => (
                      <button
                        key={config.restaurantId}
                        type="button"
                        onClick={() => setActiveRestaurantId(config.restaurantId)}
                        aria-expanded={config.restaurantId === activeRestaurantConfig?.restaurantId}
                        className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                          config.restaurantId === activeRestaurantConfig?.restaurantId
                            ? 'border-[#EA5B3C] bg-[#EA5B3C] text-white'
                            : 'border-[#EAE8E4] bg-white text-[#555555] hover:border-[#EA5B3C]'
                        }`}
                      >
                        {config.restaurant?.name || '餐廳'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {activeRestaurant ? (
                <div className="space-y-8">
                  <div className="border-b border-[#EAE8E4] pb-5">
                    <div className="text-xs font-bold tracking-widest text-[#888888]">餐廳公告</div>
                    <div className="mt-2 min-h-5 space-y-1.5 text-xs leading-6 text-[#555555]">
                      <MarkdownPreview content={activeSchedule.dailyAnnouncement} />
                    </div>
                  </div>

                  {/* Restaurant Details */}
                  <div className="border-b border-[#EAE8E4] pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex w-full items-start justify-between gap-4 md:w-auto">
                      <div>
                        <h3 className="text-2xl font-bold text-[#333333]">{activeRestaurant.name}</h3>
                        {activeRestaurant.phone && (
                          <p className="text-xs text-[#888888] mt-1">
                            <i className="ti ti-phone"></i> 聯絡電話: {activeRestaurant.phone}
                          </p>
                        )}
                      </div>
                      {activeRestaurant.menuImageUrl && (
                        <button
                          type="button"
                          onClick={() => setIsMenuImageOpen(true)}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-lg text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                          aria-label="查看菜單圖片"
                          title="查看菜單圖片"
                        >
                          <i className="ti ti-photo"></i>
                        </button>
                      )}
                    </div>

                    <div className="grid w-full grid-cols-1 gap-4 text-left md:w-[20rem]">
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#888888] block">截止訂購時間</span>
                        <span className="mt-1 flex items-center gap-1 text-sm font-bold text-[#EA5B3C]">
                          <i className="ti ti-alarm"></i>
                          {activeRestaurantConfig?.orderDeadlineDate && activeRestaurantConfig.orderDeadlineDate !== activeSchedule.date
                            ? `${activeRestaurantConfig.orderDeadlineDate} ${activeRestaurantConfig.orderDeadline}`
                            : activeRestaurantConfig?.orderDeadline || activeSchedule.orderDeadline} 前
                        </span>
                      </div>
                      <div className="min-w-0 text-left">
                        <span className="relative inline-flex items-center gap-1 text-xs font-bold text-[#888888]" data-cumulative-tip>
                          目前累計金額
                          <button
                            type="button"
                            onClick={() => setIsCumulativeTipOpen(prev => !prev)}
                            onMouseEnter={() => setIsCumulativeTipOpen(true)}
                            onFocus={() => setIsCumulativeTipOpen(true)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#D6D1CA] bg-white text-[10px] font-bold text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                            aria-label="目前累計金額說明"
                          >
                            i
                          </button>
                          {isCumulativeTipOpen && (
                            <span className="absolute right-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-[#EAE8E4] bg-white p-3 text-left text-[11px] font-bold leading-relaxed text-[#555555] shadow-lg md:w-56">
                              這是大家目前已送出的訂單總額，可用來一起確認是否接近餐廳免運門檻。
                            </span>
                          )}
                        </span>
                        <div className="mt-1 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs font-bold">
                            <span className="text-[#EA5B3C]">NT$ {currentCumulativeAmount}</span>
                            <span className="relative flex min-w-0 items-center justify-end gap-1 text-[10px] text-[#888888]" data-restaurant-note-tip>
                              {freeShippingThreshold > 0 && <span className="shrink-0">目標 NT$ {freeShippingThreshold}</span>}
                              {activeRestaurant.note && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setIsRestaurantNoteTipOpen(open => !open)}
                                    onMouseEnter={() => setIsRestaurantNoteTipOpen(true)}
                                    onFocus={() => setIsRestaurantNoteTipOpen(true)}
                                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#D6D1CA] bg-white text-[10px] font-bold text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                                    aria-label="查看餐廳備註"
                                  >
                                    i
                                  </button>
                                  {isRestaurantNoteTipOpen && (
                                    <span className="absolute right-0 top-full z-20 mt-2 w-[min(16rem,calc(100vw-3rem))] rounded-lg border border-[#EAE8E4] bg-white p-3 text-left text-[11px] font-bold leading-relaxed text-[#555555] shadow-lg">
                                      {activeRestaurant.note}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                          <div className="relative h-2 w-full rounded-full bg-[#EAE8E4]" role="progressbar" aria-label="目前累計金額進度" aria-valuemin="0" aria-valuemax={freeShippingThreshold || 100} aria-valuenow={currentCumulativeAmount}>
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${cumulativeProgress >= 100 ? 'bg-green-500' : 'bg-[#EA5B3C]'}`}
                              style={{ width: `${cumulativeProgress}%` }}
                            />
                            {cumulativeProgress > 0 && (
                              <span
                                className={`absolute top-1/2 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs shadow-sm transition-all duration-500 ${cumulativeProgress >= 100 ? 'text-green-600' : 'text-[#EA5B3C]'}`}
                                style={{ left: `${cumulativeProgress}%` }}
                                aria-hidden="true"
                              >
                                <i className="ti ti-paw"></i>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Warning Banner if Closed */}
                  {isClosed() && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
                      <i className="ti ti-alert-triangle text-lg"></i>
                      本供餐日訂餐已截止或管理員已點收，無法再進行修改。
                    </div>
                  )}

                  {/* Menu Items List */}
                  <div className="space-y-6">
                    <h4 className="font-bold text-base text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                      美味餐點選擇
                    </h4>

                    <div className="border-b border-[#EAE8E4]">
                      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0">
                        {menuCategories.map(category => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setActiveMenuCategory(category)}
                            className={`relative shrink-0 px-4 pb-3 pt-1 text-xs font-bold transition-colors ${
                              selectedMenuCategory === category
                                ? 'text-[#EA5B3C]'
                                : 'text-[#888888] hover:text-[#333333]'
                            }`}
                            aria-pressed={selectedMenuCategory === category}
                          >
                            {category}
                            {selectedMenuCategory === category && (
                              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#EA5B3C]"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {visibleMenuItems.map(item => {
                        const cartQuantity = cartItems
                          .filter(cartItem => cartItem.menuItemId === item.id)
                          .reduce((total, cartItem) => total + cartItem.quantity, 0);
                        return (
                          <button
                            type="button"
                            key={item.id}
                            disabled={isClosed()}
                            onClick={() => openMenuItemDialog(item)}
                            className="relative flex w-full items-center justify-between rounded-xl border border-[#EAE8E4] p-4 text-left transition-all hover:border-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cartQuantity > 0 && (
                              <span className="absolute left-0 top-0 ml-[2px] mt-[2px] inline-flex h-7 min-w-7 -translate-x-1/3 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#EA5B3C] px-1.5 text-xs font-bold text-white shadow-sm">
                                {cartQuantity}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#333333]">{item.name}</div>
                              <div className="mt-1 text-xs font-bold text-[#EA5B3C]">
                                NT$ {item.price}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center">
                              <i className="ti ti-chevron-right text-lg text-[#C9C3BB]"></i>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 space-y-4">
                  <i className="ti ti-soup-off text-5xl text-[#D6D1CA]"></i>
                  <h3 className="font-bold text-[#333333] text-base">此日期未安排供餐</h3>
                  <p className="text-xs text-[#888888]">請選擇其他有餐廳排定的供餐日進行訂購。</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Checkout Summary (Col-span 1) */}
          <div className="order-1 lg:order-2 space-y-6">
            <div id="order-summary" className="scroll-mt-24 bg-white border border-[#EAE8E4] rounded-xl shadow-sm p-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:flex lg:flex-col">
              <h3 className="font-bold text-base text-[#333333] border-b border-[#EAE8E4] pb-3">
                訂購清單
              </h3>

              <div className="min-h-0 space-y-6 pt-6 lg:flex-1 lg:overflow-y-auto lg:pr-1 no-scrollbar">
                {orderError && (
                  <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-600 rounded-lg flex items-center gap-1.5">
                    <i className="ti ti-alert-circle"></i> {orderError}
                  </div>
                )}

                {orderSuccess && (
                  <div className="p-3 text-xs bg-green-50 border border-green-200 text-green-600 rounded-lg flex items-center gap-1.5">
                    <i className="ti ti-discount-check"></i> {orderSuccess}
                  </div>
                )}

                {/* Selected items receipt */}
                {activeRestaurant ? (
                  <>
                  {calculateTotal() > 0 && (
                    <div className="text-xs font-bold text-[#888888]">
                      {selectedOrderDateLabel}餐點內容
                    </div>
                  )}

                  <div className="space-y-4">
                    {cartItems.map(cartItem => {
                      const item = getMenuItemById(cartItem.menuItemId);
                      if (!item || cartItem.quantity === 0) return null;
                      const composedNote = composeCartItemNote(cartItem);
                      const itemNoteParts = composedNote
                        .split(';')
                        .map(note => note.trim())
                        .filter(Boolean);
                      const itemActionLabel = composedNote ? `${item.name}（${formatItemNoteDisplay(composedNote)}）` : item.name;
                      const itemRestaurant = getRestaurantForMenuItem(cartItem.menuItemId);
                      return (
                        <div key={cartItem.key} className="space-y-2 rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-3 text-xs">
                          <div className="text-[10px] font-bold text-[#EA5B3C]">{itemRestaurant?.name || '餐廳'}</div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#333333] font-bold truncate">{item.name}</span>
                            <div className="flex shrink-0 items-center gap-1 rounded-full border border-[#EAE8E4] bg-white px-1 py-0.5">
                              <button
                                type="button"
                                disabled={isClosed() || isSubmitting}
                                onClick={() => updateOrderItemQuantity(cartItem.key, -1)}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[#888888] transition-all hover:bg-[#F9F8F5] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#888888]"
                                aria-label={`減少 ${itemActionLabel} 數量`}
                              >
                                <i className="ti ti-minus text-xs"></i>
                              </button>
                              <span className="min-w-4 text-center text-xs font-bold text-[#333333]">{cartItem.quantity}</span>
                              <button
                                type="button"
                                disabled={isClosed() || isSubmitting}
                                onClick={() => updateOrderItemQuantity(cartItem.key, 1)}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[#888888] transition-all hover:bg-[#F9F8F5] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#888888]"
                                aria-label={`增加 ${itemActionLabel} 數量`}
                              >
                                <i className="ti ti-plus text-xs"></i>
                              </button>
                            </div>
                            <span className="text-[#333333] font-bold shrink-0">NT$ {getCartItemUnitPrice(cartItem) * cartItem.quantity}</span>
                            <button
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => removeOrderItem(cartItem.key)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#EAE8E4] disabled:hover:text-[#888888]"
                              aria-label={`刪除 ${itemActionLabel}`}
                              title="刪除餐點"
                            >
                              <i className="ti ti-trash text-sm"></i>
                            </button>
                          </div>
                          {itemNoteParts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {itemNoteParts.map(note => (
                                <span key={note} className="rounded-full border border-[#EAE8E4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#888888]">
                                  {note}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {calculateTotal() === 0 && (
                      <div className="text-center py-6 text-xs text-[#888888]">
                        尚未選擇任何餐點
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#EAE8E4] pt-4 space-y-3">
                    {/* Custom Note input */}
                    <div className="hidden">
                      <label className="text-xs font-bold text-[#888888]">餐點備註說明 (如: 不辣、不要蔥)</label>
                      <input
                        type="text"
                        disabled={isClosed() || isSubmitting}
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="請輸入特殊備註..."
                        className="w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] disabled:bg-[#F9F8F5]"
                      />
                    </div>

                    {/* Order Status details */}
                    {activeSchedule.userOrder && (
                      <div className="bg-[#F9F8F5] border border-[#EAE8E4] p-3 rounded-lg flex flex-col gap-1 text-[11px]">
                        {activeSchedule.userOrder.orderNumberDisplay && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">{'\u8a02\u55ae\u7de8\u865f'}</span>
                            <span className="font-bold text-[#EA5B3C]">{getOrderDisplayNumber(activeSchedule.userOrder)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-[#888888]">訂單狀態:</span>
                          <span className="font-bold text-green-600">已成立 ({activeSchedule.userOrder.status})</span>
                        </div>
                        {activeSchedule.userOrder.seatArea && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">座位區</span>
                            <span className="font-bold text-[#333333]">{activeSchedule.userOrder.seatArea}區</span>
                          </div>
                        )}
                        {activeSchedule.userOrder.note && (
                          <div className="flex justify-between gap-3">
                            <span className="text-[#888888] shrink-0">整筆備註</span>
                            <span className="font-bold text-[#333333] text-right">{activeSchedule.userOrder.note}</span>
                          </div>
                        )}
                        {activeSchedule.userOrder.chargedAt && (
                          <div className="flex justify-between">
                            <span className="text-[#888888]">扣款時間:</span>
                            <span className="text-[#333333]">
                              {new Date(activeSchedule.userOrder.chargedAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-3">
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          {['A', 'B'].map(area => (
                            <button
                              key={area}
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => handleSeatAreaToggle(area)}
                              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                seatArea === area
                                  ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C]'
                                  : 'border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                              }`}
                            >
                              {area}區
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="relative inline-flex items-center gap-1 text-xs font-bold text-[#888888]" data-order-note-tip>
                            <label>備註</label>
                            <button
                              type="button"
                              onClick={() => setIsOrderNoteTipOpen(prev => !prev)}
                              onMouseEnter={() => setIsOrderNoteTipOpen(true)}
                              onFocus={() => setIsOrderNoteTipOpen(true)}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#D6D1CA] bg-white text-[10px] font-bold text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                              aria-label="備註欄說明"
                            >
                              i
                            </button>
                            {isOrderNoteTipOpen && (
                              <span className="absolute left-0 top-full z-20 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-[#EAE8E4] bg-white p-3 text-left text-[11px] font-bold leading-relaxed text-[#555555] shadow-lg">
                                可填寫其他無法在餐點選項中選到的備註。
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] font-bold">
                            <button
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => setUseSavedOrderNote(prev => !prev)}
                              className={`rounded px-1.5 py-0.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                useSavedOrderNote
                                  ? 'bg-[#FFF3EF] text-[#EA5B3C] underline decoration-[#EA5B3C] underline-offset-4'
                                  : 'text-[#888888] hover:bg-white hover:text-[#EA5B3C]'
                              }`}
                            >
                              常用備註
                            </button>
                            <span className="text-[#C9C3BB]">|</span>
                            <button
                              type="button"
                              disabled={isClosed() || isSubmitting}
                              onClick={() => setSaveOrderPreference(prev => !prev)}
                              className={`rounded px-1.5 py-0.5 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                saveOrderPreference
                                  ? 'bg-[#FFF3EF] text-[#EA5B3C] underline decoration-[#EA5B3C] underline-offset-4'
                                  : 'text-[#888888] hover:bg-white hover:text-[#EA5B3C]'
                              }`}
                            >
                              儲存備註
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          disabled={isClosed() || isSubmitting}
                          value={orderNote}
                          onChange={(e) => {
                            setOrderNote(e.target.value);
                            setUseSavedOrderNote(false);
                          }}
                          className="w-full rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-medium text-[#333333] placeholder:text-[#B8B2AA] focus:border-[#EA5B3C] focus:outline-none disabled:bg-[#F2EFEA]"
                        />
                      </div>
                    </div>

                    <div className="sticky bottom-0 z-10 space-y-2 bg-white pt-3">
                      {/* Total & Action Buttons */}
                      <div className="space-y-1.5">
                        <div className="text-right text-[11px] font-bold text-[#888888]">
                          可用金額 {projectedAvailableBalance < 0 ? '－' : ''}${Math.abs(projectedAvailableBalance)}
                          <span className="px-1.5 text-[#C9C3BB]">|</span>
                          儲值金 {user.balance < 0 ? '－' : ''}${Math.abs(user.balance)}
                        </div>
                        {isBelowAvailableLimit && (
                          <p className="text-right text-[11px] font-bold text-red-600">
                            餘額不足無法點餐，請向管理員儲值
                          </p>
                        )}
                        <div className="flex justify-between items-center font-bold text-[#333333] text-sm">
                          <span>總計金額</span>
                          <span className="text-xl text-[#EA5B3C] font-bold">NT$ {calculateTotal()}</span>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="flex gap-2">
                          {activeSchedule.userOrder && !isClosed() && (
                            <button
                              disabled={isSubmitting || !hasOrderChanges()}
                              onClick={handleCancelDraftModification}
                              className="flex-1 py-3 text-xs font-bold border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C]/40 rounded-xl transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              取消修改
                            </button>
                          )}
                          
                          <button
                            disabled={isPreviewMode || cartHasClosedRestaurant || isSubmitting || calculateTotal() === 0 || !seatArea || isBelowAvailableLimit || (activeSchedule.userOrder && !hasOrderChanges())}
                            onClick={handlePlaceOrder}
                            className="flex-[2] py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center"
                          >
                            {isSubmitting ? '處理中...' : activeSchedule.userOrder ? '修改並送出訂單' : '送出訂單'}
                          </button>
                        </div>
                        {activeSchedule.userOrder && !isClosed() && (
                          <button
                            disabled={isPreviewMode || isSubmitting}
                            onClick={handleCancelOrder}
                            className="w-full py-3 text-xs font-bold border border-[#EAE8E4] text-[#888888] hover:text-red-600 hover:border-red-200 rounded-xl transition-all bg-white"
                          >
                            取消訂單
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-xs text-[#888888]">
                    請先選擇上方有供餐的日期
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

        {shouldShowConfirmOrderShortcut && (
          <div className="fixed inset-x-0 bottom-3 z-40 px-6 lg:hidden">
            <button
              type="button"
              onClick={scrollToOrderSummary}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#EA5B3C] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#EA5B3C]/25 transition-all active:scale-[0.98]"
            >
              <i className="ti ti-clipboard-check text-base"></i>
              請確認訂單
            </button>
          </div>
        )}

        {shouldShowModifyShortcut && (
          <div className="fixed inset-x-0 bottom-4 z-40 px-6 lg:hidden">
            <div className="mx-auto flex w-full max-w-sm gap-2">
              <button
                type="button"
                onClick={handleCancelDraftModification}
                className="flex-[0.9] rounded-full border border-[#EAE8E4] bg-white px-4 py-3 text-sm font-bold text-[#888888] shadow-lg shadow-black/5 transition-all active:scale-[0.98]"
              >
                取消修改
              </button>
              <button
                type="button"
                onClick={scrollToOrderSummary}
                className="flex-[1.5] rounded-full bg-[#EA5B3C] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#EA5B3C]/25 transition-all active:scale-[0.98]"
              >
                修改訂單內容
              </button>
            </div>
          </div>
        )}

        {submittedOrder && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-5 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submitted-order-title"
          >
            <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#EAE8E4] bg-white shadow-2xl">
              <div className="border-b border-[#EAE8E4] px-6 py-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
                  <i className="ti ti-circle-check"></i>
                </div>
                <h2 id="submitted-order-title" className="text-lg font-bold text-[#333333]">訂購完成</h2>
                <p className="mt-1 text-xs font-medium text-[#888888]">請確認您的取餐編號與餐點</p>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="rounded-xl bg-[#FFF3EF] px-4 py-4 text-center">
                  <p className="text-xs font-bold text-[#888888]">您的編號</p>
                  <p className="mt-1 text-3xl font-bold tracking-wider text-[#EA5B3C]">{submittedOrder.number}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold text-[#888888]">訂購餐點</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {submittedOrder.items.map(item => (
                      <div key={item.menuItemId} className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3 text-xs">
                          <span className="font-bold text-[#333333]">{item.name} × {item.quantity}</span>
                          <span className="shrink-0 font-bold text-[#EA5B3C]">NT$ {item.unitPrice * item.quantity}</span>
                        </div>
                        {item.note && <p className="mt-1 text-[11px] font-medium text-[#888888]">{formatItemNoteDisplay(item.note)}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#EAE8E4] pt-4 text-sm font-bold">
                  <span className="text-[#333333]">總計金額</span>
                  <span className="text-lg text-[#EA5B3C]">NT$ {submittedOrder.totalAmount}</span>
                </div>
              </div>

              <div className="border-t border-[#EAE8E4] bg-[#F9F8F5] px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSubmittedOrder(null)}
                  className="w-full rounded-xl bg-[#EA5B3C] py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#333333]"
                >
                  已閱讀
                </button>
              </div>
            </div>
          </div>
        )}

        {isMenuImageOpen && activeRestaurant?.menuImageUrl && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-image-dialog-title"
            onClick={() => setIsMenuImageOpen(false)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#EAE8E4] bg-white shadow-2xl"
              onClick={event => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#EAE8E4] px-5 py-4">
                <h2 id="menu-image-dialog-title" className="text-base font-bold text-[#333333]">
                  {activeRestaurant.name} 菜單
                </h2>
                <button
                  type="button"
                  onClick={() => setIsMenuImageOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                  aria-label="關閉菜單圖片"
                >
                  <i className="ti ti-x text-lg"></i>
                </button>
              </div>
              <div className="overflow-auto bg-[#F9F8F5] p-3 kaizen-scrollbar sm:p-5">
                <img
                  src={activeRestaurant.menuImageUrl}
                  alt={`${activeRestaurant.name} 菜單`}
                  className="mx-auto h-auto max-w-full rounded-lg bg-white object-contain shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {editingMenuItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 py-4 sm:items-center">
            <div className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#EAE8E4] px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-[#333333]">{editingMenuItem.name}</h3>
                  <div className="mt-1 text-xs font-bold text-[#EA5B3C]">NT$ {editingMenuItem.price}</div>
                </div>
                <button
                  type="button"
                  onClick={closeMenuItemDialog}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                  aria-label="關閉"
                >
                  <i className="ti ti-x"></i>
                </button>
              </div>

              <div className="space-y-5 px-5 py-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {editingMenuItemOptions.map(option => {
                      const selected = (editingMenuItemDraft.options || []).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleCustomOptionToggle(option)}
                          className={`rounded-full border px-3 py-2 text-xs font-bold transition-all ${
                            selected
                              ? 'border-[#EA5B3C] bg-[#FFF3EF] text-[#EA5B3C]'
                              : 'border-[#EAE8E4] bg-white text-[#888888] hover:border-[#EA5B3C] hover:text-[#EA5B3C]'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex gap-2 border-t border-[#EAE8E4] bg-[#F9F8F5] px-5 py-4">
                <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#EAE8E4] bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDialogQtyChange(-1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                      aria-label="減少數量"
                    >
                      <i className="ti ti-minus text-xs"></i>
                    </button>
                    <span className="min-w-5 text-center text-sm font-bold text-[#333333]">{editingMenuItemQty}</span>
                    <button
                      type="button"
                      onClick={() => handleDialogQtyChange(1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#888888] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                      aria-label="增加數量"
                    >
                      <i className="ti ti-plus text-xs"></i>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={applyMenuItemDialog}
                  disabled={editingMenuItemQty === 0}
                  className="flex-[1.5] rounded-xl bg-[#EA5B3C] py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#EA5B3C]"
                >
                  加入訂購清單
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
