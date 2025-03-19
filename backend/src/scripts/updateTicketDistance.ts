import { BaseTicket } from '../models/BaseTicket';
import { StationDistance } from '../models/StationDistance';
import { sequelize } from '../config/database';
import { Op } from 'sequelize';

async function updateTicketDistance() {
  try {
    console.log('开始更新车票里程数据...');

    // 查找所有distance为0或null的车票记录
    const tickets = await BaseTicket.findAll({
      where: {
        [Op.or]: [
          { distance: 0 },
          { distance: null }
        ]
      }
    });

    console.log(`找到${tickets.length}条需要更新的记录`);

    let updatedCount = 0;
    let errorCount = 0;

    // 使用事务确保数据一致性
    const t = await sequelize.transaction();

    try {
      for (const ticket of tickets) {
        // 查询对应的站点距离（考虑双向查询）
        let stationDistance = await StationDistance.findOne({
          where: {
            departureStation: ticket.departureStation,
            arrivalStation: ticket.arrivalStation
          },
          transaction: t
        });

        // 如果没找到，尝试反向查询
        if (!stationDistance) {
          stationDistance = await StationDistance.findOne({
            where: {
              departureStation: ticket.arrivalStation,
              arrivalStation: ticket.departureStation
            },
            transaction: t
          });
        }

        if (stationDistance) {
          // 更新车票的距离信息
          await ticket.update(
            { distance: stationDistance.distance },
            { transaction: t }
          );
          updatedCount++;
        } else {
          console.log(`未找到站点距离信息: ${ticket.departureStation} -> ${ticket.arrivalStation}`);
          errorCount++;
        }
      }

      // 提交事务
      await t.commit();
      console.log('更新完成！');
      console.log(`成功更新: ${updatedCount}条记录`);
      console.log(`未找到距离信息: ${errorCount}条记录`);

    } catch (error) {
      // 发生错误时回滚事务
      await t.rollback();
      throw error;
    }

  } catch (error) {
    console.error('更新过程中发生错误:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
  }
}

// 执行更新脚本
updateTicketDistance();