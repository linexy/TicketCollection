# 火车票收集系统

这是一个用于收集和管理火车票信息的全栈应用程序。系统支持用户注册、登录、票务信息管理、数据统计等功能。

## 技术栈

### 后端
- Node.js + TypeScript
- Express.js
- MariaDB + Sequelize ORM
- Web Push 通知
- Puppeteer (用于网页爬虫)
- JWT 认证

### 前端
- React + TypeScript
- Ant Design + Ant Design Mobile
- Chart.js + ECharts (数据可视化)
- React Router (路由管理)
- Web Push (浏览器通知)

## 项目结构

```
.
├── backend/                # 后端服务
│   ├── src/               # 源代码
│   ├── package.json       # 后端依赖
│   └── tsconfig.json      # TypeScript 配置
└── frontend/              # 前端应用
    ├── src/               # 源代码
    ├── public/            # 静态资源
    ├── package.json       # 前端依赖
    └── tsconfig.json      # TypeScript 配置
```

## 安装说明

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
- 复制 `.env.example` 为 `.env`
- 填写必要的环境变量（数据库配置、JWT密钥等）

4. 初始化数据库：
```bash
npm run init-notifications
npm run init-train-types
npm run import-train-numbers
```

### 前端设置

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
- 复制 `.env.example` 为 `.env`
- 填写必要的环境变量

## 运行项目

### 开发环境

1. 启动后端服务：
```bash
cd backend
npm run dev
```

2. 启动前端开发服务器：
```bash
cd frontend
npm start
```

### 生产环境

1. 构建前端：
```bash
cd frontend
npm run build
```

2. 启动后端服务：
```bash
cd backend
npm start
```

## 主要功能

- 用户认证（注册/登录）
- 火车票信息管理
- 数据统计和可视化
- 实时通知推送
- 移动端适配
- 数据导出功能

## 注意事项

- 确保已安装 Node.js (推荐 v14 或更高版本)
- 确保 MariaDB 服务已启动
- 前端开发服务器默认运行在 3000 端口
- 后端服务器默认运行在 3001 端口

## 许可证

MIT License 