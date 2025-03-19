import axios from 'axios';
import { sequelize } from '../config/database';
import Station from '../models/Station';

// 百度地图API密钥
const BAIDU_API_KEY = 'TzIuaRnnq7uJ4QFUTCtqEn5ClLaePxEp';

/**
 * 从百度地图API获取地理编码信息
 * @param stationName 车站名称
 * @returns 经纬度信息
 */
async function getCoordinates(stationName: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // 确保车站名称以"站"结尾
    const address = stationName.endsWith('站') ? stationName : `${stationName}站`;
    
    // 构建API请求URL
    const url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(address)}&output=json&ak=${BAIDU_API_KEY}&ret_coordtype=gcj02ll`;
    
    const response = await axios.get(url);
    
    // 检查API响应状态
    if (response.data.status === 0) {
      const { lng, lat } = response.data.result.location;
      return {
        longitude: lng,
        latitude: lat
      };
    } else {
      console.error(`获取[${stationName}]坐标失败:`, response.data.message || '未知错误');
      return null;
    }
  } catch (error) {
    console.error(`获取[${stationName}]坐标时发生错误:`, error);
    return null;
  }
}

/**
 * 更新所有车站的经纬度信息
 */
async function updateAllStationCoordinates() {
  try {
    // 确保数据库连接
    console.log('尝试连接数据库...');
    console.log(`数据库配置: ${process.env.DB_HOST}:${process.env.DB_PORT}, 用户: ${process.env.DB_USER}, 数据库: ${process.env.DB_NAME}`);
    
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 获取所有车站
    const stations = await Station.findAll();
    console.log(`共找到 ${stations.length} 个车站`);

    // 计数器
    let successCount = 0;
    let failCount = 0;
    
    // 批量处理，避免请求过快
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i];
      console.log(`正在处理 ${i+1}/${stations.length}: ${station.stationName}`);
      
      // 获取坐标
      const coordinates = await getCoordinates(station.stationName);
      
      if (coordinates) {
        // 更新车站记录
        await station.update({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        });
        
        console.log(`✅ 成功更新 ${station.stationName} 坐标: ${coordinates.longitude}, ${coordinates.latitude}`);
        successCount++;
      } else {
        failCount++;
      }
      
      // 添加延迟以避免API请求限制
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('🎉 更新完成');
    console.log(`总计: ${stations.length}, 成功: ${successCount}, 失败: ${failCount}`);
    
  } catch (error: any) {
    console.error('更新车站坐标时发生错误:', error);
    
    if (error.name === 'SequelizeConnectionRefusedError') {
      console.error('数据库连接被拒绝，请检查:');
      console.error('1. 数据库服务器是否运行');
      console.error('2. 数据库端口是否正确');
      console.error('3. 防火墙是否允许连接');
      console.error('4. 数据库服务器是否允许远程连接');
    } else if (error.name === 'SequelizeAccessDeniedError') {
      console.error('数据库访问被拒绝，请检查用户名和密码是否正确');
    } else if (error.name === 'SequelizeHostNotFoundError') {
      console.error('找不到数据库主机，请检查主机名是否正确');
    }
  } finally {
    // 关闭数据库连接
    try {
      await sequelize.close();
    } catch (err) {
      console.error('关闭数据库连接时出错:', err);
    }
  }
}

// 执行主函数
if (require.main === module) {
  updateAllStationCoordinates()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('程序执行失败:', err);
      process.exit(1);
    });
} 