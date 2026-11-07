<h1 align="center">爱聊（WeChat.ai）</h1>

<p align="center">
  将豆包与 DeepSeek 网页版接入同一群聊，通过纯前端用户脚本实现双 AI 自动往返对话。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-2f6feb?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Edge%20%7C%20Android-555?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Server-None-2ea44f?style=flat-square" alt="No Server">
  <img src="https://img.shields.io/badge/API%20Key-Not%20Required-6e7781?style=flat-square" alt="No API Key">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-0969da?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="#概述">概述</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#配置">配置</a> ·
  <a href="#更新日志">更新日志</a> ·
  <a href="#贡献">贡献</a> ·
  <a href="#许可证">许可证</a>
</p>

---

## 概述

爱聊是一个纯前端用户脚本。它不调用 API、不依赖官方 SDK、不需要服务器，仅在豆包与 DeepSeek 网页输入框中完成“输入、发送、读取回复、转发至另一端”的自动化流程。

脚本以 `.js` 文件分发，需通过浏览器脚本管理器导入。**Via 浏览器不支持 `.crx` 扩展，请勿将本项目作为 Chrome 扩展安装。**

---

## 快速开始

### 前置条件

- 已登录 [豆包](https://www.doubao.com) 与 [DeepSeek](https://chat.deepseek.com) 账号
- 两个标签页同时保持打开，每端各自负责半轮对话循环
- PC 端：Windows Edge 浏览器，并安装 Tampermonkey
- 移动端：Android 设备，并安装 [Via 浏览器](https://viayoo.com/)

### 快速验证

同时打开豆包与 DeepSeek 标签页，页面右下角出现浮动聊天窗口后，输入一条消息并发送。两个 AI 将按设定轮次与长度自动交替对话。

---

## 安装

> 安装完成后，请同时打开豆包与 DeepSeek 两个标签页。右下角出现浮动聊天窗口，即表示脚本已生效。

### PC 端（Windows Edge）

| 步骤 | 操作 |
|---|---|
| 1 | 在 Edge 扩展商店安装 [Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)，或访问 [Tampermonkey 官网](https://www.tampermonkey.net) 选择其他安装方式 |
| 2 | 点击浏览器右上角 Tampermonkey 图标，进入“管理面板” |
| 3 | 点击“+”新建脚本，清空编辑器默认代码 |
| 4 | 粘贴本项目全部代码，按 `Ctrl + S` 保存并启用 |
| 5 | 确认脚本 `@match` 包含 `https://www.doubao.com/*` 与 `https://chat.deepseek.com/*` |

> 两个 `@match` 规则缺一不可，否则对应网站的聊天窗口不会出现。

### 移动端（Android Via）

| 步骤 | 操作 |
|---|---|
| 1 | 将脚本保存为 `WeChat-ai.js` |
| 2 | 打开 Via 浏览器，进入“菜单 → 设置 → 脚本 → + → 导入脚本” |
| 3 | 选择 `WeChat-ai.js`，确认 `@match` 包含两个目标站点 |
| 4 | 保存并启用 |

> Via 不支持 `.crx` 扩展。请务必通过 Via 内置脚本管理器导入 `.user.js` / `.js` 脚本。

---

## 功能

| 功能 | 说明 |
|---|---|
| PC 微信风格界面 | 左右气泡、头像、标题栏、消息区、输入区完整布局，支持拖拽、八向缩放、边缘吸附与分屏布局 |
| 双 AI 自动循环 | 用户消息触发豆包回复，豆包回复转发至 DeepSeek，DeepSeek 回复再转发回豆包 |
| 轮次与长度控制 | `maxRounds` 控制往返轮数，`maxChars` 限制单条回复的软性长度 |
| 图片互通 | 提取豆包生成图片并渲染；用户可通过上传按钮发送图片 |
| 窗口管理 | 支持移动、缩放、最大化、最小化至边缘、双击标题栏最大化、快捷键 `Alt + W` 召出 |
| 主题与字号 | 支持亮色、暗色、跟随系统三种主题，以及小、中、大三档字号 |
| 窗口透明度 | 支持 30%–100% 透明度调节，窗口外壳呈现毛玻璃效果，消息气泡保持不透明以确保可读性 |
| 自定义样式 | 支持自定义 CSS 与本地 CSS 导入 |
| 自定义背景与头像 | 空白区右键更换背景；点击头像上传自定义头像并自动裁剪 |
| 上滑刷新 | 消息区滚动至顶部后上滑刷新页面 |
| 持久化历史 | 消息通过 `GM_setValue` 存储，刷新或重启浏览器后不丢失 |
| 代码块渲染 | 回复中的代码块支持语法高亮与复制 |

---

## 配置

配置位于脚本顶部：

```javascript
const DEFAULT_MAX_ROUNDS = 1;   // 每条用户消息触发的豆包与 DeepSeek 往返轮数
const DEFAULT_MAX_CHARS  = 100; // 追加到每条 AI prompt 的软性字数提示，0 表示不限
