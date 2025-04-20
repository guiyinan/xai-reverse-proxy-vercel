const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const app = express();

// 启用 CORS
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization'
}));

// 处理预检请求
app.options('*', cors());

// 为流式传输配置代理选项 - 适用于 http-proxy-middleware 3.x 版本
const proxyMiddleware = createProxyMiddleware({
  target: 'https://api.x.ai',
  changeOrigin: true,
  ws: true, // 支持 WebSocket
  onProxyReq: (proxyReq, req) => {
    // 转发原始 Authorization 头
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // 确保正确处理流式请求
    if (req.headers['accept'] && req.headers['accept'].includes('text/event-stream')) {
      proxyReq.setHeader('Accept', 'text/event-stream');
    }
    
    console.log(`[DEBUG] 代理请求: ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // 添加CORS头
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    
    // 保留流式响应头
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/event-stream')) {
      proxyRes.headers['Content-Type'] = 'text/event-stream';
      proxyRes.headers['Cache-Control'] = 'no-cache';
      proxyRes.headers['Connection'] = 'keep-alive';
      proxyRes.headers['X-Accel-Buffering'] = 'no'; // 禁用 Nginx 缓冲

      console.log('[DEBUG] 检测到流式响应，已设置适当的响应头');
    }
    
    console.log(`[DEBUG] 代理响应: ${proxyRes.statusCode}, Content-Type: ${proxyRes.headers['content-type'] || '未知'}`);
  },
  // 设置不缓冲响应
  selfHandleResponse: false,
  // 错误处理
  onError: (err, req, res) => {
    console.error('[ERROR] 代理错误:', err);
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/plain',
      });
      res.end('代理服务器错误: ' + err.message);
    }
  }
});

// 代理所有请求到 x.ai
app.use('/', proxyMiddleware);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('[ERROR] Express错误:', err);
  if (!res.headersSent) {
    res.status(500).send('服务器错误');
  }
});

// 开发环境运行服务器
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[INFO] 服务器在端口 ${PORT} 上运行`);
  });
}

// Vercel 需要导出 app
module.exports = app;
