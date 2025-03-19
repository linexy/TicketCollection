# 后端脚本工具

本目录包含各种用于系统维护和数据管理的脚本工具。

## 车次数据导入工具 (importTrainNumbers.ts)

该脚本用于从JSON文件导入车次数据到trains表中。JSON文件格式为键值对，其中键是trainNo，值是train_no。

### 使用方法

默认情况下，脚本会读取 `src/data/no_list20250228.json` 文件：

```bash
npm run import-train-numbers
```

也可以指定其他JSON文件路径：

```bash
npm run import-train-numbers -- /path/to/your/file.json
```

### 功能说明

1. 脚本会读取指定的JSON文件，解析其中的车次数据
2. 将数据分批处理（每批100条记录），避免数据库连接超时
3. 对于每个车次，会根据trainNo查找数据库中是否已存在记录
4. 如果不存在，则创建新记录
5. 如果已存在但train_no不同，则更新train_no
6. 每批处理完成后会输出该批次的统计信息
7. 最后输出总体统计信息：新建、更新、未变和错误的记录数量

### 错误处理

- 脚本采用批处理方式，即使某一批处理失败，也会继续处理后续批次
- 每批处理前会重新验证数据库连接，避免连接超时问题
- 批次之间有短暂延迟，避免数据库压力过大
- 脚本结束时会正确关闭数据库连接

### 注意事项

- JSON文件格式必须为 `{"trainNo": "train_no", ...}`，例如 `{"G9": "24000000G906", "G11": "2400000G110P", ...}`
- 脚本会自动连接数据库并同步模型
- 如果处理某个车次时出错，脚本会继续处理其他车次，并在最后输出错误统计
- 对于大量数据，脚本会分批处理，每批100条记录，以避免连接超时问题

## 其他脚本

- syncTrains.ts: 同步车次数据
- syncStations.ts: 同步车站数据
    -npx ts-node syncStatins.ts
- initNotificationJobs.ts: 初始化通知任务
- updateTicketDistance.ts: 更新票价距离
- updateTrainTypes.ts: 更新列车类型
- createAdmin.ts: 创建管理员账户 