'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { getViewerPage } from '@/lib/adminPermissions';

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

function getHistoryDateBounds() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const earliest = new Date(today);
  earliest.setMonth(earliest.getMonth() - 18);
  return {
    earliest,
    earliestKey: toDateKey(earliest),
    today,
    todayKey: toDateKey(today),
  };
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

function escapeExcelXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getOrderItemsSummary(transaction) {
  const items = transaction.order?.orderItems || [];
  return items.map(item => {
    const name = item.menuItem?.name || '餐點';
    const note = item.note ? `／${item.note}` : '';
    return `${name}${note} × ${item.quantity}`;
  }).join('\n');
}

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [isLedgerCalendarOpen, setIsLedgerCalendarOpen] = useState(false);
  const [isLedgerActionsOpen, setIsLedgerActionsOpen] = useState(false);
  const [ledgerCalendarMonth, setLedgerCalendarMonth] = useState(() => new Date());
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(6);
  const [exportMessage, setExportMessage] = useState('');
  const ledgerCalendarRef = useRef(null);

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
          if (data.user?.role === 'viewer') {
            router.replace(getViewerPage(data.user.viewerPage)?.href || '/login');
            return;
          }
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

  useEffect(() => {
    if (!isLedgerCalendarOpen && !isLedgerActionsOpen) return;

    const handlePointerDown = (event) => {
      if (ledgerCalendarRef.current && !ledgerCalendarRef.current.contains(event.target)) {
        setIsLedgerCalendarOpen(false);
        setIsLedgerActionsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isLedgerCalendarOpen, isLedgerActionsOpen]);

  const fetchTransactions = ({
    startDate = ledgerStartDate,
    endDate = ledgerEndDate
  } = {}) => {
    setVisibleTransactionCount(6);
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
    const { earliestKey, todayKey } = getHistoryDateBounds();
    if (dateKey < earliestKey || dateKey > todayKey) return;
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

  const exportHistoryToLegacyExcel = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setHours(0, 0, 0, 0);
    const exportTransactions = transactions.filter(transaction => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= oneYearAgo && createdAt <= today;
    });

    if (exportTransactions.length === 0) {
      setExportMessage('目前篩選範圍內沒有最近一年的紀錄可匯出。');
      return;
    }

    setExportMessage('');
    const title = `${user?.name || '個人'} 個人訂單與扣款紀錄`;
    const rangeLabel = ledgerStartDate
      ? `${ledgerStartDate}${ledgerEndDate ? ` 至 ${ledgerEndDate}` : ''}`
      : '最近一年';
    const monthGroups = new Map();
    exportTransactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key).push(transaction);
    });
    const monthEntries = [...monthGroups.entries()].sort(([left], [right]) => right.localeCompare(left));
    const yearGroups = new Map();
    exportTransactions.forEach(transaction => {
      const year = String(new Date(transaction.createdAt).getFullYear());
      if (!yearGroups.has(year)) yearGroups.set(year, []);
      yearGroups.get(year).push(transaction);
    });
    const buildSummaryRow = (label, groupedTransactions) => {
      const positiveTotal = groupedTransactions.reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0);
      const deductionTotal = groupedTransactions.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amount, 0)), 0);
      return `<Row><Cell><Data ss:Type="String">${label}</Data></Cell><Cell><Data ss:Type="Number">${groupedTransactions.length}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${positiveTotal}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${deductionTotal}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${positiveTotal - deductionTotal}</Data></Cell></Row>`;
    };
    const yearSummaryRows = [...yearGroups.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([year, yearTransactions]) => buildSummaryRow(`${year} 年`, yearTransactions))
      .join('');
    const monthSummaryRows = monthEntries.map(([key, monthTransactions]) => {
      const positiveTotal = monthTransactions.reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0);
      const deductionTotal = monthTransactions.reduce((sum, transaction) => sum + Math.abs(Math.min(transaction.amount, 0)), 0);
      return `<Row><Cell><Data ss:Type="String">${key.replace('-', ' 年 ')} 月</Data></Cell><Cell><Data ss:Type="Number">${monthTransactions.length}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${positiveTotal}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${deductionTotal}</Data></Cell><Cell ss:StyleID="Currency"><Data ss:Type="Number">${positiveTotal - deductionTotal}</Data></Cell></Row>`;
    }).join('');
    const yearSummarySheet = `<Worksheet ss:Name="年度統計">
      <Table>
        <Column ss:Width="110"/><Column ss:Width="75"/><Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="90"/>
        <Row ss:Height="28"><Cell ss:MergeAcross="4" ss:StyleID="Title"><Data ss:Type="String">${escapeExcelXml(title)}</Data></Cell></Row>
        <Row><Cell ss:MergeAcross="4"><Data ss:Type="String">匯出範圍：${escapeExcelXml(rangeLabel)}（最多最近一年）｜共 ${exportTransactions.length} 筆</Data></Cell></Row>
        <Row/>
        <Row>${['年份', '紀錄筆數', '儲值／調整', '訂單扣款', '淨異動'].map(label => `<Cell ss:StyleID="Header"><Data ss:Type="String">${label}</Data></Cell>`).join('')}</Row>
        ${yearSummaryRows}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
    </Worksheet>`;
    const monthSummarySheet = `<Worksheet ss:Name="月份統計">
      <Table>
        <Column ss:Width="110"/><Column ss:Width="75"/><Column ss:Width="90"/><Column ss:Width="90"/><Column ss:Width="90"/>
        <Row ss:Height="28"><Cell ss:MergeAcross="4" ss:StyleID="Title"><Data ss:Type="String">月份統計</Data></Cell></Row>
        <Row><Cell ss:MergeAcross="4"><Data ss:Type="String">依月份彙整最近一年內的個人紀錄</Data></Cell></Row>
        <Row/>
        <Row>${['月份', '紀錄筆數', '儲值／調整', '訂單扣款', '淨異動'].map(label => `<Cell ss:StyleID="Header"><Data ss:Type="String">${label}</Data></Cell>`).join('')}</Row>
        ${monthSummaryRows}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
    </Worksheet>`;
    const detailSheets = monthEntries.map(([key, monthTransactions]) => {
      const [year, month] = key.split('-');
      const sheetName = `${year}年${Number(month)}月`;
      const rows = monthTransactions.map(transaction => {
        const restaurant = transaction.order?.schedule?.restaurant?.name || '';
        const cells = [
          formatTransactionTime(transaction.createdAt),
          transaction.amount,
          transaction.source || (transaction.type === 'charge' ? '訂單扣款' : '-'),
          transaction.order?.orderNumber || '',
          restaurant,
          getOrderItemsSummary(transaction),
          transaction.order?.note || '',
          transaction.operator?.name || '系統自動',
          transaction.note || '',
        ];
        return `<Row>${cells.map((value, index) => index === 1
          ? `<Cell ss:StyleID="Currency"><Data ss:Type="Number">${Number(value) || 0}</Data></Cell>`
          : `<Cell ss:StyleID="Wrap"><Data ss:Type="String">${escapeExcelXml(value)}</Data></Cell>`).join('')}</Row>`;
      }).join('');
      return `<Worksheet ss:Name="${sheetName}">
        <Table>
          <Column ss:Width="125"/><Column ss:Width="75"/><Column ss:Width="95"/><Column ss:Width="85"/><Column ss:Width="110"/><Column ss:Width="280"/><Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="180"/>
          <Row ss:Height="28"><Cell ss:MergeAcross="8" ss:StyleID="Title"><Data ss:Type="String">${year} 年 ${Number(month)} 月明細</Data></Cell></Row>
          <Row><Cell ss:MergeAcross="8"><Data ss:Type="String">共 ${monthTransactions.length} 筆</Data></Cell></Row>
          <Row/>
          <Row>${['交易時間', '異動金額', '來源', '訂單號碼', '餐廳', '餐點／客製化內容／數量', '訂單備註', '經手人', '帳務備註'].map(label => `<Cell ss:StyleID="Header"><Data ss:Type="String">${label}</Data></Cell>`).join('')}</Row>
          ${rows}
        </Table>
        <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>
      </Worksheet>`;
    }).join('');
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Microsoft JhengHei" ss:Size="11"/></Style>
    <Style ss:ID="Title"><Font ss:FontName="Microsoft JhengHei" ss:Size="16" ss:Bold="1" ss:Color="#333333"/></Style>
    <Style ss:ID="Header"><Font ss:FontName="Microsoft JhengHei" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#EA5B3C" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Currency"><NumberFormat ss:Format="NT$ #,##0;[Red]-NT$ #,##0"/></Style>
    <Style ss:ID="Wrap"><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>
  </Styles>
  ${yearSummarySheet}
  ${monthSummarySheet}
  ${detailSheets}
</Workbook>`;

    const blob = new Blob(['\ufeff', workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `個人訂單紀錄_${toDateKey(new Date())}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportHistoryToExcel = async () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setHours(0, 0, 0, 0);

    const exportTransactions = transactions.filter((transaction) => {
      const createdAt = new Date(transaction.createdAt);
      return createdAt >= oneYearAgo && createdAt <= today;
    });

    if (exportTransactions.length === 0) {
      setExportMessage('最近一年內沒有可匯出的紀錄。');
      return;
    }

    try {
      setExportMessage('');
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const currencyFormat = 'NT$ #,##0;[Red]-NT$ #,##0';
      const monthGroups = new Map();
      const yearGroups = new Map();

      exportTransactions.forEach((transaction) => {
        const date = new Date(transaction.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const yearKey = String(date.getFullYear());
        if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
        if (!yearGroups.has(yearKey)) yearGroups.set(yearKey, []);
        monthGroups.get(monthKey).push(transaction);
        yearGroups.get(yearKey).push(transaction);
      });

      const monthEntries = [...monthGroups.entries()].sort(([left], [right]) => right.localeCompare(left));
      const summarize = (groupedTransactions) => {
        const positiveTotal = groupedTransactions.reduce(
          (sum, transaction) => sum + Math.max(Number(transaction.amount) || 0, 0),
          0
        );
        const deductionTotal = groupedTransactions.reduce(
          (sum, transaction) => sum + Math.abs(Math.min(Number(transaction.amount) || 0, 0)),
          0
        );
        return [groupedTransactions.length, positiveTotal, deductionTotal, positiveTotal - deductionTotal];
      };
      const applyCurrencyFormat = (worksheet, columns, firstRow, lastRow) => {
        columns.forEach((column) => {
          for (let row = firstRow; row <= lastRow; row += 1) {
            const cell = worksheet[`${column}${row}`];
            if (cell && cell.t === 'n') cell.z = currencyFormat;
          }
        });
      };
      const appendSheet = (name, rows, widths, currencyColumns = [], dataStartRow = 5) => {
        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] = widths.map((wch) => ({ wch }));
        worksheet['!merges'] = [XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(widths.length - 1)}1`)];
        applyCurrencyFormat(worksheet, currencyColumns, dataStartRow, rows.length);
        XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
      };

      const title = `${user?.name || '使用者'} 個人訂單紀錄`;
      const rangeLabel = ledgerStartDate
        ? `${ledgerStartDate}${ledgerEndDate ? ` 至 ${ledgerEndDate}` : ''}`
        : '全部日期';
      const summaryHeader = ['期間', '紀錄筆數', '儲值／調整', '訂單扣款', '淨額'];

      const yearRows = [
        [title],
        [`匯出範圍：${rangeLabel}（最多最近一年）｜共 ${exportTransactions.length} 筆`],
        [],
        summaryHeader,
        ...[...yearGroups.entries()]
          .sort(([left], [right]) => right.localeCompare(left))
          .map(([year, groupedTransactions]) => [`${year} 年`, ...summarize(groupedTransactions)]),
      ];
      appendSheet('年度統計', yearRows, [14, 12, 16, 16, 16], ['C', 'D', 'E']);

      const monthRows = [
        ['月份統計'],
        ['依月份彙整最近一年內的個人帳務紀錄'],
        [],
        summaryHeader,
        ...monthEntries.map(([key, groupedTransactions]) => [
          `${key.slice(0, 4)} 年 ${Number(key.slice(5))} 月`,
          ...summarize(groupedTransactions),
        ]),
      ];
      appendSheet('月份統計', monthRows, [16, 12, 16, 16, 16], ['C', 'D', 'E']);

      monthEntries.forEach(([key, monthTransactions]) => {
        const [year, month] = key.split('-');
        const detailRows = [
          [`${year} 年 ${Number(month)} 月明細`],
          [`共 ${monthTransactions.length} 筆`],
          [],
          ['交易時間', '異動金額', '來源', '訂單號碼', '餐廳', '餐點／客製化／數量', '訂單備註', '操作經手人', '帳務備註'],
          ...monthTransactions.map((transaction) => [
            formatTransactionTime(transaction.createdAt),
            Number(transaction.amount) || 0,
            transaction.source || (transaction.type === 'charge' ? '訂單扣款' : '-'),
            transaction.order?.orderNumber || '',
            transaction.order?.schedule?.restaurant?.name || '',
            getOrderItemsSummary(transaction),
            transaction.order?.note || '',
            transaction.operator?.name || '系統自動',
            transaction.note || '',
          ]),
        ];
        appendSheet(
          `${year}年${Number(month)}月`,
          detailRows,
          [20, 14, 16, 14, 18, 42, 28, 18, 28],
          ['B']
        );
      });

      XLSX.writeFile(workbook, `個人訂單紀錄_${toDateKey(new Date())}.xlsx`, {
        bookType: 'xlsx',
        compression: true,
      });
    } catch (error) {
      console.error('Excel 匯出失敗', error);
      setExportMessage('Excel 匯出失敗，請稍後再試。');
    }
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

  const historyDateBounds = getHistoryDateBounds();
  const earliestCalendarMonth = new Date(historyDateBounds.earliest.getFullYear(), historyDateBounds.earliest.getMonth(), 1);
  const latestCalendarMonth = new Date(historyDateBounds.today.getFullYear(), historyDateBounds.today.getMonth(), 1);
  const canViewPreviousMonth = ledgerCalendarMonth > earliestCalendarMonth;
  const canViewNextMonth = ledgerCalendarMonth < latestCalendarMonth;
  const visibleTransactions = transactions.slice(0, visibleTransactionCount);

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
  const walletAmount = `NT$ ${Math.abs(user.balance)}`;
  const pendingHoldAmount = user.pendingHoldAmount || 0;
  const availableBalance = user.availableBalance ?? (user.balance - pendingHoldAmount);

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
            <div className="flex flex-col items-start gap-1">
              <span className={`text-3xl font-bold ${wallet.valueColor}`}>
                {walletAmount}
              </span>
              {pendingHoldAmount > 0 && (
                <span className="text-xs font-bold text-[#888888]">
                  可用金額 {availableBalance < 0 ? '－' : ''}NT$ {Math.abs(availableBalance)}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Ledger Transactions Grid */}
        <div className="c-box">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div className="flex w-full flex-wrap items-center justify-between gap-3 md:min-w-0 md:flex-1">
              <h3 className="font-bold text-[#333333] text-base border-l-4 border-l-[#EA5B3C] pl-2.5">
                個人歷史訂單與扣款紀錄
              </h3>
            </div>

            <div ref={ledgerCalendarRef} className="space-y-1.5 relative w-full md:w-[320px]">
              {(ledgerStartDate || ledgerEndDate) && (
                <div className="flex h-4 items-center justify-end">
                  <button
                    type="button"
                    onClick={clearLedgerDateFilter}
                    className="text-[10px] font-bold text-[#888888] hover:text-[#EA5B3C] transition-all"
                  >
                    清除
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLedgerCalendarOpen(prev => !prev);
                    setIsLedgerActionsOpen(false);
                  }}
                  className="h-9 min-w-0 flex-1 px-3 text-left text-xs font-medium border border-[#EAE8E4] rounded-lg focus:outline-none focus:border-[#EA5B3C] bg-white flex items-center justify-between gap-2 hover:border-[#D6D1CA] transition-all"
                >
                  <span>{getDateLabel(ledgerStartDate, ledgerEndDate)}</span>
                  <i className="ti ti-calendar text-[#888888]"></i>
                </button>
                <div className="relative hidden shrink-0 md:block">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLedgerActionsOpen(prev => !prev);
                      setIsLedgerCalendarOpen(false);
                    }}
                    aria-label="開啟更多功能"
                    aria-expanded={isLedgerActionsOpen}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#EAE8E4] bg-white text-[#555555] transition-all hover:border-[#EA5B3C] hover:text-[#EA5B3C]"
                  >
                    <i className="ti ti-dots-vertical text-lg"></i>
                  </button>
                  {isLedgerActionsOpen && (
                    <div className="absolute right-0 top-full z-40 mt-2 w-36 overflow-hidden rounded-lg border border-[#EAE8E4] bg-white p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.10)]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsLedgerActionsOpen(false);
                          exportHistoryToExcel();
                        }}
                        disabled={transactions.length === 0}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-bold text-[#555555] transition-colors hover:bg-[#F9F8F5] hover:text-green-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <i className="ti ti-file-spreadsheet text-base"></i>
                        匯出 Excel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isLedgerCalendarOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-[280px] rounded-xl border border-[#EAE8E4] bg-white shadow-[0_12px_30px_rgba(0,0,0,0.08)] p-3">
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      disabled={!canViewPreviousMonth}
                      onClick={() => setLedgerCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="w-8 h-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] transition-all disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <i className="ti ti-chevron-left"></i>
                    </button>
                    <div className="text-xs font-bold text-[#333333]">
                      {ledgerCalendarMonth.getFullYear()} 年 {ledgerCalendarMonth.getMonth() + 1} 月
                    </div>
                    <button
                      type="button"
                      disabled={!canViewNextMonth}
                      onClick={() => setLedgerCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      className="w-8 h-8 rounded-lg border border-[#EAE8E4] text-[#888888] hover:text-[#EA5B3C] hover:border-[#EA5B3C] transition-all disabled:cursor-not-allowed disabled:opacity-30"
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
                      const disabled = dateKey < historyDateBounds.earliestKey || dateKey > historyDateBounds.todayKey;
                      const isStart = dateKey === ledgerStartDate;
                      const isEnd = dateKey === ledgerEndDate;
                      const isInRange = ledgerStartDate && ledgerEndDate && dateKey > ledgerStartDate && dateKey < ledgerEndDate;

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleLedgerDateSelect(dateKey)}
                          className={`h-8 rounded-lg text-[11px] font-bold transition-all ${
                            disabled
                              ? 'cursor-not-allowed text-[#D6D1CA]'
                              : isStart || isEnd
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

          {exportMessage && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
              {exportMessage}
            </div>
          )}

          {transactions.length === 0 ? (
            <div className="text-center py-16 text-xs text-[#888888] space-y-3">
              <i className="ti ti-receipt-off text-5xl text-[#D6D1CA] block"></i>
              <span>尚無任何交易與扣款明細。</span>
            </div>
          ) : (
            <div className="space-y-4">
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
                  {visibleTransactions.map(tx => {
                    return (
                      <tr key={tx.id} className="hover:bg-[#F9F8F5]/50 transition-colors">
                        <td className="py-4 font-medium">
                          {formatTransactionTime(tx.createdAt)}
                        </td>
                        <td className={`py-4 font-bold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          NT$ {Math.abs(tx.amount)}
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
              {visibleTransactionCount < transactions.length && (
                <button
                  type="button"
                  onClick={() => setVisibleTransactionCount(current => Math.min(current + 10, transactions.length))}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#EAE8E4] bg-[#F9F8F5] px-4 py-3 text-xs font-bold text-[#555555] transition-all hover:border-[#EA5B3C] hover:bg-white hover:text-[#EA5B3C]"
                >
                  查看更多
                </button>
              )}
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
                        {item.note}
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
