import * as schedule from 'node-schedule';
import { Op } from 'sequelize';
import { BaseTicket } from '../models/BaseTicket';
import { TrainTicket } from '../models/TrainTicket';
import { TrainTypeService } from './trainType.service';

/**
 * 车型信息更新调度服务
 * 负责在火车出发前1小时更新车型信息
 */
export class TrainTypeSchedulerService {
  private static scheduleJobs = new Map();

  /**
   * 为指定车票设置车型更新任务
   * @param trainTicket 火车票记录
   */
  static async scheduleSingleTicketTypeUpdate(trainTicket: any): Promise<void> {
    try {
      // 确保有baseTicket数据
      if (!trainTicket.baseTicket) {
        const baseTicket = await BaseTicket.findByPk(trainTicket.baseTicketId);
        if (!baseTicket) {
          console.error(`未找到车票的基本信息，ID: ${trainTicket.baseTicketId}`);
          return;
        }
        trainTicket.baseTicket = baseTicket;
      }

      // 获取出发时间
      const departureTime = new Date(trainTicket.baseTicket.departureTime);
      if (isNaN(departureTime.getTime())) {
        console.error(`车票ID ${trainTicket.id} 的出发时间无效: ${trainTicket.baseTicket.departureTime}`);
        return;
      }
      
      //  console.log(`车票ID ${trainTicket.id}, 车次 ${trainTicket.trainNo} 的出发时间: ${departureTime.toLocaleString()}`);
      
      // 计算更新时间（出发前1小时）
      const updateTime = new Date(departureTime.getTime() - 60 * 60 * 1000);
      
      // 如果更新时间已过，不设置任务
      if (updateTime <= new Date()) {
        //  console.log(`车票ID ${trainTicket.id}, 车次 ${trainTicket.trainNo} 的出发前1小时时间已过，跳过更新任务`);
        return;
      }
      
      // 任务ID，确保每个车票只有一个更新任务
      const jobId = `trainType_update_${trainTicket.id}`;
      
      // 如果已存在更新任务，先取消
      if (this.scheduleJobs.has(jobId)) {
        this.scheduleJobs.get(jobId).cancel();
        //  console.log(`已取消车票ID ${trainTicket.id} 的现有车型更新任务`);
      }
      
      // 创建新的更新任务
      const job = schedule.scheduleJob(updateTime, async () => {
        try {
        //  console.log(`开始执行车票ID ${trainTicket.id}, 车次 ${trainTicket.trainNo} 的车型更新任务...`);
          // 传递departureTime，确保使用正确的日期
          await this.updateTrainType(trainTicket.id, trainTicket.trainNo, departureTime);
        } catch (jobError) {
          console.error(`执行车票ID ${trainTicket.id} 的车型更新任务失败:`, jobError);
        }
      });
      
      // 存储任务引用
      this.scheduleJobs.set(jobId, job);
      
     // console.log(`已为车票ID ${trainTicket.id}, 车次 ${trainTicket.trainNo} 设置出发前1小时更新车型任务，预计在 ${updateTime.toLocaleString()} 执行`);
    } catch (error) {
      console.error('设置车型更新任务失败:', error);
      // 输出详细的错误堆栈
      if (error instanceof Error) {
        console.error(`错误堆栈: ${error.stack}`);
      }
    }
  }
  
  /**
   * 更新车票的车型信息
   * @param ticketId 车票ID
   * @param trainNo 车次
   * @param departureTime 出发时间
   */
  static async updateTrainType(ticketId: number, trainNo: string, departureTime: string | Date): Promise<void> {
    try {
     // console.log(`正在更新车票ID ${ticketId}, 车次 ${trainNo} 的车型信息...`);
      
      // 首先获取当前车票信息，确认车型
      const ticket = await TrainTicket.findByPk(ticketId);
      if (!ticket) {
        console.error(`未找到车票ID ${ticketId} 的信息，无法更新车型`);
        return;
      }
      
     // console.log(`车票ID ${ticketId} 当前车型: ${ticket.trainType || '未知'}`);
      
      // 调用TrainTypeService获取最新车型信息
      const trainType = await TrainTypeService.getTrainType(trainNo, departureTime);
      
      if (!trainType) {
        console.warn(`未能获取到车票ID ${ticketId}, 车次 ${trainNo} 的车型信息`);
        return;
      }
      
      // 如果车型相同，不进行更新
      if (ticket.trainType === trainType) {
       // console.log(`车票ID ${ticketId}, 车次 ${trainNo} 的车型未变更，仍为: ${trainType}`);
        return;
      }
      
      // 更新数据库中的车型信息
      await TrainTicket.update(
        { trainType },
        { where: { id: ticketId } }
      );
      
      // console.log(`成功更新车票ID ${ticketId}, 车次 ${trainNo} 的车型信息: ${ticket.trainType || '未知'} -> ${trainType}`);
    } catch (error) {
      console.error(`更新车型信息失败，车票ID ${ticketId}:`, error);
      // 输出错误堆栈，方便调试
      if (error instanceof Error) {
        console.error(`错误堆栈: ${error.stack}`);
      }
    }
  }
  
  /**
   * 初始化所有未来车票的车型更新任务
   */
  static async initializeAllUpdateTasks(): Promise<number> {
    try {
     // console.log('正在初始化所有未来车票的车型更新任务...');
      
      // 获取所有未来出发的车票
      const futureTickets = await TrainTicket.findAll({
        include: [{
          model: BaseTicket,
          as: 'baseTicket',
          where: {
            departureTime: {
              [Op.gt]: new Date()
            },
            ticketType: '火车票'
          },
          required: true
        }]
      });
      
     // console.log(`找到 ${futureTickets.length} 张未来出发的火车票`);
      
      // 为每张车票设置更新任务
      let scheduledCount = 0;
      for (const ticket of futureTickets) {
        await this.scheduleSingleTicketTypeUpdate(ticket);
        scheduledCount++;
      }
      
    //  console.log(`成功设置 ${scheduledCount} 个车型更新任务`);
      return scheduledCount;
    } catch (error) {
      console.error('初始化车型更新任务失败:', error);
      return 0;
    }
  }

  /**
   * 立即更新指定车票的车型信息（无需等待定时任务）
   * @param ticketId 车票ID
   * @returns 更新结果
   */
  static async updateTrainTypeImmediately(ticketId: number): Promise<{ success: boolean; message: string; oldType?: string; newType?: string }> {
    try {
     // console.log(`立即更新车票ID ${ticketId} 的车型信息...`);
      
      // 获取车票信息
      const ticket = await TrainTicket.findByPk(ticketId, {
        include: [{
          model: BaseTicket,
          as: 'baseTicket',
          required: true
        }]
      });
      
      if (!ticket) {
        return { 
          success: false, 
          message: `未找到车票ID ${ticketId} 的信息` 
        };
      }
      
      const oldType = ticket.trainType || '';
     // console.log(`车票ID ${ticketId}, 车次 ${ticket.trainNo} 当前车型: ${oldType || '未知'}`);
      
      // 获取并更新车型
      const departureTime = new Date(ticket.baseTicket.departureTime);
      const trainType = await TrainTypeService.getTrainType(ticket.trainNo, departureTime);
      
      if (!trainType) {
        return { 
          success: false, 
          message: `未能获取到车次 ${ticket.trainNo} 的车型信息`,
          oldType
        };
      }
      
      // 如果车型相同，不更新
      if (oldType === trainType) {
        return { 
          success: true, 
          message: `车型未变更，仍为: ${trainType}`,
          oldType,
          newType: trainType
        };
      }
      
      // 更新车型
      await ticket.update({ trainType });
      
     // console.log(`成功更新车票ID ${ticketId}, 车次 ${ticket.trainNo} 的车型: ${oldType || '未知'} -> ${trainType}`);
      
      return { 
        success: true, 
        message: `成功更新车型: ${oldType || '未知'} -> ${trainType}`,
        oldType,
        newType: trainType
      };
    } catch (error) {
      console.error(`立即更新车型失败，车票ID ${ticketId}:`, error);
      if (error instanceof Error) {
        return { 
          success: false, 
          message: `更新失败: ${error.message}`
        };
      }
      return { 
        success: false, 
        message: '更新失败：未知错误'
      };
    }
  }
} 