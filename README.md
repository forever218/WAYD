# What Are You Ding!

一个完全免费的抽象视奸程序
<img width="1222" height="628" alt="image" src="https://github.com/user-attachments/assets/b5718d52-f2bd-4bc6-907b-8609202240d3" />


## 功能特点

- 完全免费！（感谢GLM大哥开源）
- 持续视奸，直到永远永远



## 技术栈

- 前端框架：Next.js
- UI 样式：Tailwind CSS
- 桌面应用：Tauri


## 前置要求

- Node.js 16.x 或更高版本
- Rust 工具链
- 系统依赖（根据不同操作系统）


## 安装与运行

1. 安装依赖：

```bash
npm install
```

2. 开发模式运行：

```bash
npm run tauri dev
```

3. 构建生产版本：

```bash
npm run tauri build
```

## 使用说明

1. 启动应用后，点击右上角的"设置"按钮
2. 输入 API 端点（https://open.bigmodel.cn/api/paas/v4/）
3. 输入 API 密钥，获取地址：https://open.bigmodel.cn
4. 选择缓存文件夹
5. 点击"保存"按钮
6. 点击气泡化缩小窗口


## 注意事项

- 截图速率不应高于60s，否则容易触发API限制
- 请妥善保管您的 API 密钥
- 本应用直接与您指定的 API 端点通信，不会保存您的对话内容
- 部分游戏场景会被覆盖
