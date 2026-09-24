# scratch-pad

单文件 HTML 小工具与交互文档的存放处，通过 GitHub Pages 直接在浏览器打开。

在线地址：https://miaodx.com/scratch-pad/

## 页面

| 页面 | 说明 |
|---|---|
| [机器人数据管线成本模型](https://miaodx.com/scratch-pad/robot-data-cost-model/) | 从采集小时数推算存储、算力、传输与交付成本；参数可调，情景可通过链接分享。默认值均为示例估计。 |

## 约定

- 每个页面一个目录，入口为 `<name>/index.html`，自包含（CSS/JS 内联，外部库仅从 CDN 加载）。
- 新增页面时同步更新根目录的 `index.html` 和本 README 的页面列表。
- 推送到 `main` 后由 GitHub Pages 自动发布，无需构建。

## License

[MIT](LICENSE)
