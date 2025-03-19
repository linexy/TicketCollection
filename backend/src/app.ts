import express from 'express';
import path from 'path';
import authRoutes from './routes/auth';
import statisticsRoutes from './routes/statistics';
import stationRoutes from './routes/stations';
import trainRoutes from './routes/trains';
import mapRoutes from './routes/map';
import { sequelize } from './config/database';
import { fetchAndSaveStations } from './services/stationService';
import { fetchAndSaveTrains } from './services/trainService';
import { TrainStopCache } from './models/TrainStopCache';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { serverConfig } from './config/database';

const app = express();

// 添加安全头和压缩中间件
app.use(helmet());
app.use(compression()); // 启用gzip压缩

// 设置CORS
app.use(cors());

// 增加请求体大小限制
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 添加缓存控制中间件
app.use((req, res, next) => {
  // 对于API请求添加缓存控制
  if (req.path.startsWith('/api/tickets/upcoming')) {
    res.set('Cache-Control', 'public, max-age=60'); // 30分钟缓存
  }
  next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../../ticket-system-frontend/build')));

// 设置路由
app.use('/api/auth', authRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/map', mapRoutes);

// 所有其他请求返回React应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../ticket-system-frontend/build/index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`服务器运行在端口 ${PORT}`);
  
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步数据库模型
    await sequelize.sync();
    console.log('数据库模型同步完成');
    
    // 初始化站点数据（如果数据库中没有数据）
    try {
      const Station = require('./models/Station').default;
      const count = await Station.count();
      if (count === 0) {
        console.log('正在初始化站点数据...');
        await fetchAndSaveStations();
      }
      
      // 初始化车次数据（如果数据库中没有数据）
      const Train = require('./models/Train').default;
      const trainCount = await Train.count();
      if (trainCount === 0) {
        console.log('正在初始化车次数据...');
        await fetchAndSaveTrains();
      }
    } catch (error) {
      console.error('初始化数据失败:', error);
    }
  } catch (error) {
    console.error('数据库连接失败:', error);
  }
});

export default app; 