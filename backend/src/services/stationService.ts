import axios from 'axios';
import Station from '../models/Station';
import { sequelize } from '../config/database';

export const fetchAndSaveStations = async (): Promise<void> => {
  try {
    // 获取12306站点数据
    const response = await axios.get('https://kyfw.12306.cn/otn/resources/js/framework/station_name.js');
    const data = response.data;
    
    // 提取站点数据字符串 (从第20个字符开始到倒数第2个字符)
    const stationStr = data.substring(data.indexOf("'") + 1, data.lastIndexOf("'"));
    
    // 解析站点数据
    const stationArray = stationStr.split('@').filter(Boolean);
    
    // 开始事务
    const transaction = await sequelize.transaction();
    
    try {
      // 清空现有数据
      await Station.destroy({ truncate: true, transaction });
      
      // 批量插入新数据
      const stations = stationArray.map((station: string) => {
        const [spellCode, stationName, telegraphCode, spell, initial, id, cityCode, city, ...rest] = station.split('|');
        
        // 提取省份信息（如果有）
        let province = '';
        if (rest.length > 0) {
          province = rest[rest.length - 1];
        }
        
        return {
          id: parseInt(id),
          spellCode,
          stationName,
          telegraphCode,
          spell,
          initial,
          city: city || null,
          cityCode: cityCode || null,
          province: province || null
        };
      });
      
      await Station.bulkCreate(stations, { transaction });
      
      // 提交事务
      await transaction.commit();
      console.log(`成功导入 ${stations.length} 个火车站数据`);
    } catch (error) {
      // 回滚事务
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('获取或保存站点数据时出错:', error);
    throw error;
  }
};

export const getAllStations = async () => {
  return await Station.findAll({
    order: [['id', 'ASC']]
  });
};

export const searchStations = async (keyword: string) => {
  return await Station.findAll({
    where: sequelize.literal(`
      stationName LIKE '%${keyword}%' OR 
      spell LIKE '%${keyword}%' OR 
      spellCode LIKE '%${keyword}%' OR 
      initial LIKE '%${keyword}%'
    `),
    limit: 20
  });
}; 