import express from 'express';
import { PushSubscription } from '../models/PushSubscription';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
   // console.log('Processing subscription for user:', userId);
   // console.log('Request body:', JSON.stringify(req.body, null, 2));
   // console.log('Request headers:', req.headers);

    if (!req.body.endpoint || !req.body.keys) {
      console.error('Invalid subscription data received');
      return res.status(400).json({
        success: false,
        message: '无效的订阅数据'
      });
    }

    const subscription = await PushSubscription.create({
      userId,
      endpoint: req.body.endpoint,
      p256dh: req.body.keys.p256dh,
      auth: req.body.keys.auth
    });

   // console.log('Created subscription:', subscription.toJSON());
    res.json({ success: true });
  } catch (error) {
    console.error('保存推送订阅失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '保存推送订阅失败'
    });
  }
});

export default router; 