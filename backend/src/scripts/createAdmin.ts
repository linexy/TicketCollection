import { sequelize } from '../config/database';
import { User } from '../models/User';
import * as bcrypt from 'bcrypt';

async function createAdmin() {
  try {
    await sequelize.sync();
    
    const existingAdmin = await User.findOne({ 
      where: { username: 'linexy' } 
    });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Ljs@1236547', 10);
      await User.create({
        username: 'linexy',
        password: hashedPassword
      });
      console.log('管理员账号创建成功');
    } else {
      console.log('管理员账号已存在');
    }
  } catch (error) {
    console.error('创建管理员账号失败:', error);
  }
}

createAdmin(); 