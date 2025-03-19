/**
 * 初始化所有火车票的车型更新任务
 * 该脚本可以在系统启动时运行，也可作为独立的计划任务运行
 */

import { sequelize } from '../config/database';
import { TrainTypeSchedulerService } from '../services/trainTypeScheduler.service';
import '../models/index'; // 导入模型关联设置

async function initTrainTypeUpdateJobs() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功，开始初始化车型更新任务...');

    // 调用服务初始化所有未来车票的车型更新任务
    const scheduledCount = await TrainTypeSchedulerService.initializeAllUpdateTasks();
    
    console.log(`成功初始化 ${scheduledCount} 个车型更新任务！`);
  } catch (error) {
    console.error('初始化车型更新任务失败:', error);
  } finally {
    // 对于独立运行的脚本，完成后关闭数据库连接
    if (require.main === module) {
      await sequelize.close();
      console.log('数据库连接已关闭');
    }
  }
}

// 如果直接运行该脚本，则执行初始化
if (require.main === module) {
  initTrainTypeUpdateJobs()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

export default initTrainTypeUpdateJobs; 