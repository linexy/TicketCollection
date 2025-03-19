import axios from 'axios';

/**
 * 车站停靠信息数据结构
 */
export interface StationStopItem {
  stationNo: string;
  stationName: string;
  arriveTime: string;
  departTime: string;
  stopoverTime: string;
  isStart: boolean;
  isEnd: boolean;
}

/**
 * 前端缓存对象类型
 */
export interface StopsCacheItem {
  stops: StationStopItem[];
  departureStation: string;
  arrivalStation: string;
  timestamp: number;
}

// 创建一个简单的缓存对象（在多个组件间共享）
export const stopsCache: Record<number, StopsCacheItem> = {};

// 缓存有效期5分钟
export const CACHE_EXPIRY_TIME = 5 * 60 * 1000;

/**
 * 获取并缓存车票时刻信息
 * @param ticketId 车票ID
 * @returns 缓存的数据或null（如果获取失败）
 */
export const fetchAndCacheStopInfo = async (ticketId: number): Promise<StopsCacheItem | null> => {
  try {
    // 检查缓存中是否有数据且未过期
    const cachedData = stopsCache[ticketId];
    const now = Date.now();
    
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY_TIME)) {
      // 使用缓存数据
    //  console.log(`使用缓存的车票时刻信息: ${ticketId}`);
      return cachedData;
    }

    // 没有缓存或缓存已过期，发起API请求
  //  console.log(`正在获取车票时刻信息: ${ticketId}`);
    const response = await axios.get(`/api/trains/stops/${ticketId}`);
    
    // 构造缓存数据
    const cacheItem: StopsCacheItem = {
      stops: response.data.stops,
      departureStation: response.data.departureStation,
      arrivalStation: response.data.arrivalStation,
      timestamp: now
    };
    
    // 存入缓存
    stopsCache[ticketId] = cacheItem;
   // console.log(`车票时刻信息已缓存: ${ticketId}`);
    
    return cacheItem;
  } catch (error) {
    console.error('获取车票时刻信息失败:', error);
    return null;
  }
}; 