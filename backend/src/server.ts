import express from 'express';
import cors from 'cors';
import { sequelize } from './config/database';
import { BaseTicket, TrainTicket, FlightTicket, User, TrainStopCache } from './models/index';
import authRouter from './routes/auth';
import { Op } from 'sequelize';
import ocrRouter from './routes/ocr';
import { TrainTypeService } from './services/trainType.service';
import { StationDistanceService } from './services/stationDistance.service';
import pushRouter from './routes/push';
import mapRouter from './routes/map';
import { PushNotificationService } from './services/pushNotification.service';
import statisticsRouter from './routes/statistics';
import trainsRouter from './routes/trains';
import { getStopInfoParams, getTrainStopInfo } from './services/trainService';
import { TrainTypeSchedulerService } from './services/trainTypeScheduler.service';
import { verifyToken } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 数据库连接
sequelize.authenticate()
  .then(async () => {
    console.log('数据库连接成功');
    // await sequelize.sync({ alter: true });
    
    // 重新加载所有待处理的通知任务
    await PushNotificationService.reloadPendingJobs();
    
    // 初始化所有火车票的车型更新任务
    const scheduledCount = await TrainTypeSchedulerService.initializeAllUpdateTasks();
    console.log(`已初始化 ${scheduledCount} 个车型更新任务`);
    
  })
  .catch((err: Error) => {
    console.error('数据库连接失败:', err);
  });

// 获取所有票据
app.get('/api/tickets', verifyToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 20,
      startDate,
      endDate,
      ticketType
    } = req.query;

    // 构建日期过滤条件
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    // 基础查询选项 - 火车票
    const trainQueryOptions = {
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        required: true,
        where: dateFilter
      }],
      attributes: ['id', 'trainNo', 'seatType', 'carNo', 'seatNo', 'orderNo', 'trainType', 'checkingPort'],
      order: [
        [{ model: BaseTicket, as: 'baseTicket' }, 'departureTime', 'DESC'] as any
      ],
      offset: ((Number(page) - 1) * Number(pageSize)),
      limit: Number(pageSize)
    };
    
    // 基础查询选项 - 飞机票
    const flightQueryOptions = {
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        required: true,
        where: dateFilter
      }],
      attributes: ['id', 'flightNo', 'flightType', 'airlineCompany', 'ticketNo', 'mileage'],
      order: [
        [{ model: BaseTicket, as: 'baseTicket' }, 'departureTime', 'DESC'] as any
      ],
      offset: ((Number(page) - 1) * Number(pageSize)),
      limit: Number(pageSize)
    };

    // 分别查询火车票和飞机票的总数和分页数据
    let trainTickets: TrainTicket[] = [], 
        flightTickets: FlightTicket[] = [], 
        trainTotal = 0, 
        flightTotal = 0;

    if (!ticketType || ticketType === 'train') {
      [trainTickets, trainTotal] = await Promise.all([
        TrainTicket.findAll(trainQueryOptions),
        TrainTicket.count({
          include: [{
            model: BaseTicket,
            as: 'baseTicket',
            required: true,
            where: dateFilter
          }]
        })
      ]);
    }

    if (!ticketType || ticketType === 'flight') {
      [flightTickets, flightTotal] = await Promise.all([
        FlightTicket.findAll(flightQueryOptions),
        FlightTicket.count({
          include: [{
            model: BaseTicket,
            as: 'baseTicket',
            required: true,
            where: dateFilter
          }]
        })
      ]);
    }

    res.json({
      success: true,
      data: {
        trainTickets,
        flightTickets,
        pagination: {
          trainTotal,
          flightTotal,
          page: Number(page),
          pageSize: Number(pageSize)
        }
      }
    });
  } catch (error) {
    console.error('获取票据失败:', error);
    res.status(500).json({ 
      success: false,
      message: '获取票据失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 添加火车票
app.post('/api/tickets/train', verifyToken, async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const requiredFields = [
      'departureStation', 
      'departureTime',
      'price', 
      'trainNo', 
      'seatType'
    ];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const trainType = await TrainTypeService.getTrainType(req.body.trainNo, req.body.departureTime);
    const distance = await StationDistanceService.getDistance(
      req.body.departureStation,
      req.body.arrivalStation || ''
    );

    const baseTicket = await BaseTicket.create({
      ticketType: '火车票',
      departureStation: req.body.departureStation,
      arrivalStation: req.body.arrivalStation || '',
      departureTime: req.body.departureTime,
      arrivalTime: req.body.arrivalTime || req.body.departureTime,
      price: req.body.price,
      distance: distance || 0
    }, { transaction: t });

    const trainTicket = await TrainTicket.create({
      trainNo: req.body.trainNo,
      seatType: req.body.seatType,
      carNo: req.body.carNo || '',
      seatNo: req.body.seatNo || '',
      orderNo: req.body.orderNo || '',
      trainType: trainType,
      baseTicketId: baseTicket.id
    }, { transaction: t });

    await t.commit();


    // 为所有用户添加通知任务
    const users = await User.findAll();
    for (const user of users) {
      await PushNotificationService.scheduleTrainNotification({
        ...trainTicket.toJSON(),
        baseTicket: baseTicket.toJSON()
      }, user.id);
    }

    // 清除待出行车票缓存
    clearUpcomingTicketsCache();

    // 自动缓存该车票的时刻表信息
    try {
      // 获取查询参数
      const params = await getStopInfoParams(trainTicket.id);

      // 调用API获取并缓存经停站信息
      await getTrainStopInfo(
        params.trainNo,
        params.fromStationCode,
        params.toStationCode,
        params.departDate,
        trainTicket.id,  // 传入车票ID用于缓存
        params.departureStation,
        params.arrivalStation
      );

      console.log(`已自动缓存车票ID ${trainTicket.id} 的时刻表信息`);
    } catch (cacheError) {
      console.error('自动缓存时刻表信息失败:', cacheError);
      // 缓存失败不影响正常返回
    }
    
    // 设置车型更新任务（出发前1小时）
    try {
      await TrainTypeSchedulerService.scheduleSingleTicketTypeUpdate({
        id: trainTicket.id,
        trainNo: trainTicket.trainNo,
        baseTicket: baseTicket
      });
      console.log(`已设置车票ID ${trainTicket.id} 的车型更新任务`);
    } catch (updateError) {
      console.error('设置车型更新任务失败:', updateError);
      // 设置失败不影响正常返回
    }

    res.status(201).json({
      success: true,
      message: '火车票添加成功',
      ticket: {
        id: trainTicket.id,
        trainNo: trainTicket.trainNo,
        seatType: trainTicket.seatType,
        carNo: trainTicket.carNo,
        seatNo: trainTicket.seatNo,
        orderNo: trainTicket.orderNo,
        trainType: trainTicket.trainType,
        baseTicket: {
          id: baseTicket.id,
          ticketType: baseTicket.ticketType,
          departureStation: baseTicket.departureStation,
          arrivalStation: baseTicket.arrivalStation,
          departureTime: baseTicket.departureTime,
          arrivalTime: baseTicket.arrivalTime,
          price: baseTicket.price,
          distance: baseTicket.distance
        }
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('添加火车票失败:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : '添加火车票失败'
    });
  }
});

// 添加飞机票
app.post('/api/tickets/flight', verifyToken, async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    // 只保留必填字段，确保price不在列表中
    const requiredFields = [
      'departure',
      'destination',
      'takeoffTime',
      'flightNo',
      'airlineCompany'
    ];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        throw new Error(`缺少必填字段: ${field}`);
      }
    }

    const baseTicket = await BaseTicket.create({
      ticketType: '飞机票',
      departureStation: req.body.departure,
      arrivalStation: req.body.destination,
      departureTime: req.body.takeoffTime,
      arrivalTime: req.body.arrivalTime || req.body.takeoffTime,
      price: req.body.price || 0  // 如果价格为空，默认为0
    }, { transaction: t });

    const flightTicket = await FlightTicket.create({
      ticketNo: req.body.ticketNo || '',
      departureDate: req.body.departureDate || '',
      airlineCompany: req.body.airlineCompany,
      flightNo: req.body.flightNo,
      mileage: req.body.mileage || 0,
      baseTicketId: baseTicket.id
    }, { transaction: t });

    await t.commit();
    
    // 清除待出行车票缓存
    clearUpcomingTicketsCache();
    
    res.status(201).json({ baseTicket, flightTicket });
  } catch (error) {
    await t.rollback();
    console.error('添加飞机票失败:', error);
    res.status(400).json({ 
      message: error instanceof Error ? error.message : '添加飞机票失败' 
    });
  }
});

// 获取票据统计信息
app.get('/api/tickets/statistics', verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, ticketType } = req.query;

    // 构建日期过滤条件
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        departureTime: {
          [Op.between]: [startDate, endDate]
        }
      };
    }

    let trainStats = null, flightStats = null;

    if (!ticketType || ticketType === 'train') {
      const trainTickets = await TrainTicket.findAll({
        include: [{
          model: BaseTicket,
          as: 'baseTicket',
          required: true,
          where: dateFilter
        }],
        attributes: ['id', 'trainNo', 'seatType', 'carNo', 'seatNo', 'orderNo', 'trainType', 'checkingPort']
      });

      trainStats = {
        totalTickets: trainTickets.length,
        uniqueTrains: new Set(trainTickets.map(t => t.trainNo)).size,
        totalPrice: trainTickets.reduce((sum, t) => sum + Number(t.baseTicket.price), 0),
        uniqueStations: new Set([
          ...trainTickets.map(t => t.baseTicket.departureStation),
          ...trainTickets.map(t => t.baseTicket.arrivalStation)
        ]).size
      };
    }

    if (!ticketType || ticketType === 'flight') {
      const flightTickets = await FlightTicket.findAll({
        include: [{
          model: BaseTicket,
          as: 'baseTicket',
          required: true,
          where: dateFilter
        }],
        attributes: ['id', 'flightNo', 'flightType', 'airlineCompany', 'ticketNo', 'mileage']
      });

      flightStats = {
        totalTickets: flightTickets.length,
        uniqueFlights: new Set(flightTickets.map(t => t.flightNo)).size,
        totalPrice: flightTickets.reduce((sum, t) => sum + Number(t.baseTicket.price), 0),
        uniqueStations: new Set([
          ...flightTickets.map(t => t.baseTicket.departureStation),
          ...flightTickets.map(t => t.baseTicket.arrivalStation)
        ]).size
      };
    }

    res.json({
      success: true,
      data: {
        trainStats,
        flightStats
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

// 添加OCR路由
app.use('/api/ocr', verifyToken, ocrRouter);

app.use('/api/auth', authRouter);

app.use('/api/push', pushRouter);

// 添加百度地图API代理路由
// 不再对整个路径应用认证中间件，认证已在路由内部处理
app.use('/api/map', mapRouter);


// 获取所有定时推送任务
app.get('/api/push/jobs', verifyToken, async (req, res) => {
  try {
    const jobsInfo = await PushNotificationService.getScheduledJobs();
    res.json({
      success: true,
      ...jobsInfo
    });
  } catch (error) {
    console.error('获取定时任务失败:', error);
    res.status(500).json({ success: false, message: '获取定时任务失败' });
  }
});

// 添加新路由
app.use('/api/statistics', verifyToken, statisticsRouter);

// 添加列车路由
app.use('/api/trains', verifyToken, trainsRouter);

// 手动触发车型更新
app.post('/api/trains/update-train-types', verifyToken, async (req, res) => {
  try {
    // 可以限制数量
    const limit = req.body.limit ? parseInt(req.body.limit) : 0;
    
    // 初始化更新任务
    const scheduledCount = await TrainTypeSchedulerService.initializeAllUpdateTasks();
    
    res.json({
      success: true,
      message: `成功为 ${scheduledCount} 张车票设置车型更新任务`,
      count: scheduledCount
    });
  } catch (error) {
    console.error('初始化车型更新任务失败:', error);
    res.status(500).json({
      success: false,
      message: '初始化车型更新任务失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 手动更新单个车票的车型
app.post('/api/trains/update-train-type/:ticketId', verifyToken, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    
    if (isNaN(ticketId)) {
      return res.status(400).json({
        success: false,
        message: '无效的车票ID'
      });
    }
    
    // 调用服务立即更新
    const result = await TrainTypeSchedulerService.updateTrainTypeImmediately(ticketId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          ticketId,
          oldType: result.oldType,
          newType: result.newType
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('手动更新车型失败:', error);
    res.status(500).json({
      success: false,
      message: '手动更新车型失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 添加缓存机制
let upcomingTicketsCache: any = null;
let upcomingTicketsCacheTime: number = 0;
const CACHE_EXPIRY_TIME = 30 * 60 * 1000; // 将缓存时间从5分钟延长到30分钟

// 清除缓存的函数
const clearUpcomingTicketsCache = () => {
  upcomingTicketsCache = null;
  upcomingTicketsCacheTime = 0;
};

// 获取待出行的车票
app.get('/api/tickets/upcoming', verifyToken, async (req, res) => {
  try {
    const now = Date.now();
    
    // 如果缓存有效，直接返回缓存数据
    if (upcomingTicketsCache && (now - upcomingTicketsCacheTime < CACHE_EXPIRY_TIME)) {
      return res.json(upcomingTicketsCache);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 构建日期过滤条件：只获取今天及以后的车票
    const dateFilter = {
      departureTime: {
        [Op.gte]: today
      }
    };

    // 优化查询：只查询必要的字段，减少数据传输量
    const trainTickets = await TrainTicket.findAll({
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        required: true,
        where: dateFilter,
        attributes: ['id', 'departureStation', 'arrivalStation', 'departureTime', 'arrivalTime', 'price', 'distance', 'ticketType']
      }],
      attributes: ['id', 'trainNo', 'seatType', 'carNo', 'seatNo', 'orderNo', 'trainType', 'checkingPort'],
      order: [
        [{ model: BaseTicket, as: 'baseTicket' }, 'departureTime', 'ASC'] as any
      ],
      limit: 50 // 限制返回数量，提高性能
    });

    // 查询飞机票
    const flightTickets = await FlightTicket.findAll({
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        required: true,
        where: dateFilter,
        attributes: ['id', 'departureStation', 'arrivalStation', 'departureTime', 'arrivalTime', 'price', 'distance', 'ticketType']
      }],
      attributes: ['id', 'flightNo', 'flightType', 'airlineCompany', 'ticketNo', 'mileage'],
      order: [
        [{ model: BaseTicket, as: 'baseTicket' }, 'departureTime', 'ASC'] as any
      ],
      limit: 50 // 限制返回数量，提高性能
    });

    // 合并结果并按出发时间排序
    const allTickets = [...trainTickets, ...flightTickets].sort((a, b) => {
      const timeA = new Date(a.baseTicket.departureTime).getTime();
      const timeB = new Date(b.baseTicket.departureTime).getTime();
      return timeA - timeB;
    });

    // 更新缓存
    upcomingTicketsCache = allTickets;
    upcomingTicketsCacheTime = now;

    res.json(allTickets);
  } catch (error) {
    console.error('获取待出行车票失败:', error);
    res.status(500).json({ message: '获取待出行车票失败' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});