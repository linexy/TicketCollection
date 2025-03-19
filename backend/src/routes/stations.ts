import express from 'express';
import { fetchAndSaveStations, getAllStations, searchStations } from '../services/stationService';

const router = express.Router();

// 获取所有站点
router.get('/', async (req, res) => {
  try {
    const stations = await getAllStations();
    res.json(stations);
  } catch (error) {
    console.error('获取站点列表失败:', error);
    res.status(500).json({ message: '获取站点列表失败' });
  }
});

// 搜索站点
router.get('/search', async (req, res) => {
  try {
    const keyword = req.query.keyword as string;
    if (!keyword) {
      return res.status(400).json({ message: '请提供搜索关键词' });
    }
    
    const stations = await searchStations(keyword);
    res.json(stations);
  } catch (error) {
    console.error('搜索站点失败:', error);
    res.status(500).json({ message: '搜索站点失败' });
  }
});

// 手动触发站点数据更新 (仅管理员可用)
router.post('/update', async (req, res) => {
  try {
    await fetchAndSaveStations();
    res.json({ message: '站点数据更新成功' });
  } catch (error) {
    console.error('更新站点数据失败:', error);
    res.status(500).json({ message: '更新站点数据失败' });
  }
});

export default router; 