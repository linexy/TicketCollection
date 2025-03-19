import express from 'express';
import { BaiduMapController } from '../controllers/baiduMap.controller';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// 获取地图API代理URL - 需要认证
router.get('/url', verifyToken, BaiduMapController.getMapUrl);

// 代理百度地图API请求 - 不需要认证，因为是通过<script>标签加载的
router.get('/proxy', BaiduMapController.proxyMapApi);

// 代理百度地图getscript接口请求 - 不需要认证，因为是通过<script>标签加载的
router.get('/getscript', BaiduMapController.proxyGetScript);

export default router; 