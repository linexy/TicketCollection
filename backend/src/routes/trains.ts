import express from 'express';
import { fetchAndSaveTrains, getAllTrains, searchTrains, getTrainStopInfo, getStopInfoParams, cacheTimetableForAllTickets } from '../services/trainService';
//import { updateCheckingPort, scheduleCheckingPortUpdates } from '../services/checkingPortService';

const router = express.Router();

// 获取所有车次 (分页)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    
    const trains = await getAllTrains(limit, offset);
    res.json({
      total: trains.count,
      page,
      limit,
      totalPages: Math.ceil(trains.count / limit),
      data: trains.rows
    });
  } catch (error) {
    console.error('获取车次列表失败:', error);
    res.status(500).json({ message: '获取车次列表失败' });
  }
});

// 搜索车次
router.get('/search', async (req, res) => {
  try {
    const { date, trainCode, startStation, endStation, trainType } = req.query;
    
    const trains = await searchTrains({
      date: date as string,
      trainCode: trainCode as string,
      startStation: startStation as string,
      endStation: endStation as string,
      trainType: trainType as string
    });
    
    res.json(trains);
  } catch (error) {
    console.error('搜索车次失败:', error);
    res.status(500).json({ message: '搜索车次失败' });
  }
});

// 手动触发车次数据更新 (仅管理员可用)
router.post('/update', async (req, res) => {
  try {
    await fetchAndSaveTrains();
    res.json({ message: '车次数据更新成功' });
  } catch (error) {
    console.error('更新车次数据失败:', error);
    res.status(500).json({ message: '更新车次数据失败' });
  }
});

// 获取车次经停站信息
router.get('/stops/:ticketId', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    
    if (isNaN(ticketId)) {
      return res.status(400).json({ message: '无效的车票ID' });
    }
    
    // 获取查询12306所需的所有参数
    const params = await getStopInfoParams(ticketId);
    
    // 查询12306获取经停站信息，同时传入ticketId用于缓存
    const stopInfoResult = await getTrainStopInfo(
      params.trainNo,
      params.fromStationCode,
      params.toStationCode,
      params.departDate,
      ticketId,  // 传入ticketId用于缓存
      params.departureStation,
      params.arrivalStation
    );
    
    // 返回结果
    res.json({
      stops: stopInfoResult.stops,
      departureStation: params.departureStation,
      arrivalStation: params.arrivalStation,
      trainNo: params.trainNumber
    });
  } catch (error) {
    console.error('获取车次经停站信息失败:', error);
    
    if (error instanceof Error) {
      res.status(500).json({ 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      res.status(500).json({ message: '获取车次经停站信息失败' });
    }
  }
});

// 直接通过参数查询12306经停站信息
router.get('/stops', async (req, res) => {
  try {
    const { trainNo, fromStationCode, toStationCode, departDate } = req.query;
    
    if (!trainNo || !fromStationCode || !toStationCode || !departDate) {
      return res.status(400).json({ 
        message: '参数不完整，需要trainNo, fromStationCode, toStationCode, departDate'
      });
    }
    
    const stopInfoResult = await getTrainStopInfo(
      trainNo as string,
      fromStationCode as string,
      toStationCode as string,
      departDate as string
    );
    
    res.json(stopInfoResult.stops);
  } catch (error) {
    console.error('查询12306经停站信息失败:', error);
    
    if (error instanceof Error) {
      res.status(500).json({ 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      res.status(500).json({ message: '查询12306经停站信息失败' });
    }
  }
});

// 手动触发所有车票时刻表缓存 (仅管理员可用)
router.post('/cache-timetables', async (req, res) => {
  try {
    // limit=0表示不限制数量，处理所有未缓存的车票
    const limit = req.body.limit ? parseInt(req.body.limit) : 0;
    // 添加延迟参数，默认为1500毫秒
    const delay = req.body.delay ? parseInt(req.body.delay) : 1500;
    
    const cachedCount = await cacheTimetableForAllTickets(limit, delay);
    
    res.json({ 
      success: true,
      message: `成功缓存 ${cachedCount} 张车票的时刻表数据（所有历史数据将被永久保存）`,
      count: cachedCount
    });
  } catch (error) {
    console.error('批量缓存时刻表失败:', error);
    
    if (error instanceof Error) {
      res.status(500).json({ 
        success: false,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: '批量缓存时刻表失败'
      });
    }
  }
});



export default router; 