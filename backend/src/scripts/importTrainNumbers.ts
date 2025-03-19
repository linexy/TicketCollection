import fs from 'fs';
import path from 'path';
import { sequelize } from '../config/database';
import Train from '../models/Train';

/**
 * 从JSON文件导入车次数据到trains表
 * JSON文件格式: {"trainNo": "train_no", ...}
 * 例如: {"G9": "24000000G906", "G11": "2400000G110P", ...}
 */
async function importTrainNumbers(jsonFilePath: string) {
  try {
    // 读取JSON文件
    console.log(`正在读取文件: ${jsonFilePath}`);
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    const trainData = JSON.parse(jsonData);
    
    console.log(`成功解析JSON文件，共有${Object.keys(trainData).length}条记录`);
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 同步数据库模型
    await sequelize.sync();
    
    // 将数据分批处理，每批100条记录
    const batchSize = 100;
    const entries = Object.entries(trainData);
    const totalBatches = Math.ceil(entries.length / batchSize);
    
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, entries.length);
      const batch = entries.slice(start, end);
      
      console.log(`处理批次 ${batchIndex + 1}/${totalBatches} (${start + 1}-${end}/${entries.length})`);
      
      try {
        // 重新连接数据库，避免连接超时
        if (batchIndex > 0) {
          try {
            await sequelize.authenticate();
          } catch (connError) {
            console.error('重新连接数据库失败，尝试继续处理...', connError);
          }
        }
        
        // 批量处理记录
        const batchResults = await Promise.all(
          batch.map(async ([trainNo, train_no]) => {
            try {
              // 查找是否已存在该trainNo的记录
              const [train, created] = await Train.findOrCreate({
                where: { trainNo },
                defaults: { 
                  trainNo, 
                  train_no: train_no as string 
                }
              });
              
              // 如果记录已存在但train_no不同，则更新
              if (!created && train.train_no !== train_no) {
                train.train_no = train_no as string;
                await train.save();
                return { trainNo, status: 'updated' };
              }
              
              return { trainNo, status: created ? 'created' : 'unchanged' };
            } catch (error) {
              console.error(`处理车次 ${trainNo} 时出错:`, error);
              return { trainNo, status: 'error', error };
            }
          })
        );
        
        // 统计批次结果
        const batchCreated = batchResults.filter(r => r.status === 'created').length;
        const batchUpdated = batchResults.filter(r => r.status === 'updated').length;
        const batchUnchanged = batchResults.filter(r => r.status === 'unchanged').length;
        const batchErrors = batchResults.filter(r => r.status === 'error').length;
        
        created += batchCreated;
        updated += batchUpdated;
        unchanged += batchUnchanged;
        errors += batchErrors;
        
        console.log(`批次 ${batchIndex + 1} 结果: 新建=${batchCreated}, 更新=${batchUpdated}, 未变=${batchUnchanged}, 错误=${batchErrors}`);
      } catch (batchError) {
        console.error(`处理批次 ${batchIndex + 1} 时出错:`, batchError);
        errors += batch.length;
      }
      
      // 等待一小段时间，避免连续请求导致数据库压力过大
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('导入完成，结果统计:');
    console.log(`- 新建: ${created}`);
    console.log(`- 更新: ${updated}`);
    console.log(`- 未变: ${unchanged}`);
    console.log(`- 错误: ${errors}`);
    console.log(`- 总计: ${created + updated + unchanged + errors}/${entries.length}`);
    
    // 关闭数据库连接
    await sequelize.close();
    console.log('数据库连接已关闭');
    
    process.exit(0);
  } catch (error) {
    console.error('导入车次数据失败:', error);
    
    // 尝试关闭数据库连接
    try {
      await sequelize.close();
      console.log('数据库连接已关闭');
    } catch (closeError) {
      console.error('关闭数据库连接失败:', closeError);
    }
    
    process.exit(1);
  }
}

// 获取命令行参数中的文件路径，如果没有提供则使用默认路径
const jsonFilePath = process.argv[2] || path.join(__dirname, '../data/no_list20250228.json');

// 执行导入
importTrainNumbers(jsonFilePath); 