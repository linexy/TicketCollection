import { Request, Response } from 'express';
import axios from 'axios';

/**
 * 百度地图API代理控制器
 * 作用：隐藏API密钥，避免前端直接暴露密钥
 */
export class BaiduMapController {
  
  /**
   * 代理百度地图API，隐藏密钥
   */
  public static async proxyMapApi(req: Request, res: Response): Promise<void> {
    try {
      const apiKey = process.env.BAIDU_MAP_KEY;
      if (!apiKey) {
        res.status(500).json({ error: '百度地图API密钥未配置' });
        return;
      }

      // 构建代理URL - 使用高清地图API
      // 使用百度地图WebGL版本，支持高清地图
      let proxyUrl = `https://api.map.baidu.com/api?type=webgl&ak=${apiKey}`;
      
      // 获取所有查询参数并添加到URL中（除了ak参数和type参数）
      const queryParams = req.query;
      Object.keys(queryParams).forEach(key => {
        if (key !== 'ak' && key !== 'type') {
          proxyUrl += `&${key}=${queryParams[key]}`;
        }
      });

      // 设置合适的响应头
      res.setHeader('Content-Type', 'application/javascript');
      
      // 获取并返回API响应
      const response = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
      res.send(response.data);
    } catch (error) {
      console.error('百度地图API代理错误:', error);
      res.status(500).json({ error: '代理百度地图API失败' });
    }
  }

  /**
   * 代理百度地图getscript接口，隐藏密钥
   */
  public static async proxyGetScript(req: Request, res: Response): Promise<void> {
    try {
      const apiKey = process.env.BAIDU_MAP_KEY;
      if (!apiKey) {
        res.status(500).json({ error: '百度地图API密钥未配置' });
        return;
      }

      // 构建代理URL
      let proxyUrl = `https://api.map.baidu.com/getscript?ak=${apiKey}`;
      
      // 获取所有查询参数并添加到URL中（除了ak参数）
      const queryParams = req.query;
      Object.keys(queryParams).forEach(key => {
        if (key !== 'ak') {
          proxyUrl += `&${key}=${queryParams[key]}`;
        }
      });

      // 设置合适的响应头
      res.setHeader('Content-Type', 'application/javascript');
      
      // 获取并返回API响应
      const response = await axios.get(proxyUrl, { responseType: 'arraybuffer' });
      res.send(response.data);
    } catch (error) {
      console.error('百度地图getscript代理错误:', error);
      res.status(500).json({ error: '代理百度地图getscript接口失败' });
    }
  }

  /**
   * 获取百度地图公共访问URL（不包含密钥，前端JS可直接使用）
   */
  public static async getMapUrl(req: Request, res: Response): Promise<void> {
    try {
      // 返回代理URL给前端使用
      res.json({ 
        url: '/api/map/proxy',
        message: '请使用此URL加载百度地图API' 
      });
    } catch (error) {
      console.error('获取地图URL失败:', error);
      res.status(500).json({ error: '获取地图URL失败' });
    }
  }
} 