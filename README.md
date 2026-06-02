# AI 对话助手

一个使用 Next.js + Tauri 构建的简单 AI 对话应用，支持自定义大模型 API 端点和密钥。

## 功能特点

- 自定义 API 端点和密钥
- 简洁的聊天界面
- 支持 Markdown 格式显示
- 设置本地存储，无需重复输入

## 技术栈

- 前端框架：Next.js
- UI 样式：Tailwind CSS
- 桌面应用：Tauri
- Markdown 渲染：react-markdown

## 前置要求

- Node.js 16.x 或更高版本
- Rust 工具链
- 系统依赖（根据不同操作系统）

### Windows

安装 Visual Studio C++ 构建工具。

### macOS

安装 Xcode 命令行工具。

### Linux

安装 webkit2gtk：

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev     build-essential     curl     wget     file     libxdo-dev     libssl-dev     libayatana-appindicator3-dev     librsvg2-dev
```

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
2. 输入您的 API 端点（例如：https://api.openai.com/v1/chat/completions）
3. 输入您的 API 密钥
4. 点击"保存"按钮
5. 开始与 AI 进行对话

## 注意事项

- 请妥善保管您的 API 密钥
- 本应用直接与您指定的 API 端点通信，不会保存您的对话内容
