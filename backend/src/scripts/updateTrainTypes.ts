import { TrainTicket } from '../models/TrainTicket';
import { BaseTicket } from '../models/BaseTicket';
import { TrainTypeService } from '../services/trainType.service';
import { Op } from 'sequelize';
import fs from 'fs';

const PROGRESS_FILE = 'update_train_types_progress.json';
const BATCH_SIZE = 10;

interface Progress {
  lastProcessedId: number;
  totalProcessed: number;
}

async function loadProgress(): Promise<Progress> {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('加载进度文件失败:', error);
  }
  return { lastProcessedId: 0, totalProcessed: 0 };
}

async function saveProgress(progress: Progress): Promise<void> {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress), 'utf8');
  } catch (error) {
    console.error('保存进度失败:', error);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateTrainTypes() {
  const progress = await loadProgress();
  console.log('开始处理，上次处理到ID:', progress.lastProcessedId);

  while (true) {
    // 获取一批需要更新的车票
    const tickets = await TrainTicket.findAll({
      where: {
        id: { [Op.gt]: progress.lastProcessedId },
        trainType: { [Op.or]: [null, ''] },
        trainNo: { [Op.regexp]: '^[GDC]' }
      },
      include: [{
        model: BaseTicket,
        as: 'baseTicket',
        required: true
      }],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE
    });

    if (tickets.length === 0) {
      console.log('所有车票处理完成！');
      break;
    }

    for (const ticket of tickets) {
      try {
        const trainType = await TrainTypeService.getTrainType(
          ticket.trainNo,
          ticket.baseTicket.departureTime
        );

        if (trainType) {
          await ticket.update({ trainType });
          console.log(`更新成功 - ID: ${ticket.id}, 车次: ${ticket.trainNo}, 车型: ${trainType}`);
        } else {
          console.log(`未找到车型信息 - ID: ${ticket.id}, 车次: ${ticket.trainNo}`);
        }

        progress.lastProcessedId = ticket.id;
        progress.totalProcessed++;
        await saveProgress(progress);

        // 等待60秒以符合API限制
        await sleep(20000);
      } catch (error) {
        console.error(`处理车票失败 - ID: ${ticket.id}:`, error);
        // 即使失败也保存进度，以便后续重试
        await saveProgress(progress);
      }
    }

    console.log(`当前批次处理完成，已处理总数: ${progress.totalProcessed}`);
  }
}

// 启动脚本
updateTrainTypes().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});