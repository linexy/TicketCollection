import express from 'express';
import { User } from '../models/User';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PushSubscription } from '../models/PushSubscription';
import { Op } from 'sequelize';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      where: { username } 
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // 登录成功后，删除该用户的所有失效订阅
    await PushSubscription.destroy({
      where: { 
        userId: user.id,
        updatedAt: {
          [Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30天前的订阅
        }
      }
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '服务器错误' 
    });
  }
});

export default router; 