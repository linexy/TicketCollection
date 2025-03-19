import express from 'express';
import { BaseTicket } from '../models/BaseTicket';
import { TrainTicket } from '../models/TrainTicket';
import { FlightTicket } from '../models/FlightTicket';
import { sequelize } from '../config/database';
import { Op, QueryTypes } from 'sequelize';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, addYears, getYear, startOfWeek, endOfWeek, getWeek, addWeeks, differenceInDays } from 'date-fns';
import Station from '../models/Station';

const router = express.Router();

// 火车票统计
router.get('/train', async (req, res) => {
  try {
    const { startDate, endDate, groupBy, trendGroupBy } = req.query;
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    // 判断时间跨度
    const start = startDate ? parseISO(startDate as string) : new Date(2013, 3, 1);
    const end = endDate ? parseISO(endDate as string) : new Date();
    
    // 计算时间差（天数）
    const diffInDays = differenceInDays(end, start);
    
    // 计算总计数据的分组方式
    let useYearlyGrouping = groupBy === 'year' || (getYear(end) - getYear(start) > 3);
    let useWeeklyGrouping = !useYearlyGrouping && diffInDays <= 60 && groupBy !== 'month'; // 2个月约60天
    
    // 计算趋势数据的分组方式
    let useTrendYearlyGrouping = trendGroupBy === 'year' || (getYear(end) - getYear(start) > 3);
    let useTrendWeeklyGrouping = !useTrendYearlyGrouping && diffInDays <= 60 && trendGroupBy === 'week';
    
    // 获取趋势数据的时间列表
    let trendTimeList = [];
    
    if (useTrendYearlyGrouping) {
      // 按年统计趋势
      let currentYear = startOfYear(start);
      const lastYear = endOfYear(end);
      
      while (currentYear <= lastYear) {
        trendTimeList.push({
          start: format(currentYear, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(endOfYear(currentYear), 'yyyy-MM-dd') + ' 23:59:59',
          label: format(currentYear, 'yyyy')
        });
        currentYear = addYears(currentYear, 1);
      }
    } else if (useTrendWeeklyGrouping) {
      // 按周统计趋势
      let currentWeek = startOfWeek(start, { weekStartsOn: 1 }); // 周一作为每周第一天
      const lastWeek = endOfWeek(end, { weekStartsOn: 1 });
      
      while (currentWeek <= lastWeek) {
        const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
        trendTimeList.push({
          start: format(currentWeek, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(weekEnd, 'yyyy-MM-dd') + ' 23:59:59',
          label: `第${getWeek(currentWeek, { weekStartsOn: 1 })}周`
        });
        currentWeek = addWeeks(currentWeek, 1);
      }
    } else {
      // 按月统计趋势
      let currentMonth = startOfMonth(start);
      const lastMonth = endOfMonth(end);
      
      while (currentMonth <= lastMonth) {
        trendTimeList.push({
          start: format(currentMonth, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(endOfMonth(currentMonth), 'yyyy-MM-dd') + ' 23:59:59',
          label: format(currentMonth, 'yyyy-MM')
        });
        currentMonth = addMonths(currentMonth, 1);
      }
    }
    
    // 使用原始SQL查询获取每个时间段的出行数据
    const trendDataPromises = trendTimeList.map(async (time) => {
      // 合并计数和费用查询为一个查询
      const statsQuery = `
        SELECT 
          COUNT(*) as count,
          SUM(BT.price) as expense
        FROM BaseTickets as BT
        INNER JOIN TrainTickets as TT ON BT.id = TT.baseTicketId
        WHERE BT.departureTime BETWEEN :startDate AND :endDate
      `;
      
      const [statsResult] = await sequelize.query(statsQuery, {
        replacements: { 
          startDate: time.start, 
          endDate: time.end 
        },
        type: QueryTypes.SELECT
      });
      
      return {
        date: time.label,
        count: parseInt((statsResult as any).count as string) || 0,
        expense: parseFloat((statsResult as any).expense as string) || 0
      };
    });
    
    const trendData = await Promise.all(trendDataPromises);
    
    // 合并所有统计查询为一个查询
    const overallStatsQuery = `
      SELECT 
        COUNT(*) as totalCount,
        SUM(BT.price) as totalExpense,
        SUM(BT.distance) as totalDistance,
        SUM(TIMESTAMPDIFF(MINUTE, BT.departureTime, BT.arrivalTime)) as totalMinutes,
        COUNT(DISTINCT TT.trainNo) as uniqueTrains
      FROM 
        BaseTickets as BT
        INNER JOIN TrainTickets as TT ON BT.id = TT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
    `;
    
    const [overallStats] = await sequelize.query(overallStatsQuery, {
      replacements: { 
        startDate: (startDate || '2013-04-01') + ' 00:00:00', 
        endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
      },
      type: QueryTypes.SELECT
    });
    
    // 计算总时长（小时）和总里程（万公里）
    const totalHours = parseInt((overallStats as any).totalMinutes || '0') / 60;
    const totalDistance = parseFloat((overallStats as any).totalDistance || '0') / 10000;
    const uniqueTrains = parseInt((overallStats as any).uniqueTrains || '0');
    
    // 获取车型统计数据
    const trainTypesQuery = `
      SELECT 
        TT.trainType as type,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN TrainTickets as TT ON BT.id = TT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
        AND TT.trainType IS NOT NULL
        AND TT.trainType != ''
      GROUP BY 
        TT.trainType
      ORDER BY 
        count DESC
    `;
    
    // 获取路线数据
    const routeQuery = `
      SELECT 
        CONCAT(BT.departureStation, '-', BT.arrivalStation) as route,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN TrainTickets as TT ON BT.id = TT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
      GROUP BY 
        BT.departureStation, BT.arrivalStation
      ORDER BY 
        count DESC
      LIMIT 10
    `;
    
    // 获取所有路线数据（用于计算总站点数）
    const allRoutesQuery = `
      SELECT 
        CONCAT(BT.departureStation, '-', BT.arrivalStation) as route,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN TrainTickets as TT ON BT.id = TT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
      GROUP BY 
        BT.departureStation, BT.arrivalStation
    `;
    
    // 并行执行路线和车型查询
    const [routeResults, allRoutesResults, trainTypesResults] = await Promise.all([
      sequelize.query(routeQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      }),
      sequelize.query(allRoutesQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      }),
      sequelize.query(trainTypesQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      })
    ]);
    
    const routeData = Array.isArray(routeResults) 
      ? routeResults.map((item: any) => ({
          route: item.route,
          count: parseInt(item.count)
        }))
      : [];
    
    const allRoutes = Array.isArray(allRoutesResults) 
      ? allRoutesResults.map((item: any) => ({
          route: item.route,
          count: parseInt(item.count)
        }))
      : [];

    const vehicleTypes = Array.isArray(trainTypesResults) 
      ? trainTypesResults.map((item: any) => ({
          type: item.type,
          count: parseInt(item.count)
        }))
      : [];
    
    res.json({
      success: true,
      data: {
        trendData,
        routeData,
        allRoutes,
        vehicleTypes,
        totalHours,
        totalDistance,
        uniqueTrains,
        totalCount: parseInt((overallStats as any).totalCount || '0'),
        totalExpense: parseFloat((overallStats as any).totalExpense || '0')
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

// 飞机票统计
router.get('/flight', async (req, res) => {
  try {
    const { startDate, endDate, groupBy, trendGroupBy } = req.query;
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    // 判断时间跨度
    const start = startDate ? parseISO(startDate as string) : new Date(2013, 3, 1);
    const end = endDate ? parseISO(endDate as string) : new Date();
    
    // 计算时间差（天数）
    const diffInDays = differenceInDays(end, start);
    
    // 计算总计数据的分组方式
    let useYearlyGrouping = groupBy === 'year' || (getYear(end) - getYear(start) > 3);
    let useWeeklyGrouping = !useYearlyGrouping && diffInDays <= 60 && groupBy !== 'month'; // 2个月约60天
    
    // 计算趋势数据的分组方式
    let useTrendYearlyGrouping = trendGroupBy === 'year' || (getYear(end) - getYear(start) > 3);
    let useTrendWeeklyGrouping = !useTrendYearlyGrouping && diffInDays <= 60 && trendGroupBy === 'week';
    
    // 获取趋势数据的时间列表
    let trendTimeList = [];
    
    if (useTrendYearlyGrouping) {
      // 按年统计趋势
      let currentYear = startOfYear(start);
      const lastYear = endOfYear(end);
      
      while (currentYear <= lastYear) {
        trendTimeList.push({
          start: format(currentYear, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(endOfYear(currentYear), 'yyyy-MM-dd') + ' 23:59:59',
          label: format(currentYear, 'yyyy')
        });
        currentYear = addYears(currentYear, 1);
      }
    } else if (useTrendWeeklyGrouping) {
      // 按周统计趋势
      let currentWeek = startOfWeek(start, { weekStartsOn: 1 }); // 周一作为每周第一天
      const lastWeek = endOfWeek(end, { weekStartsOn: 1 });
      
      while (currentWeek <= lastWeek) {
        const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
        trendTimeList.push({
          start: format(currentWeek, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(weekEnd, 'yyyy-MM-dd') + ' 23:59:59',
          label: `第${getWeek(currentWeek, { weekStartsOn: 1 })}周`
        });
        currentWeek = addWeeks(currentWeek, 1);
      }
    } else {
      // 按月统计趋势
      let currentMonth = startOfMonth(start);
      const lastMonth = endOfMonth(end);
      
      while (currentMonth <= lastMonth) {
        trendTimeList.push({
          start: format(currentMonth, 'yyyy-MM-dd') + ' 00:00:00',
          end: format(endOfMonth(currentMonth), 'yyyy-MM-dd') + ' 23:59:59',
          label: format(currentMonth, 'yyyy-MM')
        });
        currentMonth = addMonths(currentMonth, 1);
      }
    }
    
    // 使用原始SQL查询获取每个时间段的出行数据
    const trendDataPromises = trendTimeList.map(async (time) => {
      // 合并计数和费用查询为一个查询
      const statsQuery = `
        SELECT 
          COUNT(*) as count,
          SUM(BT.price) as expense
        FROM BaseTickets as BT
        INNER JOIN FlightTickets as FT ON BT.id = FT.baseTicketId
        WHERE BT.departureTime BETWEEN :startDate AND :endDate
      `;
      
      const [statsResult] = await sequelize.query(statsQuery, {
        replacements: { 
          startDate: time.start, 
          endDate: time.end 
        },
        type: QueryTypes.SELECT
      });
      
      return {
        date: time.label,
        count: parseInt((statsResult as any).count as string) || 0,
        expense: parseFloat((statsResult as any).expense as string) || 0
      };
    });
    
    const trendData = await Promise.all(trendDataPromises);
    
    // 合并所有统计查询为一个查询
    const overallStatsQuery = `
      SELECT 
        COUNT(*) as totalCount,
        SUM(BT.price) as totalExpense,
        SUM(BT.distance) as totalDistance,
        SUM(TIMESTAMPDIFF(MINUTE, BT.departureTime, BT.arrivalTime)) as totalMinutes,
        COUNT(DISTINCT FT.flightNo) as uniqueTrains
      FROM 
        BaseTickets as BT
        INNER JOIN FlightTickets as FT ON BT.id = FT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
    `;
    
    const [overallStats] = await sequelize.query(overallStatsQuery, {
      replacements: { 
        startDate: (startDate || '2013-04-01') + ' 00:00:00', 
        endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
      },
      type: QueryTypes.SELECT
    });
    
    // 计算总时长（小时）和总里程（万公里）
    const totalHours = parseInt((overallStats as any).totalMinutes || '0') / 60;
    const totalDistance = parseFloat((overallStats as any).totalDistance || '0') / 10000;
    const uniqueTrains = parseInt((overallStats as any).uniqueTrains || '0');
    
    // 获取机型统计数据
    const flightTypesQuery = `
      SELECT 
        FT.flightType as type,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN FlightTickets as FT ON BT.id = FT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
        AND FT.flightType IS NOT NULL
        AND FT.flightType != ''
      GROUP BY 
        FT.flightType
      ORDER BY 
        count DESC
    `;
    
    // 获取路线数据
    const routeQuery = `
      SELECT 
        CONCAT(BT.departureStation, '-', BT.arrivalStation) as route,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN FlightTickets as FT ON BT.id = FT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
      GROUP BY 
        BT.departureStation, BT.arrivalStation
      ORDER BY 
        count DESC
      LIMIT 10
    `;
    
    // 获取所有路线数据（用于计算总站点数）
    const allRoutesQuery = `
      SELECT 
        CONCAT(BT.departureStation, '-', BT.arrivalStation) as route,
        COUNT(*) as count
      FROM 
        BaseTickets as BT
        INNER JOIN FlightTickets as FT ON BT.id = FT.baseTicketId
      WHERE 
        BT.departureTime BETWEEN :startDate AND :endDate
      GROUP BY 
        BT.departureStation, BT.arrivalStation
    `;
    
    // 并行执行路线查询和机型查询
    const [routeResults, allRoutesResults, flightTypesResults] = await Promise.all([
      sequelize.query(routeQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      }),
      sequelize.query(allRoutesQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      }),
      sequelize.query(flightTypesQuery, {
        replacements: { 
          startDate: (startDate || '2013-04-01') + ' 00:00:00', 
          endDate: (endDate || format(endOfMonth(new Date()), 'yyyy-MM-dd')) + ' 23:59:59' 
        },
        type: QueryTypes.SELECT
      })
    ]);
    
    const routeData = Array.isArray(routeResults) 
      ? routeResults.map((item: any) => ({
          route: item.route,
          count: parseInt(item.count)
        }))
      : [];
    
    const allRoutes = Array.isArray(allRoutesResults) 
      ? allRoutesResults.map((item: any) => ({
          route: item.route,
          count: parseInt(item.count)
        }))
      : [];
      
    const vehicleTypes = Array.isArray(flightTypesResults) 
      ? flightTypesResults.map((item: any) => ({
          type: item.type,
          count: parseInt(item.count)
        }))
      : [];
    
    res.json({
      success: true,
      data: {
        trendData,
        routeData,
        allRoutes,
        vehicleTypes,
        totalHours,
        totalDistance,
        uniqueTrains,
        totalCount: parseInt((overallStats as any).totalCount || '0'),
        totalExpense: parseFloat((overallStats as any).totalExpense || '0')
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

// 获取车站地图数据
router.get('/stations-map', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    // 获取用户乘坐过的所有车票
    const tickets = await BaseTicket.findAll({
      where: {
        ...dateFilter,
        ticketType: '火车票'
      },
      attributes: ['departureStation', 'arrivalStation', 'distance'],
      raw: true
    });

    // 提取所有独特的站点
    const stationNames = new Set<string>();
    const routes = new Map<string, number>();
    let totalDistance = 0;

    tickets.forEach(ticket => {
      const { departureStation, arrivalStation, distance } = ticket;
      stationNames.add(departureStation);
      stationNames.add(arrivalStation);
      
      // 累加总里程
      if (distance) {
        totalDistance += distance;
      }
      
      // 统计路线使用次数
      const routeKey = `${departureStation}-${arrivalStation}`;
      routes.set(routeKey, (routes.get(routeKey) || 0) + 1);
    });

    // 获取站点的经纬度信息
    const stations = await Station.findAll({
      where: {
        stationName: {
          [Op.in]: Array.from(stationNames)
        }
      },
      attributes: ['stationName', 'latitude', 'longitude'],
      raw: true
    });

    // 构建路线数据
    const routeData = Array.from(routes.entries()).map(([route, count]) => {
      const [from, to] = route.split('-');
      return { from, to, count };
    });

    // 按使用次数排序
    routeData.sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        stations,
        routes: routeData,
        totalDistance
      }
    });
  } catch (error) {
    console.error('获取车站地图数据失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取车站地图数据失败'
    });
  }
});

// 获取所有车票数据
router.get('/tickets', async (req, res) => {
  try {
    const { startDate, endDate, ticketType } = req.query;
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    let typeFilter: any = {};
    if (ticketType) {
      typeFilter = {
        ticketType
      };
    }

    // 获取所有符合条件的车票
    const tickets = await BaseTicket.findAll({
      where: {
        ...dateFilter,
        ...typeFilter
      },
      attributes: ['id', 'departureStation', 'arrivalStation', 'departureTime', 'arrivalTime'],
      raw: true
    });

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('获取车票数据失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取车票数据失败'
    });
  }
});

export default router; 