import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const CATEGORY_ORDER_KEY_PREFIX = 'restaurantCategoryOrder:';
const MENU_IMAGE_KEY_PREFIX = 'restaurantMenuImage:';
const DEADLINE_DATE_KEY_PREFIX = 'scheduleOrderDeadlineDate:';
const SCHEDULE_RESTAURANTS_KEY_PREFIX = 'scheduleRestaurants:';
const SCHEDULE_ANNOUNCEMENT_KEY_PREFIX = 'scheduleAnnouncement:';

// Helper to get date string YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  let month = '' + (d.getMonth() + 1);
  let day = '' + d.getDate();
  const year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
}

function formatOrderNumberDisplay(orderNumber) {
  if (!orderNumber) return null;
  const serial = parseInt(orderNumber.slice(-3), 10);
  if (Number.isNaN(serial)) return orderNumber.slice(-2);
  return String(serial).padStart(2, '0');
}

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let startDateStr = searchParams.get('startDate');
    let endDateStr = searchParams.get('endDate');

    // Default range: 7 days ago to 14 days ahead
    if (!startDateStr || !endDateStr) {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      
      startDateStr = formatDate(start);
      endDateStr = formatDate(end);
    }

    // Get all schedules in range
    const schedules = await prisma.weeklySchedule.findMany({
      where: {
        date: {
          gte: startDateStr,
          lte: endDateStr
        }
      },
      include: {
        restaurant: {
          include: {
            menuItems: {
              where: { isAvailable: true }
            }
          }
        },
        orders: {
          orderBy: {
            orderNumber: 'asc'
          },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            },
            orderItems: {
              include: {
                menuItem: true
              }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });
    const categoryOrderSettings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: CATEGORY_ORDER_KEY_PREFIX } }
    });
    const menuImageSettings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: MENU_IMAGE_KEY_PREFIX } }
    });
    const menuImageByRestaurantId = new Map(menuImageSettings.map(setting => [
      setting.key.slice(MENU_IMAGE_KEY_PREFIX.length),
      setting.value
    ]));
    const deadlineDateSettings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: schedules.map(schedule => `${DEADLINE_DATE_KEY_PREFIX}${schedule.date}`)
        }
      }
    });
    const deadlineDateByScheduleDate = new Map(
      deadlineDateSettings.map(setting => [
        setting.key.slice(DEADLINE_DATE_KEY_PREFIX.length),
        setting.value
      ])
    );
    const scheduleRestaurantSettings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: schedules.map(schedule => `${SCHEDULE_RESTAURANTS_KEY_PREFIX}${schedule.date}`)
        }
      }
    });
    const scheduleAnnouncementSettings = await prisma.siteSetting.findMany({
      where: {
        key: {
          in: schedules.map(schedule => `${SCHEDULE_ANNOUNCEMENT_KEY_PREFIX}${schedule.date}`)
        }
      }
    });
    const announcementByScheduleDate = new Map(scheduleAnnouncementSettings.map(setting => [
      setting.key.slice(SCHEDULE_ANNOUNCEMENT_KEY_PREFIX.length),
      setting.value || ''
    ]));
    const restaurantConfigsByDate = new Map(scheduleRestaurantSettings.map(setting => {
      try {
        const parsed = JSON.parse(setting.value || '[]');
        return [setting.key.slice(SCHEDULE_RESTAURANTS_KEY_PREFIX.length), Array.isArray(parsed) ? parsed : []];
      } catch {
        return [setting.key.slice(SCHEDULE_RESTAURANTS_KEY_PREFIX.length), []];
      }
    }));
    const configuredRestaurantIds = Array.from(new Set(
      Array.from(restaurantConfigsByDate.values()).flatMap(configs => configs.map(config => config.restaurantId)).filter(Boolean)
    ));
    const configuredRestaurants = configuredRestaurantIds.length > 0
      ? await prisma.restaurant.findMany({
          where: { id: { in: configuredRestaurantIds } },
          include: { menuItems: { where: { isAvailable: true } } }
        })
      : [];
    const configuredRestaurantById = new Map(configuredRestaurants.map(restaurant => [restaurant.id, restaurant]));
    const categoryOrderByRestaurantId = new Map(categoryOrderSettings.map(setting => {
      let order = [];
      try {
        const parsed = JSON.parse(setting.value || '[]');
        if (Array.isArray(parsed)) order = parsed;
      } catch {
        order = [];
      }
      return [setting.key.slice(CATEGORY_ORDER_KEY_PREFIX.length), order];
    }));

    // Format schedules to include the current user's order details in a simplified field
    const formattedSchedules = schedules.map(sched => {
      const userOrder = sched.orders.find(o => o.userId === user.userId && o.status !== 'cancelled');
      
      // Calculate order statistics for administrators
      const orderCount = sched.orders.filter(o => o.status !== 'cancelled').length;
      
      const savedRestaurantConfigs = restaurantConfigsByDate.get(sched.date) || [];
      const fallbackRestaurantConfigs = sched.restaurantId ? [{
        restaurantId: sched.restaurantId,
        orderDeadlineDate: deadlineDateByScheduleDate.get(sched.date) || sched.date,
        orderDeadline: sched.orderDeadline || '09:40'
      }] : [];
      const restaurantConfigs = (savedRestaurantConfigs.length > 0 ? savedRestaurantConfigs : fallbackRestaurantConfigs)
        .map(config => {
          const restaurant = configuredRestaurantById.get(config.restaurantId)
            || (sched.restaurantId === config.restaurantId ? sched.restaurant : null);
          if (!restaurant) return null;
          return {
            restaurantId: config.restaurantId,
            orderDeadlineDate: config.orderDeadlineDate || sched.date,
            orderDeadline: config.orderDeadline || '09:40',
            restaurant: {
              ...restaurant,
              menuImageUrl: menuImageByRestaurantId.has(restaurant.id)
                ? `/api/restaurant-menu-image?restaurantId=${restaurant.id}`
                : '',
              categoryOrder: categoryOrderByRestaurantId.get(restaurant.id) || []
            }
          };
        })
        .filter(Boolean);
      const activeOrders = sched.orders.filter(order => order.status !== 'cancelled');
      const restaurantStats = restaurantConfigs.map(config => {
        const matchingOrderIds = new Set();
        let totalAmount = 0;

        activeOrders.forEach(order => {
          order.orderItems.forEach(item => {
            if (item.menuItem?.restaurantId !== config.restaurantId) return;
            matchingOrderIds.add(order.id);
            totalAmount += item.unitPrice * item.quantity;
          });
        });

        return {
          restaurantId: config.restaurantId,
          totalOrders: matchingOrderIds.size,
          totalAmount
        };
      });

      return {
        id: sched.id,
        date: sched.date,
        restaurantId: sched.restaurantId,
        orderDeadline: sched.orderDeadline,
        orderDeadlineDate: deadlineDateByScheduleDate.get(sched.date) || sched.date,
        isOpen: sched.isOpen,
        deliveredAt: sched.deliveredAt,
        restaurant: sched.restaurant ? {
          ...sched.restaurant,
          menuImageUrl: menuImageByRestaurantId.has(sched.restaurant.id)
            ? `/api/restaurant-menu-image?restaurantId=${sched.restaurant.id}`
            : '',
          categoryOrder: categoryOrderByRestaurantId.get(sched.restaurant.id) || []
        } : null,
        restaurantConfigs,
        dailyAnnouncement: announcementByScheduleDate.get(sched.date) || '',
        userOrder: userOrder ? {
          id: userOrder.id,
          orderNumber: userOrder.orderNumber,
          orderNumberDisplay: formatOrderNumberDisplay(userOrder.orderNumber),
          totalAmount: userOrder.totalAmount,
          note: userOrder.note,
          seatArea: userOrder.seatArea,
          status: userOrder.status,
          chargedAt: userOrder.chargedAt,
          items: userOrder.orderItems.map(oi => ({
            id: oi.id,
            menuItemId: oi.menuItemId,
            name: oi.menuItem.name,
            quantity: oi.quantity,
            unitPrice: oi.unitPrice,
            note: oi.note
          }))
        } : null,
        stats: {
          totalOrders: orderCount,
          totalAmount: activeOrders.reduce((sum, order) => sum + order.totalAmount, 0),
          restaurants: restaurantStats
        },
        orders: user.role === 'admin'
          ? sched.orders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber,
            orderNumberDisplay: formatOrderNumberDisplay(order.orderNumber),
            userId: order.userId,
            user: order.user,
            totalAmount: order.totalAmount,
            note: order.note,
            seatArea: order.seatArea,
            status: order.status,
            chargedAt: order.chargedAt,
            orderItems: order.orderItems
          }))
          : undefined
      };
    });

    return NextResponse.json(formattedSchedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const shouldUpdateDailyAnnouncement = Object.prototype.hasOwnProperty.call(body, 'dailyAnnouncement');
    const {
      date,
      restaurantId,
      orderDeadline,
      orderDeadlineDate,
      isOpen = true,
      clearOrdersOnRestaurantChange = false,
      clearRestaurantIds = [],
      restaurantConfigs,
      dailyAnnouncement = ''
    } = body;
    const scheduleIsOpen = Boolean(isOpen);
    const normalizedRestaurantConfigs = scheduleIsOpen
      ? (Array.isArray(restaurantConfigs) && restaurantConfigs.length > 0
          ? restaurantConfigs
          : [{ restaurantId, orderDeadlineDate: orderDeadlineDate || date, orderDeadline: orderDeadline || '09:40' }])
        .filter(config => config?.restaurantId)
        .map(config => ({
          restaurantId: config.restaurantId,
          orderDeadlineDate: config.orderDeadlineDate || date,
          orderDeadline: config.orderDeadline || '09:40'
        }))
      : [];
    const normalizedRestaurantId = normalizedRestaurantConfigs[0]?.restaurantId || null;

    if (!date || (scheduleIsOpen && !normalizedRestaurantId)) {
      return NextResponse.json({ error: 'Date and Restaurant ID are required' }, { status: 400 });
    }
    if (orderDeadlineDate && orderDeadlineDate > date) {
      return NextResponse.json({ error: '訂單截止日期不可晚於供餐日期。' }, { status: 400 });
    }
    if (normalizedRestaurantConfigs.some(config => config.orderDeadlineDate > date)) {
      return NextResponse.json({ error: '訂單截止日期不可晚於供餐日期。' }, { status: 400 });
    }
    if (new Set(normalizedRestaurantConfigs.map(config => config.restaurantId)).size !== normalizedRestaurantConfigs.length) {
      return NextResponse.json({ error: '同一間餐廳不可重複加入。' }, { status: 400 });
    }

    const today = formatDate(new Date());
    if (date < today) {
      return NextResponse.json({ error: '供餐日期已過，無法進行設定。' }, { status: 400 });
    }

    const schedule = await prisma.$transaction(async (tx) => {
      const existingSchedule = await tx.weeklySchedule.findUnique({
        where: { date },
        include: {
          orders: {
            where: {
              status: { not: 'cancelled' }
            },
            select: { id: true }
          }
        }
      });

      const existingRestaurantSetting = await tx.siteSetting.findUnique({
        where: { key: `${SCHEDULE_RESTAURANTS_KEY_PREFIX}${date}` }
      });
      let previousRestaurantConfigs = [];
      try {
        previousRestaurantConfigs = existingRestaurantSetting?.value
          ? JSON.parse(existingRestaurantSetting.value)
          : [];
      } catch {
        previousRestaurantConfigs = [];
      }
      if (previousRestaurantConfigs.length === 0 && existingSchedule?.restaurantId) {
        previousRestaurantConfigs = [{ restaurantId: existingSchedule.restaurantId }];
      }
      const changedRestaurantIds = previousRestaurantConfigs
        .filter((config, index) => config?.restaurantId && normalizedRestaurantConfigs[index]?.restaurantId !== config.restaurantId)
        .map(config => config.restaurantId);
      const requestedClearIds = new Set(Array.isArray(clearRestaurantIds) ? clearRestaurantIds : []);
      const restaurantChanged = changedRestaurantIds.length > 0;
      const hasActiveOrders = (existingSchedule?.orders?.length || 0) > 0;

      if (restaurantChanged && hasActiveOrders && !clearOrdersOnRestaurantChange) {
        throw new Error('Restaurant change requires clearing existing orders');
      }

      if (restaurantChanged && hasActiveOrders && clearOrdersOnRestaurantChange) {
        const restaurantIdsToClear = changedRestaurantIds.filter(id => requestedClearIds.has(id));
        if (restaurantIdsToClear.length !== changedRestaurantIds.length) {
          throw new Error('Restaurant change requires clearing existing orders');
        }

        const affectedOrders = await tx.order.findMany({
          where: { scheduleId: existingSchedule.id, status: { not: 'cancelled' } },
          include: { orderItems: { include: { menuItem: { select: { restaurantId: true } } } } }
        });

        for (const order of affectedOrders) {
          const itemsToRemove = order.orderItems.filter(item => restaurantIdsToClear.includes(item.menuItem.restaurantId));
          if (itemsToRemove.length === 0) continue;

          await tx.orderItem.deleteMany({ where: { id: { in: itemsToRemove.map(item => item.id) } } });
          const remainingItems = order.orderItems.filter(item => !restaurantIdsToClear.includes(item.menuItem.restaurantId));
          if (remainingItems.length === 0) {
            await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled', totalAmount: 0 } });
          } else {
            const totalAmount = remainingItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
            await tx.order.update({ where: { id: order.id }, data: { totalAmount } });
          }
        }
      }

      const savedSchedule = await tx.weeklySchedule.upsert({
        where: { date },
        update: {
          restaurantId: normalizedRestaurantId,
          orderDeadline: orderDeadline || '09:40',
          isOpen: scheduleIsOpen
        },
        create: {
          date,
          restaurantId: normalizedRestaurantId,
          orderDeadline: orderDeadline || '09:40',
          isOpen: scheduleIsOpen
        }
      });

      if (existingSchedule?.deliveredAt) {
        throw new Error('Delivered schedule is locked');
      }

      await tx.siteSetting.upsert({
        where: { key: `${DEADLINE_DATE_KEY_PREFIX}${date}` },
        update: { value: orderDeadlineDate || date },
        create: {
          key: `${DEADLINE_DATE_KEY_PREFIX}${date}`,
          value: orderDeadlineDate || date
        }
      });
      await tx.siteSetting.upsert({
        where: { key: `${SCHEDULE_RESTAURANTS_KEY_PREFIX}${date}` },
        update: { value: JSON.stringify(normalizedRestaurantConfigs) },
        create: {
          key: `${SCHEDULE_RESTAURANTS_KEY_PREFIX}${date}`,
          value: JSON.stringify(normalizedRestaurantConfigs)
        }
      });
      if (shouldUpdateDailyAnnouncement) {
        await tx.siteSetting.upsert({
          where: { key: `${SCHEDULE_ANNOUNCEMENT_KEY_PREFIX}${date}` },
          update: { value: String(dailyAnnouncement || '') },
          create: {
            key: `${SCHEDULE_ANNOUNCEMENT_KEY_PREFIX}${date}`,
            value: String(dailyAnnouncement || '')
          }
        });
      }

      return savedSchedule;
    });

    return NextResponse.json(schedule);
  } catch (error) {
    const status = error.message === 'Restaurant change requires clearing existing orders'
      ? 409
      : error.message === 'Delivered schedule is locked'
        ? 409
        : 500;
    if (error.message === 'Delivered schedule is locked') {
      return NextResponse.json({ error: '扣款結算完成後，無法再變更排程設定。' }, { status });
    }
    return NextResponse.json({ error: error.message }, { status });
  }
}
