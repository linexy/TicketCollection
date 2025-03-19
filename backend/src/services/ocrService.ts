import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface ParsedTicket {
  orderNo: string;
  departureStation: string;
  arrivalStation: string;
  departureTime: string;
  arrivalTime: string;
  trainNo: string;
  seatNo: string;
  carNo: string;
  seatType: string;
  price: string;
}

class OcrService {
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  private async getAccessToken(): Promise<string> {
    // 如果token还在有效期内,直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const AK = process.env.BAIDU_AK;
      const SK = process.env.BAIDU_SK;

      if (!AK || !SK) {
        throw new Error('百度OCR配置缺失');
      }

      const response = await axios.post(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`
      );

      if (!response.data.access_token) {
        throw new Error('获取access token失败');
      }

      this.accessToken = response.data.access_token;
      // token有效期30天,这里设置29天过期
      this.tokenExpireTime = Date.now() + 29 * 24 * 60 * 60 * 1000;
      
      return response.data.access_token;
    } catch (error) {
      console.error('获取百度OCR access token失败:', error);
      throw error;
    }
  }

  // 定义座位类型常量
  private SEAT_TYPES = ['二等座', '一等座', '商务座', '无座', '硬座', '硬卧', '软卧'];

  private parseTicketInfo(words_result: Array<{words: string}>): ParsedTicket {
    const allText = words_result.map(item => item.words);
    
    // 提取订单号 - 只保留字母和数字
    const orderNo = allText.find(text => text.includes('订单号：'))
      ?.replace(/[^A-Za-z0-9]/g, '') || '';
    
    // 提取车次
    const trainNo = allText.find(text => /^[GDCKT]\d+>?$/.test(text))?.replace('>', '') || '';
    
    // 提取发车日期
    const departureDateMatch = allText.find(text => text.includes('发车时间：'))?.match(/\d{4}.\d{2}.\d{2}/) || [];
    const departureDate = departureDateMatch[0]?.replace(/\./g, '-') || '';

    // 提取时间和站点
    let departureTime = '';
    let arrivalTime = '';
    let departureStation = '';
    let arrivalStation = '';

    // 先找到"订单详情"的位置
    const orderDetailIndex = allText.findIndex(text => text === '订单详情');
    if (orderDetailIndex !== -1) {
      // 从"订单详情"位置开始查找时间
      const timesAfterOrderDetail = allText
        .slice(orderDetailIndex)
        .filter(text => /^\d{2}:\d{2}$/.test(text));
      
      if (timesAfterOrderDetail.length >= 2) {
        departureTime = timesAfterOrderDetail[0];  // 第一个时间为出发时间
        arrivalTime = timesAfterOrderDetail[1];    // 第二个时间为到达时间
        
        // 对于每个时间找到对应的站点
        allText.forEach((text, index) => {
          // 如果当前文本是出发时间
          if (text === departureTime) {
            // 向后查找第二个带>的站点
            let foundCount = 0;
            for (let i = index + 1; i < allText.length; i++) {
              if (allText[i].endsWith('>')) {
                foundCount++;
                if (foundCount === 2) {
                  departureStation = allText[i].replace('>', '');
                  break;
                }
              }
            }
          }
          // 如果当前文本是到达时间
          if (text === arrivalTime) {
            // 向后查找第二个带>的站点
            let foundCount = 0;
            for (let i = index + 1; i < allText.length; i++) {
              if (allText[i].endsWith('>')) {
                foundCount++;
                if (foundCount === 2) {
                  arrivalStation = allText[i].replace('>', '');
                  break;
                }
              }
            }
          }
        });
      }
    }

    // 提取座位类型和座位信息
    const seatType = this.SEAT_TYPES.find(type => allText.some(text => text.includes(type))) || '';
    
    // 根据不同座位类型提取座位号信息
    let carNo = '';
    let seatNo = '';
    
    const seatInfo = allText.find(text => {
      if (!seatType) return false;
      
      // 针对不同座位类型使用不同的匹配规则
      if (['二等座', '一等座', '商务座','硬座'].includes(seatType)) {
        // 车厢号+座位号，例如：二等座03车05B号
        return new RegExp(`${seatType}\\d{2}车\\d{1,3}[A-Z]号`).test(text);
      } else if (['硬卧', '软卧'].includes(seatType)) {
        // 车厢号+铺位号，例如：硬卧03车上铺
        return new RegExp(`${seatType}\\d{2}车[上中下]铺`).test(text);
      } else {
        // 无座可能只有车厢号
        return new RegExp(`${seatType}\\d{2}车`).test(text);
      }
    }) || '';

    if (seatInfo) {
      // 提取车厢号
      carNo = seatInfo.match(/\d{2}(?=车)/)?.[0] || '';

      // 根据座位类型提取座位号
      if (['二等座', '一等座', '商务座','硬座'].includes(seatType)) {
        seatNo = seatInfo.match(/\d{1,3}[A-Z](?=号)/)?.[0] || '';
      } else if (['硬卧', '软卧'].includes(seatType)) {
        seatNo = seatInfo.match(/[上中下](?=铺)/)?.[0] || '';
      }
    }
    
    // 提取票价
    const price = allText.find(text => text.includes('￥'))?.match(/\d+/)?.[0] || '';

    // 组合完整的日期时间
    const fullDepartureTime = departureDate && departureTime ? `${departureDate} ${departureTime}` : '';
    const fullArrivalTime = departureDate && arrivalTime ? `${departureDate} ${arrivalTime}` : '';

    return {
      orderNo,
      departureStation,
      arrivalStation,
      departureTime: fullDepartureTime,
      arrivalTime: fullArrivalTime,
      trainNo,
      seatNo,
      carNo,
      seatType,
      price
    };
  }

  async recognizeText(image: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();
      
      const response = await axios.post(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`,
        `image=${encodeURIComponent(image)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const parsedTicket = this.parseTicketInfo(response.data.words_result);
      return {
        ...response.data,
        parsed_result: parsedTicket
      };
    } catch (error) {
      console.error('OCR识别失败:', error);
      throw error;
    }
  }
}

export const ocrService = new OcrService(); 