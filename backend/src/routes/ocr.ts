import express from 'express';
import { ocrService } from '../services/ocrService';

const router = express.Router();

router.post('/recognize', async (req, res) => {
  try {
    const { image } = req.body;
    
    if (!image) {
      return res.status(400).json({
        success: false,
        message: '缺少图片数据'
      });
    }

    const result = await ocrService.recognizeText(image);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('OCR识别请求失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '识别失败'
    });
  }
});

export default router; 