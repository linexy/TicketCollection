import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription';
import { format } from 'date-fns';
import dotenv from 'dotenv';
import schedule from 'node-schedule';
import { NotificationJob } from '../models/NotificationJob';
import { TrainTicket } from '../models/TrainTicket';
import { BaseTicket } from '../models/BaseTicket';
import { Op } from 'sequelize';
import { WebPushError } from 'web-push';

dotenv.config();

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!
};

webpush.setVapidDetails(
  'https://your-website.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export class PushNotificationService {
  private static scheduleJobs = new Map();

  static async getScheduledJobs() {
    const jobs = await NotificationJob.findAll({
      where: { status: 'pending' },
      order: [['scheduledTime', 'ASC']]
    });
    
    return {
      total: jobs.length,
      jobs: jobs.map(job => ({
        jobId: job.jobId,
        scheduledTime: job.scheduledTime.toLocaleString(),
        status: job.status
      }))
    };
  }

  static async sendNotification(subscription: any, payload: any) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (error: unknown) {
      if (error instanceof WebPushError && error.statusCode === 410) {
        await PushSubscription.destroy({
          where: { endpoint: subscription.endpoint }
        });
       // console.log('删除失效的推送订阅:', subscription.endpoint);
      }
      throw error;
    }
  }

  static async scheduleTrainNotification(trainTicket: any, userId: number) {
    try {
      const departureTime = new Date(trainTicket.baseTicket.departureTime);
      const notificationTime = new Date(departureTime.getTime() - 60 * 60 * 1000);

      // 检查时间是否已过
      if (notificationTime <= new Date()) {
       // console.log('通知时间已过，立即发送通知');
        await this.sendImmediateNotification(trainTicket, userId);
        return;
      }

      // 获取用户的所有有效订阅
      const subscriptions = await PushSubscription.findAll({
        where: { userId }
      });

      if (subscriptions.length === 0) {
        console.log('未找到推送订阅信息');
        return;
      }

      // 为每个订阅创建通知任务
      for (const subscription of subscriptions) {
        const jobId = `train_${trainTicket.id}_${userId}_${subscription.id}`;
        
        // 保存到数据库
        await NotificationJob.create({
          jobId,
          userId,
          trainTicketId: trainTicket.id,
          scheduledTime: notificationTime,
          status: 'pending'
        });

        // 取消已存在的相同任务
        if (this.scheduleJobs.has(jobId)) {
          this.scheduleJobs.get(jobId).cancel();
        }

        const job = schedule.scheduleJob(notificationTime, async () => {
          await this.sendImmediateNotification(trainTicket, userId);
        });

        this.scheduleJobs.set(jobId, job);
      //  console.log(`已设置推送通知: ${jobId}, 将在 ${notificationTime.toLocaleString()} 发送`);
      }
    } catch (error) {
      console.error('设置推送通知失败:', error);
    }
  }

  // 新增立即发送通知的方法
  private static async sendImmediateNotification(trainTicket: any, userId: number) {
    try {
      const subscription = await PushSubscription.findOne({
        where: { userId }
      });

      if (!subscription) return;

      const departureTime = new Date(trainTicket.baseTicket.departureTime);
      const jobId = `train_${trainTicket.id}_${userId}`;

      const payload = {
        title: '您的旅程即将开始',
        body: `${trainTicket.trainNo}次列车将于${format(departureTime, 'HH:mm')}发车，座位${trainTicket.carNo}车${trainTicket.seatNo}，祝您旅途愉快！`,
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        tag: jobId,
        timestamp: Date.now()
      };

      await this.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      }, payload);

      // 更新任务状态
      await NotificationJob.update(
        { status: 'completed' },
        { where: { jobId } }
      );

      console.log(`成功发送通知: ${jobId}`);
    } catch (error) {
      console.error('发送通知失败:', error);
      throw error;
    }
  }

  static async reloadPendingJobs() {
    try {
      const pendingJobs = await NotificationJob.findAll({
        where: { 
          status: 'pending'
        },
        include: [{
          model: TrainTicket,
          as: 'trainTicket',
          include: [{
            model: BaseTicket,
            as: 'baseTicket'
          }]
        }]
      });

      console.log(`找到 ${pendingJobs.length} 个待处理的通知任务`);

      for (const job of pendingJobs) {
        const notificationTime = new Date(job.scheduledTime);
        const now = new Date();

        // 如果通知时间已过，立即发送通知
        if (notificationTime <= now) {
          try {
            const subscription = await PushSubscription.findOne({
              where: { userId: job.userId }
            });

            if (subscription && job.trainTicket && job.trainTicket.baseTicket) {
              const trainTicket = job.trainTicket;
              const departureTime = new Date(trainTicket.baseTicket.departureTime);

              const payload = {
                title: '您的旅程即将开始',
                body: `${trainTicket.trainNo}次列车将于${format(departureTime, 'HH:mm')}发车，座位${trainTicket.carNo}车${trainTicket.seatNo}，祝您旅途愉快！`,
                icon: '/logo192.png',
                badge: '/logo192.png',
                vibrate: [200, 100, 200],
                tag: job.jobId,
                timestamp: Date.now()
              };

              await this.sendNotification({
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth
                }
              }, payload);

              await job.update({ status: 'completed' });
              console.log(`补发通知成功: ${job.jobId}`);
            }
          } catch (error) {
            console.error(`补发通知失败: ${job.jobId}`, error);
            await job.update({ status: 'failed' });
          }
        } else {
          // 如果通知时间未到，重新设置定时任务
          const newJob = schedule.scheduleJob(notificationTime, async () => {
            try {
              const subscription = await PushSubscription.findOne({
                where: { userId: job.userId }
              });

              if (subscription && job.trainTicket && job.trainTicket.baseTicket) {
                const trainTicket = job.trainTicket;
                const departureTime = new Date(trainTicket.baseTicket.departureTime);

                const payload = {
                  title: '您的旅程即将开始',
                  body: `${trainTicket.trainNo}次列车将于${format(departureTime, 'HH:mm')}发车，座位${trainTicket.carNo}车${trainTicket.seatNo}，祝您旅途愉快！`,
                  icon: '/logo192.png',
                  badge: '/logo192.png',
                  vibrate: [200, 100, 200],
                  tag: job.jobId,
                  timestamp: Date.now()
                };

                await this.sendNotification({
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth
                  }
                }, payload);

                await job.update({ status: 'completed' });
                console.log(`定时通知发送成功: ${job.jobId}`);
              } else {
                console.log(`跳过通知: ${job.jobId} - 缺少必要数据`);
                await job.update({ status: 'failed' });
              }
            } catch (error) {
              console.error(`定时通知发送失败: ${job.jobId}`, error);
              await job.update({ status: 'failed' });
            }
          });

          this.scheduleJobs.set(job.jobId, newJob);
        }
      }
    } catch (error) {
      console.error('重新加载通知任务失败:', error);
    }
  }
} 