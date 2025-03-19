import { sequelize } from '../config/database';
import { TrainTicket } from '../models/TrainTicket';
import { BaseTicket } from '../models/BaseTicket';
import { User } from '../models/User';
import { PushNotificationService } from '../services/pushNotification.service';
import { Op } from 'sequelize';
import '../models/index'; // 导入模型关联设置

async function initNotificationJobs() {
  try {
    await sequelize.authenticate();
    console.log('开始初始化通知任务...');

    // 查找所有未来的车票
    const futureTickets = await TrainTicket.findAll({
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        where: {
          departureTime: {
            [Op.gt]: new Date()
          }
        }
      }]
    });

    console.log(`找到 ${futureTickets.length} 张未来的车票`);

    // 获取所有用户
    const users = await User.findAll();

    let scheduledCount = 0;
    for (const ticket of futureTickets) {
      for (const user of users) {
        try {
          await PushNotificationService.scheduleTrainNotification(
            {
              ...ticket.get({ plain: true }),
              baseTicket: ticket.baseTicket?.get({ plain: true })
            },
            user.id
          );
          scheduledCount++;
          console.log(`成功为车票 ${ticket.id} 用户 ${user.id} 设置通知`);
        } catch (error) {
          console.error(`为车票 ${ticket.id} 用户 ${user.id} 设置通知失败:`, error);
        }
      }
    }

    console.log(`成功设置 ${scheduledCount} 个通知任务`);
    
  } catch (error) {
    console.error('初始化通知任务失败:', error);
  } finally {
    await sequelize.close();
  }
}

// 执行初始化
initNotificationJobs(); 