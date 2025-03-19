import { sequelize } from '../config/database';
import { fetchAndSaveStations } from '../services/stationService';

async function syncStations() {
  try {
    console.log('尝试连接数据库...');
    console.log(`数据库配置: ${process.env.DB_HOST}:${process.env.DB_PORT}, 用户: ${process.env.DB_USER}, 数据库: ${process.env.DB_NAME}`);
    
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步数据库模型
    await sequelize.sync();
    
    console.log('开始同步站点数据...');
    await fetchAndSaveStations();
    console.log('站点数据同步完成');
    
    process.exit(0);
  } catch (error: any) {
    console.error('同步站点数据失败:', error);
    
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
    
    process.exit(1);
  }
}

syncStations(); 