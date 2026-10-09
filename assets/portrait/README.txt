人像抠图本地资源
==================

本目录供 MultiGrid-Collage.html 的“人像抠图”功能使用。
请不要删除、改名或单独移动其中任何文件。

组成：
- ort.min.js：ONNX Runtime Web 1.17.3
- ort-wasm-data.js：内嵌为 Base64 的单线程 SIMD WASM 运行库
- portrait-model-data.js：内嵌为 Base64 的 U²-Net 轻量模型（u2netp，320×320）

采用内嵌数据文件是为了兼容 file:// 直接双击 HTML 的使用方式，避免浏览器
阻止从本地路径 fetch 模型或 WASM。运行时不会访问服务器，也不会上传图片。

校验值（SHA-256）：
- WASM：6783fcd6647ce1b426a527c31412a9c40894552faa609e9c931b3239a3438071
- 模型：309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8

上游项目：
- ONNX Runtime：https://github.com/microsoft/onnxruntime
- rembg / u2netp：https://github.com/danielgatis/rembg
