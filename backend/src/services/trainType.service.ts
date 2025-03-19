import axios from 'axios';
import { format } from 'date-fns';

export class TrainTypeService {
  private static readonly API_BASE_URL = 'https://api.rail.re';

  static async getTrainType(trainNo: string, departureTime: string | Date): Promise<string> {
    try {
      console.log(`正在获取车次 ${trainNo}, 发车时间 ${departureTime} 的车型信息...`);
      
      // 将departureTime转换为标准格式的字符串
      let departureDateStr = '';
      
      if (!departureTime) {
        console.warn(`车次 ${trainNo} 的发车时间为空，无法查询车型信息`);
        return '';
      }
      
      // 处理不同类型的departureTime
      if (departureTime instanceof Date) {
        departureDateStr = format(departureTime, 'yyyy-MM-dd');
      } else if (typeof departureTime === 'string') {
        // 如果是ISO格式或包含T的格式，使用Date对象处理
        if (departureTime.includes('T') || departureTime.includes('Z')) {
          departureDateStr = format(new Date(departureTime), 'yyyy-MM-dd');
        } else if (departureTime.includes(' ')) {
          // 如果是"yyyy-MM-dd HH:mm:ss"格式，直接取日期部分
          departureDateStr = departureTime.split(' ')[0];
        } else if (departureTime.includes('-')) {
          // 如果只有日期部分，直接使用
          departureDateStr = departureTime;
        } else {
          // 其他情况，尝试解析
          try {
            departureDateStr = format(new Date(departureTime), 'yyyy-MM-dd');
          } catch (e) {
            console.warn(`无法解析日期 ${departureTime}，使用当前日期`);
            departureDateStr = format(new Date(), 'yyyy-MM-dd');
          }
        }
      } else {
        // 其他类型，尝试转换或使用当前日期
        try {
          departureDateStr = format(new Date(departureTime as any), 'yyyy-MM-dd');
        } catch (e) {
          console.warn(`无法将 ${departureTime} 转换为日期，使用当前日期`);
          departureDateStr = format(new Date(), 'yyyy-MM-dd');
        }
      }
      
      console.log(`查找日期 ${departureDateStr} 的车型记录`);
      
      const response = await axios.get(`${this.API_BASE_URL}/train/${trainNo}`);
      const data = response.data;

      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`车次 ${trainNo} 无车型数据`);
        return ''; // 如果没有数据返回空字符串
      }

      // 尝试找到匹配日期的记录
      const matchedRecord = data.find((item: any) => item.date && item.date.startsWith(departureDateStr));

      // 如果找到匹配的记录就使用它，否则使用最新的记录
      const record = matchedRecord || data[0];

      if (!record || !record.emu_no) {
        console.warn(`车次 ${trainNo} 无法提取车型信息`);
        return '';
      }

      // 从emu_no中提取车型信息（去除后四位数字）
      const trainType = record.emu_no.slice(0, -4);
      
      console.log(`车次 ${trainNo} 的车型为: ${trainType}`);
      return trainType;
    } catch (error) {
      console.error('获取车型信息失败:', error);
      // 添加更多错误诊断信息
      if (axios.isAxiosError(error)) {
        console.error(`API请求失败: ${error.message}`);
        if (error.response) {
          console.error(`状态码: ${error.response.status}`);
          console.error(`响应数据: ${JSON.stringify(error.response.data)}`);
        }
      }
      return ''; // 发生错误时返回空字符串
    }
  }
  
  /**
   * 检查车型信息是否需要更新
   * @param currentType 当前车型信息
   * @param trainNo 车次
   * @param departureTime 出发时间
   * @returns 如果需要更新则返回新车型，否则返回空字符串
   */
  static async checkNeedUpdate(currentType: string, trainNo: string, departureTime: string | Date): Promise<string> {
    try {
      const newType = await this.getTrainType(trainNo, departureTime);
      
      // 如果新获取的车型与当前车型不同，且非空，则返回新车型
      if (newType && newType !== currentType) {
        console.log(`车次 ${trainNo} 的车型已更新: ${currentType} -> ${newType}`);
        return newType;
      }
      
      return '';
    } catch (error) {
      console.error('检查车型更新失败:', error);
      return '';
    }
  }
}