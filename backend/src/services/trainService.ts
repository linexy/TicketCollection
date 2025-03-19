import axios from 'axios';
import Train from '../models/Train';
import Station from '../models/Station';
import { sequelize } from '../config/database';
import { TrainStopCache } from '../models/TrainStopCache';

export const fetchAndSaveTrains = async (): Promise<void> => {
  try {
    // 获取12306车次数据
    const response = await axios.get('https://kyfw.12306.cn/otn/resources/js/query/train_list.js');
    const data = response.data;
    
    // 提取车次数据字符串 (从第16个字符开始)
    const trainDataStr = data.substring(16);
    
    // 解析JSON数据
    const trainData = JSON.parse(trainDataStr);
    
    // 清空现有数据
    await Train.destroy({ truncate: true });
    
    // 批量插入新数据
    const trainList: any[] = [];
    let totalImported = 0;
    
    // 遍历日期
    for (const date in trainData) {
      if (Object.prototype.hasOwnProperty.call(trainData, date)) {
        const dateData = trainData[date];
        
        // 遍历车次类型 (C, D, G, Z, T, K等)
        const trainTypes = ['C', 'D', 'G', 'Z', 'T', 'K', 'Y', 'L', 'S'];
        
        for (const trainType of trainTypes) {
          if (dateData[trainType] && Array.isArray(dateData[trainType])) {
            for (const train of dateData[trainType]) {
              const stationTrainCodeFull = train.station_train_code;
              const trainNo = train.train_no;
              
              // 解析车次信息 (例如: "G101(北京南-上海虹桥)")
              const regex = /^([A-Z0-9]+)\((.+)-(.+)\)$/;
              const match = stationTrainCodeFull.match(regex);
              
              if (match) {
                const [, stationTrainCode, startStation, endStation] = match;
                
                trainList.push({
                  date,
                  stationTrainCode,
                  startStation,
                  endStation,
                  trainNo,
                  trainType
                });
                
                // 每1000条记录批量保存一次，避免事务过大
                if (trainList.length >= 1000) {
                  await Train.bulkCreate(trainList);
                  totalImported += trainList.length;
                  console.log(`已导入 ${totalImported} 个火车车次数据...`);
                  trainList.length = 0; // 清空数组
                }
              }
            }
          }
        }
      }
    }
    
    // 保存剩余的记录
    if (trainList.length > 0) {
      await Train.bulkCreate(trainList);
      totalImported += trainList.length;
    }
    
    console.log(`成功导入 ${totalImported} 个火车车次数据`);
  } catch (error) {
    console.error('获取或保存车次数据时出错:', error);
    throw error;
  }
};

export const getAllTrains = async (limit: number = 100, offset: number = 0) => {
  return await Train.findAndCountAll({
    limit,
    offset,
    order: [['date', 'ASC'], ['stationTrainCode', 'ASC']]
  });
};

export const searchTrains = async (params: {
  date?: string;
  trainCode?: string;
  startStation?: string;
  endStation?: string;
  trainType?: string;
}) => {
  const where: any = {};
  
  if (params.date) {
    where.date = params.date;
  }
  
  if (params.trainCode) {
    where.stationTrainCode = sequelize.where(
      sequelize.fn('LOWER', sequelize.col('stationTrainCode')),
      'LIKE',
      `%${params.trainCode.toLowerCase()}%`
    );
  }
  
  if (params.startStation) {
    where.startStation = sequelize.where(
      sequelize.fn('LOWER', sequelize.col('startStation')),
      'LIKE',
      `%${params.startStation.toLowerCase()}%`
    );
  }
  
  if (params.endStation) {
    where.endStation = sequelize.where(
      sequelize.fn('LOWER', sequelize.col('endStation')),
      'LIKE',
      `%${params.endStation.toLowerCase()}%`
    );
  }
  
  if (params.trainType) {
    where.trainType = params.trainType;
  }
  
  return await Train.findAll({
    where,
    limit: 100,
    order: [['date', 'ASC'], ['stationTrainCode', 'ASC']]
  });
};

/**
 * 查询车次经停站信息，优先从缓存获取
 * @param trainNo 12306系统中的车次编号
 * @param fromStationCode 出发站电报码
 * @param toStationCode 到达站电报码
 * @param departDate 出发日期，格式：YYYY-MM-DD
 * @param ticketId 可选，车票ID，用于保存缓存
 */
export const getTrainStopInfo = async (
  trainNo: string,
  fromStationCode: string,
  toStationCode: string,
  departDate: string,
  ticketId?: number,
  departureStation?: string,
  arrivalStation?: string
) => {
  try {
    // 如果有ticketId，尝试从缓存中获取数据
    if (ticketId) {
      const cachedData = await TrainStopCache.findOne({
        where: { ticketId }
      });

      if (cachedData) {
       // console.log(`从缓存获取车票ID为 ${ticketId} 的经停站信息`);
        return {
          stops: JSON.parse(cachedData.stopInfo),
          departureStation: cachedData.departureStation,
          arrivalStation: cachedData.arrivalStation,
          trainNo: cachedData.trainNo
        };
      }
    }

    // 缓存不存在，从12306获取数据
    const url = `https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=${trainNo}&from_station_telecode=${fromStationCode}&to_station_telecode=${toStationCode}&depart_date=${departDate}`;
    
    const response = await axios.get(url);
    
    if (!response.data) {
      console.error('12306接口返回空数据');
      return {
        stops: [],
        departureStation: departureStation || '',
        arrivalStation: arrivalStation || '',
        trainNo: ''
      };
    }
    
    if (response.data && response.data.data && response.data.data.data) {
      const stopInfoList = response.data.data.data;
      
      // 处理经停站信息
      const result = stopInfoList.map((stop: any, index: number) => ({
        stationNo: stop.station_no, // 站序
        stationName: stop.station_name, // 站名
        arriveTime: stop.arrive_time, // 到达时间
        departTime: stop.start_time, // 出发时间
        stopoverTime: stop.stopover_time, // 停留时间
        isStart: index === 0, // 是否始发站
        isEnd: index === stopInfoList.length - 1, // 是否终点站
      }));
      
      // 如果有ticketId，保存到缓存
      if (ticketId && departureStation && arrivalStation) {
        try {
          // 保存到缓存，如果已存在则更新
          await TrainStopCache.upsert({
            ticketId,
            trainNo,
            fromStationCode,
            toStationCode,
            departDate,
            departureStation,
            arrivalStation,
            stopInfo: JSON.stringify(result)
          });
        //  console.log(`车票ID为 ${ticketId} 的经停站信息已缓存`);
        } catch (cacheError) {
          console.error('保存经停站信息到缓存失败:', cacheError);
          // 缓存失败不影响正常返回
        }
      }
      
      return {
        stops: result,
        departureStation: departureStation || '',
        arrivalStation: arrivalStation || '',
        trainNo: ''
      };
    } else {
      console.error('12306接口返回数据格式异常:', response.data);
      return {
        stops: [],
        departureStation: departureStation || '',
        arrivalStation: arrivalStation || '',
        trainNo: ''
      };
    }
  } catch (error: any) {
    console.error('获取车次经停信息失败:', error);
    
    // 记录错误详情
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    
    throw error;
  }
};

/**
 * 获取查询12306经停站信息所需的参数
 * @param ticketId 车票ID
 */
export const getStopInfoParams = async (ticketId: number) => {
  try {
    // 直接导入所需模型，避免动态导入可能导致的问题
    const { TrainTicket } = require('../models/TrainTicket');
    const { BaseTicket } = require('../models/BaseTicket');
    const Station = require('../models/Station').default;
    const Train = require('../models/Train').default;
    
    // 查询车票信息
    const ticket = await TrainTicket.findOne({
      where: { id: ticketId },
      include: [
        {
          model: BaseTicket,
          as: 'baseTicket',
          required: true
        }
      ]
    });
    
    if (!ticket) {
      throw new Error(`未找到ID为 ${ticketId} 的车票信息`);
    }
    
    // 查询车次信息的函数
    const findTrain = async (trainNoValue: string) => {
      // 进行精确匹配
      const train = await Train.findOne({
        where: { trainNo: trainNoValue }
      });
      
      if (train) {
        return train;
      }
      
      return null;
    };
    
    // 查询车站信息的函数
    const findStation = async (stationName: string) => {
      // 进行精确匹配
      const station = await Station.findOne({
        where: { stationName: stationName }
      });
      
      if (station) {
        return station;
      }
      
      return null;
    };
    
    const train = await findTrain(ticket.trainNo);
    
    if (!train) {
      throw new Error(`无匹配车次信息：无法找到与车票车次号(${ticket.trainNo})匹配的车次`);
    }
    
    const departureStation = await findStation(ticket.baseTicket.departureStation);
    
    if (!departureStation) {
      throw new Error(`无匹配车站信息：无法找到与出发站(${ticket.baseTicket.departureStation})匹配的车站`);
    }
    
    const arrivalStation = await findStation(ticket.baseTicket.arrivalStation);
    
    if (!arrivalStation) {
      throw new Error(`无匹配车站信息：无法找到与到达站(${ticket.baseTicket.arrivalStation})匹配的车站`);
    }
    
    // 提取日期部分 (YYYY-MM-DD)
    const departDate = new Date(ticket.baseTicket.departureTime)
      .toISOString()
      .split('T')[0];
    
    const params = {
      trainNo: train.train_no,
      fromStationCode: departureStation.telegraphCode,
      toStationCode: arrivalStation.telegraphCode,
      departDate,
      departureStation: ticket.baseTicket.departureStation,
      arrivalStation: ticket.baseTicket.arrivalStation,
      trainNumber: ticket.trainNo  // 添加前端显示用的列车号
    };
    
    return params;
  } catch (error) {
    console.error('获取12306查询参数失败:', error);
    throw error;
  }
};

/**
 * 批量缓存所有车票的时刻表数据
 * @param limit 每批处理的车票数量限制，默认为0表示不限制数量
 * @param delay 每次请求之间的延迟时间（毫秒），默认为1500毫秒
 * @returns 缓存的车票数量
 */
export const cacheTimetableForAllTickets = async (limit: number = 0, delay: number = 1500): Promise<number> => {
  try {
    // 直接导入所需模型，避免动态导入可能导致的问题
    const { TrainTicket } = require('../models/TrainTicket');
    const { TrainStopCache } = require('../models/TrainStopCache');
    
    // 构建查询选项
    const findOptions: any = {
      where: {},
    };
    
    // 如果设置了limit，则限制查询数量
    if (limit > 0) {
      findOptions.limit = limit;
    }
    
    // 获取所有火车票
    const tickets = await TrainTicket.findAll(findOptions);
    
    // 获取已缓存的车票ID列表
    const cachedTicketIds = (await TrainStopCache.findAll({
      attributes: ['ticketId']
    })).map((cache: any) => cache.ticketId);
    
    // 过滤出未缓存的车票
    const uncachedTickets = tickets.filter((ticket: any) => 
      !cachedTicketIds.includes(ticket.id)
    );
    
    console.log(`找到 ${uncachedTickets.length} 张未缓存时刻表的车票`);
    
    let cachedCount = 0;
    
    // 为每张未缓存的车票获取并缓存时刻表
    for (const ticket of uncachedTickets) {
      try {
        // 获取查询所需的参数
        const params = await getStopInfoParams(ticket.id);
        
        // 调用API获取并缓存经停站信息
        await getTrainStopInfo(
          params.trainNo,
          params.fromStationCode,
          params.toStationCode,
          params.departDate,
          ticket.id,
          params.departureStation,
          params.arrivalStation
        );
        
        cachedCount++;
        console.log(`已缓存第 ${cachedCount}/${uncachedTickets.length} 张车票的时刻表`);
        
        // 为避免请求过于频繁，每次缓存后延迟一段时间
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`缓存车票 ${ticket.id} 的时刻表失败:`, error);
        // 继续处理下一张车票
      }
    }
    
    console.log(`成功缓存 ${cachedCount} 张车票的时刻表数据`);
    return cachedCount;
  } catch (error) {
    console.error('批量缓存时刻表失败:', error);
    throw error;
  }
};