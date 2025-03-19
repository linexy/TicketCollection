import { StationDistance } from '../models/StationDistance';

export class StationDistanceService {
  // 创建或更新站点距离信息
  static async createOrUpdateDistance(departureStation: string, arrivalStation: string, distance: number) {
    const [record] = await StationDistance.findOrCreate({
      where: {
        departureStation,
        arrivalStation
      },
      defaults: { distance }
    });

    if (record.distance !== distance) {
      record.distance = distance;
      await record.save();
    }

    return record;
  }

  // 获取两个站点之间的距离
  static async getDistance(departureStation: string, arrivalStation: string): Promise<number | null> {
    // 先查找直接匹配的记录
    const directMatch = await StationDistance.findOne({
      where: {
        departureStation,
        arrivalStation
      }
    });

    if (directMatch) {
      return directMatch.distance;
    }

    // 如果没有找到直接匹配，尝试反向查找（比如查找广州南到韶关的距离来获取韶关到广州南的距离）
    const reverseMatch = await StationDistance.findOne({
      where: {
        departureStation: arrivalStation,
        arrivalStation: departureStation
      }
    });

    return reverseMatch ? reverseMatch.distance : null;
  }
}