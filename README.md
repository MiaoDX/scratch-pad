# scratch-pad

研发方向的讨论材料：单文件 HTML 小工具与交互文档，以及 `notes/` 下的方向决策记录。交互页面通过 GitHub Pages 直接在浏览器打开。

在线地址：https://miaodx.com/scratch-pad/

## 页面

| 页面 | 说明 |
|---|---|
| [机器人数据管线成本模型](https://miaodx.com/scratch-pad/robot-data-cost-model/) | 详细版：从采集小时数逐日推算存储、算力、传输与交付成本。默认值均为示例估计。 |
| [机器人数据基础设施 · 管理层 V2](https://miaodx.com/scratch-pad/robot-data-cost-model/v2.html) | 管理层版：五个业务变量，对比全云标准、全云分层、机房窗口 + 云归档三种方案的 36 个月总成本。 |

## Notes

[`notes/`](notes/INDEX.md) 存放可公开的方向讨论与决策记录，在 GitHub 上直接阅读，不参与 Pages 发布。

- 一个方向一个主文件 `notes/<direction>.md`，始终是精简融合后的当前版本，演变看 git 历史
- 结构：当前判断 → 关键决策与理由 → 推翻条件 → 开放问题 → 相关 repo / 链接
- 更新主文件时同步更新 `notes/INDEX.md`
- 组织成熟、值得发表的内容晋升到 [LIP](https://github.com/MiaoDX/LIP)

## 约定

- 每个页面一个目录，入口为 `<name>/index.html`；页面不依赖后端，可离线打开。
- 新增页面时同步更新根目录的 `index.html` 和本 README 的页面列表。
- 推送到 `main` 后由 GitHub Pages 自动发布，无需构建。

## License

[MIT](LICENSE)
