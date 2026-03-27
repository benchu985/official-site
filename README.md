# official-site

人工回复 OpenAI 兼容 API 服务器，只有一个模型 `own`。

当收到 API 请求时，终端会提示输入回复内容，输入后按回车即作为 API 响应返回。

## 安装

```bash
git clone https://github.com/benchu985/official-site.git
cd official-site
npm install
```

## 启动

```bash
npm start
```

服务运行在 `http://0.0.0.0:2000`

## 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /v1/models | 获取模型列表 |
| POST | /v1/chat/completions | 聊天补全（支持流式和非流式） |

## 使用

API 地址填 `http://localhost:2000/v1`，密钥随便填，模型选 `own`。

收到请求后终端显示 `请输入官网回复内容:`，输入内容按回车即发送。
