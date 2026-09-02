'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { canAccessAdminPage } from '@/lib/adminPermissions';
import LinkifiedText from '@/components/LinkifiedText';
import JsonExamplesManager from '@/components/JsonExamplesManager';

const DEFAULT_CUSTOMIZATION_OPTIONS = ['\u98ef\u5c11', '\u63db\u83dc', '\u63db\u83dc+$20'];

function fuzzyMatch(value, query) {
  const normalize = text => String(text || '').toLowerCase().replace(/[\s\-()]/g, '');
  const candidate = normalize(value);
  const target = normalize(query);
  if (!target) return true;
  if (candidate.includes(target)) return true;

  let targetIndex = 0;
  for (const character of candidate) {
    if (character === target[targetIndex]) targetIndex += 1;
    if (targetIndex === target.length) return true;
  }
  return false;
}

function normalizeCustomizationOptions(value) {
  if (Array.isArray(value)) {
    const options = value.map(option => String(option).trim()).filter(Boolean);
    return options;
  }

  if (typeof value === 'string') {
    if (!value.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const options = parsed.map(option => String(option).trim()).filter(Boolean);
        return options;
      }
      if (typeof parsed === 'string') {
        return normalizeCustomizationOptions(parsed);
      }
    } catch {
      const options = value.split(/[\r\n,;|]+/).map(option => option.trim()).filter(Boolean);
      return options;
    }
  }

  return DEFAULT_CUSTOMIZATION_OPTIONS;
}

function optionsToInputValue(value) {
  return normalizeCustomizationOptions(value).join(', ');
}

function getDefaultCategoryOrder(items = []) {
  const priority = category => {
    if (category.includes('餐盒')) return 0;
    if (category.includes('義大利麵')) return 1;
    if (/單點|加點/.test(category)) return 2;
    if (/飲料|飲品/.test(category)) return 3;
    return 4;
  };
  return [...new Set(
    items.map(item => String(item.category || '餐盒').trim()).filter(Boolean)
  )].sort((a, b) => priority(a) - priority(b) || a.localeCompare(b, 'zh-Hant'));
}

function getMenuItemProteinPriority(itemName) {
  const name = String(itemName || '');
  if (/雞|鴨|鵝/.test(name)) return 0;
  if (/豬|松阪|排骨/.test(name)) return 1;
  if (/牛/.test(name)) return 2;
  if (/魚|蝦|蟹|透抽|魷魚|花枝|干貝|蛤|蚵|貝/.test(name)) return 3;
  if (/蔬|素|菜/.test(name)) return 4;
  return 5;
}

function compressMenuImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('請選擇圖片檔案。'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('圖片讀取失敗。'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('圖片格式無法讀取。'));
      image.onload = () => {
        const maxDimension = 1800;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function RestaurantsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  
  // Import and New Restaurant State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrWarning, setOcrWarning] = useState('');
  const [newRestName, setNewRestName] = useState('');
  const [newRestPhone, setNewRestPhone] = useState('');
  const [newRestNote, setNewRestNote] = useState('');
  const [newRestMenuImage, setNewRestMenuImage] = useState('');
  const [isMenuImageProcessing, setIsMenuImageProcessing] = useState(false);
  const [menuItems, setMenuItems] = useState([]); // [{ name, price, category }] category maps to JSON "類型"
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [draggedCategory, setDraggedCategory] = useState('');
  const [isMenuTableDragging, setIsMenuTableDragging] = useState(false);
  const menuTableDragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: null
  });
  const jsonDialogMessageTimerRef = useRef(null);
  
  // UI states
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [jsonExamples, setJsonExamples] = useState([]);
  const [selectedJsonExampleId, setSelectedJsonExampleId] = useState('');
  const [jsonExampleMenuOpen, setJsonExampleMenuOpen] = useState(false);
  const [quickPreviewExample, setQuickPreviewExample] = useState(null);
  const [jsonDialogMessage, setJsonDialogMessage] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [editingRestaurantId, setEditingRestaurantId] = useState('');
  const [viewingRestaurantId, setViewingRestaurantId] = useState('');
  const [editingOriginalData, setEditingOriginalData] = useState(null);
  const [editingMenuItemIndex, setEditingMenuItemIndex] = useState(null);
  const [editingMenuItemOriginal, setEditingMenuItemOriginal] = useState(null);
  const [discardMenuItemDialogOpen, setDiscardMenuItemDialogOpen] = useState(false);
  const [restaurantToDelete, setRestaurantToDelete] = useState(null);
  const [isDeletingRestaurant, setIsDeletingRestaurant] = useState(false);
  const [restaurantSearchTerm, setRestaurantSearchTerm] = useState('');

  const buildComparableRestaurant = (name, phone, note, menuImageDataUrl, items, orderedCategories = []) => ({
    name: (name || '').trim(),
    phone: (phone || '').trim(),
    note: (note || '').trim(),
    menuImageDataUrl: menuImageDataUrl || '',
    categoryOrder: orderedCategories,
    menuItems: (items || []).map(item => ({
      name: (item.name || '').trim(),
      price: parseInt(item.price, 10) || 0,
      category: (item.category || '').trim(),
      customizationOptions: normalizeCustomizationOptions(item.customizationOptions),
      isAvailable: item.isAvailable !== false,
    })),
  });

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
          if (!canAccessAdminPage(data.user, 'restaurants')) {
            router.push('/portal');
          } else {
            fetchRestaurants();
          }
        }
      })
      .catch(() => router.push('/login'));
  }, []);

  useEffect(() => {
    const fetchJsonExamples = () => {
      fetch('/api/json-examples')
        .then(response => response.json())
        .then(data => setJsonExamples(Array.isArray(data.examples) ? data.examples : []))
        .catch(() => setJsonExamples([]));
    };
    fetchJsonExamples();
    window.addEventListener('json-examples-updated', fetchJsonExamples);
    return () => window.removeEventListener('json-examples-updated', fetchJsonExamples);
  }, []);

  const fetchRestaurants = () => {
    fetch('/api/restaurants?includeUnavailable=true')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRestaurants(data);
        }
      })
      .catch(err => console.error('無法載入餐廳列表:', err));
  };

  const normalizeImportedMenu = (parsed) => {
    const restaurantName = parsed['餐廳'] || parsed.restaurant || parsed.name || '';
    const importedItems = parsed['品項列表'] || parsed.menuItems || parsed.items || [];

    if (!restaurantName || !Array.isArray(importedItems) || importedItems.length === 0) {
      throw new Error('JSON 格式不正確，請確認包含「餐廳」與「品項列表」。');
    }

    const normalizedItems = importedItems.map((item) => ({
      category: item['類型'] || item.category || '主食',
      name: item['品項'] || item.name || '',
      price: Number(item['價格'] ?? item.price ?? 0),
      customizationOptions: normalizeCustomizationOptions(item['客製化選項'] || item.customizationOptions),
      isAvailable: item['開放'] ?? item.isAvailable ?? true,
    })).filter(item => item.name && Number.isFinite(item.price) && item.price > 0);

    if (normalizedItems.length === 0) {
      throw new Error('JSON 內沒有可匯入的品項，請確認每個品項都有名稱與價格。');
    }

    return {
      name: restaurantName,
      phone: parsed['電話'] || parsed.phone || '',
      note: parsed['備註'] || parsed.note || '',
      menuItems: normalizedItems,
    };
  };

  const handleJsonImport = () => {
    setOcrLoading(true);
    setOcrWarning('');
    setStatusMsg({ text: '', type: '' });

    try {
      const parsed = normalizeImportedMenu(JSON.parse(jsonInput));

      setNewRestName(parsed.name);
      setNewRestPhone(parsed.phone);
      setNewRestNote(parsed.note);
      setMenuItems(parsed.menuItems);
      const importedCategoryOrder = getDefaultCategoryOrder(parsed.menuItems);
      setCategoryOrder(previousOrder => editingRestaurantId
        ? [
          ...previousOrder.filter(category => importedCategoryOrder.includes(category)),
          ...importedCategoryOrder.filter(category => !previousOrder.includes(category))
        ]
        : importedCategoryOrder
      );
      setEditingMenuItemIndex(null);
      setStatusMsg({ text: 'JSON 匯入完成！請在下方表格中校對確認項目。', type: 'success' });
    } catch (err) {
      const errorMessage = err instanceof SyntaxError
        ? 'JSON 格式錯誤，請重新檢查。'
        : (err.message || 'JSON 匯入失敗');
      setStatusMsg({ text: errorMessage, type: 'error' });
    } finally {
      setOcrLoading(false);
      setJsonDialogOpen(false);
      setJsonDialogMessage('');
      clearTimeout(jsonDialogMessageTimerRef.current);
    }
  };

  const handleCopySelectedJsonExample = async () => {
    const selectedExample = jsonExamples.find(example => example.id === selectedJsonExampleId);
    if (!selectedExample) return;
    try {
      await navigator.clipboard.writeText(selectedExample.content);
      setJsonDialogMessage(`已複製「${selectedExample.title}」。`);
      clearTimeout(jsonDialogMessageTimerRef.current);
      jsonDialogMessageTimerRef.current = setTimeout(() => setJsonDialogMessage(''), 3000);
    } catch (err) {
      setJsonDialogMessage('複製失敗，請確認瀏覽器剪貼簿權限。');
      clearTimeout(jsonDialogMessageTimerRef.current);
      jsonDialogMessageTimerRef.current = setTimeout(() => setJsonDialogMessage(''), 3000);
    }
  };

  const openJsonDialog = () => {
    const currentJson = {
      餐廳: newRestName,
      電話: newRestPhone,
      備註: newRestNote,
      品項列表: menuItems.map(item => ({
        類型: item.category || '主食',
        品項: item.name,
        價格: Number(item.price) || 0,
        客製化選項: normalizeCustomizationOptions(item.customizationOptions),
        開放: item.isAvailable !== false,
      })),
    };
    setJsonInput(newRestName || menuItems.length > 0
      ? JSON.stringify(currentJson, null, 2)
      : '');
    setJsonDialogOpen(true);
    setJsonDialogMessage('');
    setSelectedJsonExampleId('');
    setJsonExampleMenuOpen(false);
    setStatusMsg({ text: '', type: '' });
  };

  // OCR upload handler
  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrWarning('');
    setStatusMsg({ text: '', type: '' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'OCR 辨識失敗');
      }

      const parsed = result.data;
      setNewRestName(parsed.name || '');
      setNewRestPhone(parsed.phone || '');
      setMenuItems((parsed.menuItems || []).map(item => ({
        ...item,
        customizationOptions: normalizeCustomizationOptions(item.customizationOptions)
      })));
      
      if (result.warning) {
        setOcrWarning(result.warning);
      }

      setStatusMsg({ text: 'AI 菜單辨識完成！請在下方表格中校對確認項目。', type: 'success' });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setOcrLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleMenuItemChange = (index, field, value) => {
    setMenuItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddMenuItem = () => {
    const newItem = { name: '', price: 0, category: '餐盒', customizationOptions: DEFAULT_CUSTOMIZATION_OPTIONS, isAvailable: true };
    setMenuItems(prev => [newItem, ...prev]);
    setEditingMenuItemIndex(0);
    setEditingMenuItemOriginal({ ...newItem, customizationOptions: [...newItem.customizationOptions] });
  };

  const handleRemoveMenuItem = (index) => {
    setMenuItems(prev => prev.filter((_, i) => i !== index));
    setEditingMenuItemIndex(current => current === index ? null : current);
    if (editingMenuItemIndex === index) setEditingMenuItemOriginal(null);
  };

  const handleToggleMenuItem = (index) => {
    handleMenuItemChange(index, 'isAvailable', menuItems[index].isAvailable === false);
  };

  const handleStartMenuItemEdit = (index) => {
    if (editingMenuItemIndex !== null) return;
    const item = menuItems[index];
    setEditingMenuItemIndex(index);
    setEditingMenuItemOriginal({
      ...item,
      customizationOptions: [...normalizeCustomizationOptions(item.customizationOptions)],
    });
  };

  const handleConfirmMenuItemEdit = () => {
    setEditingMenuItemIndex(null);
    setEditingMenuItemOriginal(null);
  };

  const handleCancelMenuItemEdit = () => {
    if (editingMenuItemIndex === null || !editingMenuItemOriginal) return;
    const currentItem = menuItems[editingMenuItemIndex];
    const hasChanges = JSON.stringify(currentItem) !== JSON.stringify(editingMenuItemOriginal);

    if (hasChanges) {
      setDiscardMenuItemDialogOpen(true);
      return;
    }

    handleConfirmMenuItemEdit();
  };

  const handleDiscardMenuItemChanges = () => {
    setMenuItems(prev => prev.map((item, index) => (
      index === editingMenuItemIndex
        ? { ...editingMenuItemOriginal, customizationOptions: [...normalizeCustomizationOptions(editingMenuItemOriginal.customizationOptions)] }
        : item
    )));
    setDiscardMenuItemDialogOpen(false);
    handleConfirmMenuItemEdit();
  };

  const resetRestaurantForm = () => {
    setEditingRestaurantId('');
    setViewingRestaurantId('');
    setEditingOriginalData(null);
    setNewRestName('');
    setNewRestPhone('');
    setNewRestNote('');
    setNewRestMenuImage('');
    setMenuItems([]);
    setCategoryOrder([]);
    setDraggedCategory('');
    setEditingMenuItemIndex(null);
    setEditingMenuItemOriginal(null);
    setDiscardMenuItemDialogOpen(false);
    setOcrWarning('');
  };

  const handleEditRestaurant = (restaurant) => {
    const editableItems = (restaurant.menuItems || []).map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category || '',
      customizationOptions: normalizeCustomizationOptions(item.customizationOptions),
      isAvailable: item.isAvailable !== false,
    }));

    setEditingRestaurantId(restaurant.id);
    setIsEditorOpen(true);
    setViewingRestaurantId('');
    setNewRestName(restaurant.name || '');
    setNewRestPhone(restaurant.phone || '');
    setNewRestNote(restaurant.note || '');
    setNewRestMenuImage(restaurant.menuImageDataUrl || '');
    setMenuItems(editableItems);
    const initialCategoryOrder = [
      ...(restaurant.categoryOrder || []),
      ...getDefaultCategoryOrder(editableItems)
    ].filter((category, index, categories) => category && categories.indexOf(category) === index);
    setCategoryOrder(initialCategoryOrder);
    setEditingMenuItemIndex(null);
    setEditingMenuItemOriginal(null);
    setEditingOriginalData(buildComparableRestaurant(
      restaurant.name,
      restaurant.phone,
      restaurant.note,
      restaurant.menuImageDataUrl,
      editableItems,
      initialCategoryOrder
    ));
    setOcrWarning('');
    setStatusMsg({ text: `正在編輯「${restaurant.name}」。`, type: 'success' });
  };

  const handleToggleRestaurantPreview = restaurant => {
    if (editingRestaurantId) return;
    if (viewingRestaurantId === restaurant.id) {
      resetRestaurantForm();
      setIsEditorOpen(false);
      setStatusMsg({ text: '', type: '' });
      return;
    }

    const previewItems = (restaurant.menuItems || []).map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category || '',
      customizationOptions: normalizeCustomizationOptions(item.customizationOptions),
      isAvailable: item.isAvailable !== false,
    }));
    const previewCategoryOrder = [
      ...(restaurant.categoryOrder || []),
      ...getDefaultCategoryOrder(previewItems)
    ].filter((category, index, categories) => category && categories.indexOf(category) === index);

    setViewingRestaurantId(restaurant.id);
    setIsEditorOpen(true);
    setNewRestName(restaurant.name || '');
    setNewRestPhone(restaurant.phone || '');
    setNewRestNote(restaurant.note || '');
    setNewRestMenuImage(restaurant.menuImageDataUrl || '');
    setMenuItems(previewItems);
    setCategoryOrder(previewCategoryOrder);
    setEditingMenuItemIndex(null);
    setEditingMenuItemOriginal(null);
    setStatusMsg({ text: '', type: '' });
  };

  const currentCategories = getDefaultCategoryOrder(menuItems);
  const displayedCategoryOrder = [
    ...categoryOrder.filter(category => currentCategories.includes(category)),
    ...currentCategories.filter(category => !categoryOrder.includes(category))
  ];
  const sortedMenuItemEntries = menuItems
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const categoryA = displayedCategoryOrder.indexOf(a.item.category);
      const categoryB = displayedCategoryOrder.indexOf(b.item.category);
      const normalizedCategoryA = categoryA < 0 ? Number.MAX_SAFE_INTEGER : categoryA;
      const normalizedCategoryB = categoryB < 0 ? Number.MAX_SAFE_INTEGER : categoryB;
      if (normalizedCategoryA !== normalizedCategoryB) return normalizedCategoryA - normalizedCategoryB;

      const proteinDifference = getMenuItemProteinPriority(a.item.name) - getMenuItemProteinPriority(b.item.name);
      if (proteinDifference) return proteinDifference;
      return (a.item.name || '').localeCompare(b.item.name || '', 'zh-Hant');
    });
  const currentEditData = buildComparableRestaurant(
    newRestName,
    newRestPhone,
    newRestNote,
    newRestMenuImage,
    menuItems,
    displayedCategoryOrder
  );
  const hasEditChanges = !!editingRestaurantId && JSON.stringify(currentEditData) !== JSON.stringify(editingOriginalData);
  const normalizedRestaurantSearch = restaurantSearchTerm.trim().toLowerCase();
  const filteredRestaurants = normalizedRestaurantSearch
    ? restaurants.filter(restaurant => [restaurant.name, restaurant.phone]
      .filter(Boolean)
      .some(value => fuzzyMatch(value, normalizedRestaurantSearch)))
    : restaurants;

  const handleMenuImageChange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsMenuImageProcessing(true);
    setStatusMsg({ text: '', type: '' });
    try {
      const dataUrl = await compressMenuImage(file);
      setNewRestMenuImage(dataUrl);
    } catch (error) {
      setStatusMsg({ text: error.message, type: 'error' });
    } finally {
      setIsMenuImageProcessing(false);
    }
  };

  const handleCategoryDrop = targetCategory => {
    if (!draggedCategory || draggedCategory === targetCategory) {
      setDraggedCategory('');
      return;
    }

    const nextOrder = [...displayedCategoryOrder];
    const fromIndex = nextOrder.indexOf(draggedCategory);
    const targetIndex = nextOrder.indexOf(targetCategory);
    if (fromIndex < 0 || targetIndex < 0) return;
    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(targetIndex, 0, draggedCategory);
    setCategoryOrder(nextOrder);
    setDraggedCategory('');
  };

  const handleMenuTablePointerDown = event => {
    if (
      event.button !== 0
      || event.target.closest('button, input, textarea, select, a, [data-table-actions]')
    ) return;
    const dragState = menuTableDragRef.current;
    dragState.active = true;
    dragState.moved = false;
    dragState.startX = event.clientX;
    dragState.scrollLeft = event.currentTarget.scrollLeft;
    dragState.pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMenuTablePointerMove = event => {
    const dragState = menuTableDragRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    const distance = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(distance) < 4) return;
    dragState.moved = true;
    setIsMenuTableDragging(true);
    event.currentTarget.scrollLeft = dragState.scrollLeft - distance;
    event.preventDefault();
  };

  const finishMenuTableDrag = event => {
    const dragState = menuTableDragRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    dragState.active = false;
    dragState.pointerId = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsMenuTableDragging(false);
  };

  const handleCancelEdit = () => {
    if (hasEditChanges && !window.confirm('資料有變更，確認要取消嗎？')) return;
    resetRestaurantForm();
    setIsEditorOpen(false);
    setStatusMsg({ text: '', type: '' });
  };

  const handleOpenNewRestaurant = () => {
    resetRestaurantForm();
    setStatusMsg({ text: '', type: '' });
    setIsEditorOpen(true);
  };

  const handleDeleteRestaurant = async () => {
    if (!restaurantToDelete) return;
    const restaurant = restaurantToDelete;
    setIsDeletingRestaurant(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await fetch(`/api/restaurants?id=${restaurant.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '刪除失敗');
      }

      if (editingRestaurantId === restaurant.id) {
        resetRestaurantForm();
        setIsEditorOpen(false);
      }

      setStatusMsg({ text: '餐廳已刪除。', type: 'success' });
      setRestaurantToDelete(null);
      fetchRestaurants();
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsDeletingRestaurant(false);
    }
  };

  const handleSaveRestaurant = async () => {
    if (!newRestName) {
      setStatusMsg({ text: '請輸入餐廳名稱！', type: 'error' });
      return;
    }

    if (menuItems.length === 0) {
      setStatusMsg({ text: '餐廳菜單內必須至少新增一個餐點項目！', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/restaurants', {
        method: editingRestaurantId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRestaurantId,
          name: newRestName,
          phone: newRestPhone,
          note: newRestNote,
          menuImageDataUrl: newRestMenuImage,
          menuItems,
          categoryOrder: displayedCategoryOrder
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '儲存失敗');
      }

      setStatusMsg({ text: editingRestaurantId ? '餐廳與菜單已成功更新！' : '餐廳與菜單已成功儲存入庫！', type: 'success' });
      fetchRestaurants();
      resetRestaurantForm();
      setIsEditorOpen(false);
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
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
            <i className="ti ti-building-store text-2xl text-[#EA5B3C]"></i> 餐廳與菜單管理
          </h2>
          <button
            onClick={() => router.push('/admin/schedule')}
            className="text-xs font-bold border border-[#EAE8E4] px-4 py-2 bg-white rounded-lg hover:border-[#EA5B3C] hover:text-[#EA5B3C] transition-all"
          >
            供餐排程
          </button>
        </div>

        <section className="grid grid-cols-1 gap-8 md:grid-cols-[280px_minmax(0,1fr)] md:gap-6">
          
          {/* Active Restaurants List (Col-span 1) */}
          <div className="space-y-6">
            <div className="bg-white border border-[#EAE8E4] rounded-lg shadow-sm p-6 space-y-4 lg:p-4 lg:space-y-3">
              <h3 className="font-bold text-sm text-[#333333] border-b border-[#EAE8E4] pb-3 flex justify-between items-center">
                <span>現有餐廳列表</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#888888]">共 {restaurants.length} 家</span>
                  <button
                    type="button"
                    onClick={handleOpenNewRestaurant}
                    aria-label="新增餐廳與菜單"
                    title="新增餐廳與菜單"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EA5B3C] text-white shadow-sm transition-all hover:bg-[#333333]"
                  >
                    <i className="ti ti-plus text-lg"></i>
                  </button>
                </span>
              </h3>

              <label className="relative block">
                <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#AAA39A]"></i>
                <input
                  type="search"
                  value={restaurantSearchTerm}
                  onChange={event => setRestaurantSearchTerm(event.target.value)}
                  placeholder="搜尋餐廳或電話"
                  className="w-full rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] py-2 pl-9 pr-3 text-xs font-bold text-[#333333] focus:border-[#EA5B3C] focus:outline-none"
                />
              </label>

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {restaurants.length === 0 ? (
                  <p className="text-center py-8 text-xs text-[#888888]">目前尚未建立任何餐廳。</p>
                ) : filteredRestaurants.length === 0 ? (
                  <p className="text-center py-8 text-xs text-[#888888]">找不到符合搜尋條件的餐廳。</p>
                ) : (
                  filteredRestaurants.map(rest => (
                    <div 
                      key={rest.id} 
                      onClick={() => handleToggleRestaurantPreview(rest)}
                      className={`cursor-pointer space-y-2 rounded-lg border p-4 transition-all lg:p-3 ${
                        viewingRestaurantId === rest.id
                          ? 'border-[#EA5B3C] bg-[#FFF3EF] shadow-sm'
                          : 'border-[#EAE8E4] bg-[#F9F8F5] hover:border-[#EA5B3C]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="max-w-[150px] truncate text-sm font-bold text-[#333333] lg:max-w-[115px]">{rest.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditRestaurant(rest);
                            }}
                            className="w-7 h-7 rounded-full border border-[#EAE8E4] bg-white text-[#333333] hover:border-[#EA5B3C] hover:text-[#EA5B3C] flex items-center justify-center transition-all"
                            aria-label={`編輯 ${rest.name}`}
                          >
                            <i className="ti ti-pencil text-sm"></i>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setRestaurantToDelete(rest);
                            }}
                            className="w-7 h-7 rounded-full border border-[#EAE8E4] bg-white text-red-600 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-all"
                            aria-label={`刪除 ${rest.name}`}
                          >
                            <i className="ti ti-trash text-sm"></i>
                          </button>
                        </div>
                      </div>
                      
                      {rest.phone && (
                        <div className="text-[11px] text-[#888888]">
                          <i className="ti ti-phone"></i> {rest.phone}
                        </div>
                      )}
                      
                      <div className="text-[10px] text-orange-600 font-bold bg-white inline-block px-2 py-0.5 rounded border border-[#EAE8E4]">
                        含 {rest.menuItems?.length || 0} 個品項
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <JsonExamplesManager />
          </div>

          {/* JSON Import and Add Menu Panel (Col-span 2) */}
          {isEditorOpen ? (
          <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/40 p-4 md:static md:z-auto md:overflow-visible md:bg-transparent md:p-0">
            <div className="c-box space-y-6">
              <h3 className="font-bold text-base text-[#333333] border-b border-[#EAE8E4] pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <i className="ti ti-file-import text-lg text-[#EA5B3C]"></i>
                  {editingRestaurantId
                    ? '編輯餐廳與菜單'
                    : viewingRestaurantId
                      ? '檢視餐廳與菜單'
                      : '新增餐廳與菜單匯入'}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openJsonDialog}
                    disabled={ocrLoading || Boolean(viewingRestaurantId)}
                    className="h-9 w-9 rounded-lg bg-[#EA5B3C] text-xs font-bold text-white shadow-sm transition-all flex items-center justify-center hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-4 sm:py-2 sm:gap-1.5"
                    title={ocrLoading ? '載入中' : 'JSON 檔'}
                    aria-label={ocrLoading ? '載入中' : 'JSON 檔'}
                  >
                    <i className="ti ti-file-import"></i>
                    <span className="hidden sm:inline">{ocrLoading ? '載入中...' : 'JSON 檔'}</span>
                  </button>
                  {editingRestaurantId && (
                    <>
                      <button
                        type="button"
                        disabled={isSaving || !newRestName || menuItems.length === 0 || !hasEditChanges}
                        onClick={handleSaveRestaurant}
                        title="儲存餐廳變更"
                        aria-label="儲存餐廳變更"
                        className="w-9 h-9 rounded-lg border border-green-200 bg-white text-green-600 hover:border-green-300 hover:bg-green-50 transition-all flex items-center justify-center disabled:text-[#C9C3BA] disabled:border-[#EAE8E4] disabled:bg-white disabled:hover:bg-white disabled:hover:border-[#EAE8E4] disabled:cursor-not-allowed"
                      >
                        <i className="ti ti-check text-lg"></i>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    title="關閉視窗"
                    aria-label="關閉餐廳編輯視窗"
                    className="h-9 w-9 rounded-lg border border-[#EAE8E4] bg-white text-[#888888] transition-all flex items-center justify-center hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <i className="ti ti-x text-lg"></i>
                  </button>
                </div>
              </h3>

              {statusMsg.text && (
                <div className={`p-4 text-xs rounded-xl flex items-start gap-2 ${
                  statusMsg.type === 'success' 
                    ? 'bg-green-50 border border-green-200 text-green-700 font-bold' 
                    : 'bg-red-50 border border-red-200 text-red-700 font-bold'
                }`}>
                  <i className={`text-base ${statusMsg.type === 'success' ? 'ti ti-circle-check' : 'ti ti-alert-circle'}`}></i>
                  <div>{statusMsg.text}</div>
                </div>
              )}

              {ocrWarning && (
                <div className="p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-pulse">
                  <i className="ti ti-alert-triangle text-base text-orange-600"></i>
                  {ocrWarning}
                </div>
              )}

              {/* Form Input Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#888888]">餐廳名稱 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newRestName}
                    onChange={(e) => setNewRestName(e.target.value)}
                    readOnly={Boolean(viewingRestaurantId)}
                    className={`w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] font-medium ${
                      viewingRestaurantId ? 'cursor-default bg-[#F9F8F5] text-[#666666]' : 'bg-white'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#888888]">聯絡電話</label>
                  <input
                    type="text"
                    value={newRestPhone}
                    onChange={(e) => setNewRestPhone(e.target.value)}
                    readOnly={Boolean(viewingRestaurantId)}
                    className={`w-full text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] font-medium ${
                      viewingRestaurantId ? 'cursor-default bg-[#F9F8F5] text-[#666666]' : 'bg-white'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#888888]">外送規則與備註 (最低消費限制、附湯說明等)</label>
                <textarea
                  rows={3}
                  value={newRestNote}
                  onChange={(e) => setNewRestNote(e.target.value)}
                  readOnly={Boolean(viewingRestaurantId)}
                  placeholder="可直接貼上網址，或使用 Markdown：[連結文字](https://example.com)"
                  className={`w-full resize-y text-xs px-3 py-2 border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] font-medium ${
                    viewingRestaurantId ? 'cursor-default bg-[#F9F8F5] text-[#666666]' : 'bg-white'
                  }`}
                />
                {newRestNote.trim() && (
                  <div className="rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] px-3 py-2">
                    <div className="mb-1 text-[10px] font-bold tracking-wider text-[#888888]">內容預覽</div>
                    <div className="whitespace-pre-wrap break-words text-xs leading-5 text-[#555555]">
                      <LinkifiedText value={newRestNote} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-[#333333]">菜單圖片</div>
                    <div className="mt-1 text-[11px] font-medium text-[#888888]">訂購者可從餐廳名稱旁的圖片圖示展開閱覽。</div>
                  </div>
                  {!viewingRestaurantId && (
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#EAE8E4] bg-white px-3 py-2 text-xs font-bold text-[#555555] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]">
                      <i className="ti ti-photo-up"></i>
                      {isMenuImageProcessing ? '處理中...' : newRestMenuImage ? '更換圖片' : '匯入圖片'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleMenuImageChange}
                        disabled={isMenuImageProcessing}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {newRestMenuImage ? (
                  <div className="relative overflow-hidden rounded-lg border border-[#EAE8E4] bg-white">
                    <img src={newRestMenuImage} alt={`${newRestName || '餐廳'}菜單預覽`} className="max-h-72 w-full object-contain" />
                    {!viewingRestaurantId && (
                      <button
                        type="button"
                        onClick={() => setNewRestMenuImage('')}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-100 bg-white/95 text-red-600 shadow-sm"
                        aria-label="移除菜單圖片"
                        title="移除圖片"
                      >
                        <i className="ti ti-trash"></i>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#D6D1CA] bg-white px-4 py-8 text-center text-xs font-medium text-[#99928A]">
                    尚未匯入菜單圖片
                  </div>
                )}
              </div>

              {/* Editable Menu Items Table */}
              <div className="space-y-4 pt-4 border-t border-[#EAE8E4]">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-[#333333] border-l-4 border-l-[#EA5B3C] pl-2.5">
                    菜單品項校對編輯
                  </h4>
                  {!viewingRestaurantId && (
                    <button
                      onClick={handleAddMenuItem}
                      className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:text-[#EA5B3C] hover:border-[#EA5B3C] px-3 py-1.5 rounded-lg bg-white transition-all flex items-center gap-1"
                    >
                      <i className="ti ti-plus"></i> 新增品項
                    </button>
                  )}
                </div>

                {displayedCategoryOrder.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-[#666666]">類型書籤排序</span>
                      <span className="text-[10px] text-[#888888]">
                        {viewingRestaurantId ? '唯讀預覽' : '拖曳調整訂購頁顯示順序'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {displayedCategoryOrder.map((category, index) => (
                        <button
                          key={category}
                          type="button"
                          draggable={!viewingRestaurantId}
                          onDragStart={() => setDraggedCategory(category)}
                          onDragEnd={() => setDraggedCategory('')}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleCategoryDrop(category)}
                          className={`inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold transition-all ${
                            viewingRestaurantId ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                          } ${
                            draggedCategory === category
                              ? 'border-[#EA5B3C] text-[#EA5B3C] opacity-60'
                              : 'border-[#EAE8E4] text-[#333333] hover:border-[#EA5B3C]'
                          }`}
                          aria-label={`第 ${String(index + 1).padStart(2, '0')} 類型 ${category}，可拖曳排序`}
                        >
                          <i className="ti ti-grip-vertical text-[#AAA39A]"></i>
                          <span className="text-[#EA5B3C]">{String(index + 1).padStart(2, '0')}</span>
                          <span>{category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {menuItems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#D6D1CA] rounded-xl text-xs text-[#888888] space-y-2">
                    <i className="ti ti-clipboard-list text-3xl"></i>
                    <p>尚無任何餐點項目。</p>
                  </div>
                ) : (
                  <div className="relative overflow-hidden rounded-xl border border-[#EAE8E4]">
                    <div
                      className={`overflow-x-auto touch-pan-y ${
                        isMenuTableDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
                      }`}
                      onPointerDown={handleMenuTablePointerDown}
                      onPointerMove={handleMenuTablePointerMove}
                      onPointerUp={finishMenuTableDrag}
                      onPointerCancel={finishMenuTableDrag}
                      onClickCapture={event => {
                        if (!menuTableDragRef.current.moved) return;
                        event.preventDefault();
                        event.stopPropagation();
                        menuTableDragRef.current.moved = false;
                      }}
                      role="region"
                      aria-label="菜單品項表格，可按住拖曳左右移動"
                    >
                    <table className="min-w-[710px] w-full table-fixed text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F9F8F5] text-[#888888] font-bold border-b border-[#EAE8E4]">
                          <th className="w-[150px] p-3">品項名稱</th>
                          <th className="p-3 w-[120px]">單價 (NT$)</th>
                          <th className="w-[72px] p-3 text-center">類型</th>
                          <th className="p-3 min-w-[220px]">客製化選項</th>
                          <th
                            data-table-actions
                            className="sticky right-0 z-10 w-[148px] cursor-default border-l border-[#EAE8E4] bg-[#F9F8F5] p-3 text-center"
                          >
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAE8E4] text-[#333333]">
                        {sortedMenuItemEntries.map(({ item, originalIndex: index }) => {
                          const isEditing = editingMenuItemIndex === index;
                          const isAvailable = item.isAvailable !== false;
                          const itemLabel = item.name || '未命名品項';

                          return (
                          <tr
                            key={item.id || `new-${index}`}
                            className={isAvailable ? 'hover:bg-[#F9F8F5]/30' : 'bg-[#F4F3F1] text-[#999999]'}
                          >
                            <td className="p-2">
                              {isEditing ? <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleMenuItemChange(index, 'name', e.target.value)}
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                              /> : (
                                <div className="flex items-center px-2 py-1.5">
                                  <span className="font-bold">{itemLabel}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              {isEditing ? <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleMenuItemChange(index, 'price', parseInt(e.target.value, 10) || 0)}
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-bold"
                              /> : <span className="block px-2 py-1.5 font-bold">NT$ {item.price}</span>}
                            </td>
                            <td className="p-2 text-center">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 text-[10px] font-bold text-[#EA5B3C]">
                                    {String(Math.max(0, displayedCategoryOrder.indexOf(item.category)) + 1).padStart(2, '0')}
                                  </span>
                                  <input
                                    type="text"
                                    value={item.category || ''}
                                    onChange={(e) => handleMenuItemChange(index, 'category', e.target.value)}
                                    className="min-w-0 flex-1 text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                                  />
                                </div>
                              ) : (
                                <span
                                  className="block py-1.5 text-xs font-bold text-[#EA5B3C]"
                                  title={item.category || '主食'}
                                >
                                  {String(Math.max(0, displayedCategoryOrder.indexOf(item.category)) + 1).padStart(2, '0')}
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {isEditing ? <input
                                type="text"
                                value={optionsToInputValue(item.customizationOptions)}
                                onChange={(e) => handleMenuItemChange(index, 'customizationOptions', normalizeCustomizationOptions(e.target.value))}
                                className="w-full text-xs px-2 py-1.5 border border-[#EAE8E4] rounded focus:outline-none focus:border-[#EA5B3C] bg-white font-medium"
                              /> : (
                                <span className="block truncate px-2 py-1.5" title={optionsToInputValue(item.customizationOptions)}>
                                  {optionsToInputValue(item.customizationOptions) || '—'}
                                </span>
                              )}
                            </td>
                            <td data-table-actions className={`sticky right-0 cursor-default border-l border-[#EAE8E4] p-2 ${
                              isAvailable ? 'bg-white' : 'bg-[#F4F3F1]'
                            }`}>
                              <div className="flex items-center justify-center gap-1">
                              {viewingRestaurantId ? (
                                <span className="text-[10px] font-bold tracking-wider text-[#888888]">唯讀</span>
                              ) : (
                              <>
                              <button
                                type="button"
                                onClick={() => handleToggleMenuItem(index)}
                                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                                  isAvailable
                                    ? 'border-green-200 text-green-700 hover:bg-green-50'
                                    : 'border-gray-300 text-gray-500 hover:bg-white'
                                }`}
                                aria-label={`${isAvailable ? '關閉' : '開放'} ${itemLabel}`}
                                title={isAvailable ? '關閉品項' : '開放品項'}
                              >
                                <i className={`ti ${isAvailable ? 'ti-eye' : 'ti-eye-off'}`}></i>
                              </button>
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={handleCancelMenuItemEdit}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D6D1CA] bg-white text-[#777777] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                    aria-label={`取消編輯 ${itemLabel}`}
                                    title="取消編輯"
                                  >
                                    <i className="ti ti-x"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleConfirmMenuItemEdit}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-green-600 bg-green-600 text-white transition-all hover:bg-green-700"
                                    aria-label={`確認編輯 ${itemLabel}`}
                                    title="確認編輯"
                                  >
                                    <i className="ti ti-check"></i>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartMenuItemEdit(index)}
                                  disabled={editingMenuItemIndex !== null}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D6D1CA] text-[#555555] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C] disabled:cursor-not-allowed disabled:opacity-35"
                                  aria-label={`編輯 ${itemLabel}`}
                                  title={editingMenuItemIndex !== null ? '請先完成目前品項編輯' : '編輯品項'}
                                >
                                  <i className="ti ti-pencil"></i>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveMenuItem(index)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-red-600 transition-all hover:border-red-200 hover:bg-red-50"
                                aria-label={`刪除 ${itemLabel}`}
                                title="刪除品項"
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                              </>
                              )}
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    <div
                      className="pointer-events-none absolute bottom-0 right-0 z-30 h-3 w-[148px] border-l border-[#EAE8E4] bg-white"
                      aria-hidden="true"
                    ></div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              {menuItems.length > 0 && !editingRestaurantId && !viewingRestaurantId && (
                <div className="pt-4 border-t border-[#EAE8E4] flex justify-end">
                  <button
                    disabled={isSaving || !newRestName}
                    onClick={handleSaveRestaurant}
                    className="px-8 py-3 text-xs font-bold bg-[#EA5B3C] text-white rounded-xl shadow-sm hover:bg-[#333333] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSaving ? '正在儲存...' : '確認結構無誤，儲存建立餐廳'}
                  </button>
                </div>
              )}

            </div>
          </div>
          ) : (
            <div className="hidden min-h-[420px] items-center justify-center rounded-xl border border-dashed border-[#D6D1CA] bg-white/60 px-8 text-center md:flex">
              <div className="max-w-sm space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3EF] text-[#EA5B3C]">
                  <i className="ti ti-building-store text-2xl"></i>
                </div>
                <h3 className="text-base font-bold text-[#333333]">餐廳與菜單編輯區</h3>
                <p className="text-xs font-bold leading-6 text-[#888888]">
                  請從左側選擇餐廳進行檢視或編輯，或點擊列表右上方的＋新增餐廳與菜單。
                </p>
              </div>
            </div>
          )}

        </section>

      </main>

      {restaurantToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-restaurant-title"
            className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#EAE8E4] px-6 py-4">
              <h3 id="delete-restaurant-title" className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <i className="ti ti-trash"></i>
                </span>
                刪除餐廳
              </h3>
              <button
                type="button"
                onClick={() => setRestaurantToDelete(null)}
                disabled={isDeletingRestaurant}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#888888] transition-all hover:bg-[#F9F8F5] hover:text-[#333333] disabled:opacity-40"
                aria-label="關閉刪除確認"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <p className="text-sm font-bold text-[#333333]">
                  確定要刪除「{restaurantToDelete.name}」嗎？
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#777777]">
                  刪除後，這間餐廳及其菜單將不再顯示。
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestaurantToDelete(null)}
                  disabled={isDeletingRestaurant}
                  className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2 text-xs font-bold text-[#333333] transition-all hover:border-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRestaurant}
                  disabled={isDeletingRestaurant}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <i className={`ti ${isDeletingRestaurant ? 'ti-loader-2 animate-spin' : 'ti-trash'}`}></i>
                  {isDeletingRestaurant ? '正在刪除...' : '確認刪除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {discardMenuItemDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-menu-item-title"
            className="w-full max-w-[420px] overflow-hidden rounded-xl border border-[#EAE8E4] bg-white shadow-2xl"
          >
            <div className="border-b border-[#EAE8E4] px-6 py-4">
              <h3 id="discard-menu-item-title" className="flex items-center gap-2 text-base font-bold text-[#333333]">
                <i className="ti ti-alert-triangle text-[#EA5B3C]"></i>
                放棄品項變更？
              </h3>
            </div>
            <div className="space-y-5 p-6">
              <p className="text-sm leading-relaxed text-[#666666]">
                此品項已有尚未確認的修改。放棄後會還原成編輯前的內容。
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDiscardMenuItemDialogOpen(false)}
                  className="rounded-lg border border-[#EAE8E4] bg-white px-4 py-2 text-xs font-bold text-[#333333] transition-all hover:border-[#333333]"
                >
                  繼續編輯
                </button>
                <button
                  type="button"
                  onClick={handleDiscardMenuItemChanges}
                  className="rounded-lg bg-[#EA5B3C] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#333333]"
                >
                  放棄變更
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {jsonDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-[680px] rounded-xl bg-white shadow-2xl border border-[#EAE8E4] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#EAE8E4]">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="font-bold text-base text-[#333333] flex items-center gap-2">
                  <i className="ti ti-file-import text-[#EA5B3C]"></i>
                  編輯 JSON
                </h3>
                <div className="relative">
                  <button type="button" onClick={() => setJsonExampleMenuOpen(open => !open)} className="flex min-w-[110px] items-center justify-between gap-2 rounded-lg border border-[#EAE8E4] bg-white px-3 py-1.5 text-xs font-bold text-[#555555] hover:border-[#EA5B3C]" aria-haspopup="listbox" aria-expanded={jsonExampleMenuOpen}>
                    <span className="max-w-[130px] truncate">{jsonExamples.find(example => example.id === selectedJsonExampleId)?.title || '--'}</span>
                    <i className={`ti ${jsonExampleMenuOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                  </button>
                  {jsonExampleMenuOpen && <div className="absolute left-0 top-full z-30 mt-2 w-[280px] overflow-hidden rounded-lg border border-[#EAE8E4] bg-white shadow-xl" role="listbox">
                    <button type="button" onClick={() => { setSelectedJsonExampleId(''); setJsonExampleMenuOpen(false); setQuickPreviewExample(null); }} className="w-full px-3 py-2 text-left text-xs font-bold text-[#888888] hover:bg-[#F9F8F5]">--</button>
                    <div className="max-h-44 overflow-y-auto border-t border-[#EAE8E4]">
                      {jsonExamples.map(example => <div key={example.id} className="flex items-center border-b border-[#F0EDE8] last:border-b-0">
                        <button type="button" onClick={() => { setSelectedJsonExampleId(example.id); setJsonExampleMenuOpen(false); setQuickPreviewExample(null); }} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-xs font-bold text-[#333333] hover:bg-[#F9F8F5]" role="option" aria-selected={selectedJsonExampleId === example.id}>{example.title}</button>
                        <button
                          type="button"
                          onClick={() => setQuickPreviewExample(current => current?.id === example.id ? null : example)}
                          className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#FFF3EF] hover:text-[#EA5B3C]"
                          aria-label={`預覽 ${example.title}`}
                          aria-expanded={quickPreviewExample?.id === example.id}
                          title={quickPreviewExample?.id === example.id ? '關閉預覽' : '預覽'}
                        ><i className="ti ti-eye"></i></button>
                      </div>)}
                    </div>
                    {quickPreviewExample && <pre className="max-h-40 overflow-auto border-t border-[#EAE8E4] bg-[#F9F8F5] p-3 font-mono text-[10px] leading-5 text-[#555555]">{quickPreviewExample.content}</pre>}
                  </div>}
                </div>
                {selectedJsonExampleId && <button type="button" onClick={handleCopySelectedJsonExample} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#EAE8E4] bg-white text-[#555555] hover:border-[#EA5B3C] hover:text-[#EA5B3C]" aria-label="複製所選 JSON 範例" title="複製所選範例"><i className="ti ti-copy"></i></button>}
              </div>
              <button
                type="button"
                onClick={() => { setJsonDialogOpen(false); setJsonDialogMessage(''); clearTimeout(jsonDialogMessageTimerRef.current); }}
                className="w-8 h-8 rounded-full border border-transparent hover:border-[#EAE8E4] hover:bg-[#F9F8F5] text-[#888888] flex items-center justify-center transition-all"
                aria-label="關閉"
              >
                <i className="ti ti-x"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {jsonDialogMessage && (
                <div className="fixed left-1/2 top-1/2 z-[140] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs font-bold text-green-700 shadow-xl">
                  <i className="ti ti-circle-check"></i>
                  {jsonDialogMessage}
                </div>
              )}
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full min-h-[320px] resize-y rounded-lg border border-[#EAE8E4] bg-[#F9F8F5] p-4 font-mono text-xs leading-relaxed text-[#333333] focus:outline-none focus:border-[#EA5B3C]"
                spellCheck={false}
              />

              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setJsonDialogOpen(false); setJsonDialogMessage(''); clearTimeout(jsonDialogMessageTimerRef.current); }}
                    className="text-xs font-bold border border-[#EAE8E4] text-[#333333] hover:border-[#333333] px-4 py-2 rounded-lg bg-white transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleJsonImport}
                    disabled={ocrLoading || !jsonInput.trim()}
                    className="text-xs font-bold bg-[#EA5B3C] hover:bg-[#333333] text-white px-5 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <i className="ti ti-check"></i>
                    儲存並匯入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
