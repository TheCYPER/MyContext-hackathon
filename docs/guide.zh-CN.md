# MyContext 使用指南

MyContext 保存你在学业、研究和工作中积累的上下文，让 Codex 或其他本地 AI
接续任务时，可以找到目标、尝试过的方法、实验结果、学习困难和下一步。
资料保存在独立的 Markdown/Git 仓库中；本地界面用项目、经历、想法和关系图组织这些记录。

![MyContext 虚构学业与工作场景](assets/screenshots/overview.png)

*截图来自前端重新设计前的演示版本。*

## 先体验演示

需要 Git 2.28+、Node.js 22.13+、Ruby 2.6+ 和 POSIX shell，支持 macOS、Linux 和 WSL。
Dashboard 使用本地 npm 依赖；不需要 Ruby gems、模型密钥或数据库。

```bash
git clone https://github.com/TheCYPER/MyContext-hackathon.git
cd MyContext-hackathon
npm ci
npm run setup
npm test
npm run build
npm start -- --root "$PWD/.local/demo"
```

打开 **http://127.0.0.1:4318**。端口被占用时，
在同一软件目录使用 `npm start -- --root "$PWD/.local/demo" --port 4319`。
`npm run build` 生成生产服务所需的 `dashboard/dist/`；前端代码改动后需要重新构建。
开发时可以运行 `npm run dev`，在端口 5173 使用热更新。
安装会在 `.local/demo/` 创建独立的演示资料库。
其中 67 条记录围绕虚构学生 Alex Lin：实习、研究项目、课程学习、协作者和未来想法。
人物、机构、经历和实验结果均为虚构。

希望 AI 完成安装，可以复制 [完整安装提示词](getting-started.md#install-with-your-ai)。

## 用一个问题开始

先在软件目录运行 `bash scripts/install-skills.sh "$PWD/.local/demo"`，再把 `.local/demo/`
作为 AI 的工作目录，并将 `MY_CONTEXT_ROOT` 设为这个目录的绝对路径。
在你的 AI 助手中提问；浏览器负责查看记录和关系。

| 场景 | 可以直接问 |
| --- | --- |
| 接续研究 | “用 $my-context 解释 Eval Notebook 的早期结果为什么撤回，以及下一次应该比较什么。” |
| 整理实习 | “用 $my-context 写两条实习贡献，标出仍需主管确认的说法。” |
| 检查学习进度 | “用 $my-context 找到我的梯度学习困难，给一道新题，先不要显示解答。” |
| 验证项目想法 | “用 $my-context 把 Experiment Index 想法拆成一次小验证，区分设想与已完成的工作。” |

每个场景的来源记录与可支持的结论见 [四个完整示例](scenarios.md)。

## 看懂关系图

图里的节点是一条记录，连线表示记录之间的联系。打开某个项目，可以顺着连接查看
相关经历、人物、工作日记和想法。默认使用 **1 hop** 显示一跳邻居，
点击 **Expand to 2** 扩展到两跳。在 **Connection target** 下拉框选择目标，
再点击 **Trace** 查看两个记录之间的连接路径。

带类型的关系说明“参与”“属于”“关于”“支持”或“替代”等具体含义，并保留来源、
证据类别和审阅状态。普通链接与 `context:<id>` 来源引用只表示记录间的连接。
**Trace mode** 可以选择无向可达性，或沿有类型关系的方向追踪；
一条路径本身不能证明两个端点之间的新事实。

界面读取已经提交的内容，页面可见时每五秒检查更新。新提交可以显示新的记录和关系；
未提交的编辑与待审 capture 不会作为正式事实出现。
详细操作见 [Dashboard 指南](../dashboard/README.md)。

## 创建自己的资料库

完成上面的依赖安装和 Dashboard 构建后，在软件目录运行，选用尚未存在的独立目录：

```bash
bash scripts/setup.sh personal "$HOME/MyContextData"
bash scripts/install-skills.sh "$HOME/MyContextData"
bash scripts/install-global-skill.sh --context "$HOME/MyContextData"
npm start -- --root "$HOME/MyContextData" --port 4319
```

新资料库包含空白个人资料、目录结构和自己的 Git 历史，没有远程仓库。
全局 `my-context` Skill 绑定到它之后，可以从其他项目读取相关背景或记录任务成果。
已有 Skill 或绑定发生冲突时，安装程序会保留原配置并报告。

先从一门课、一段实习或一个研究项目开始：目标是什么，已经试过什么，依据在哪里，
还有哪个问题没有解决。未知的信息保持空白。已有记录的修改按资料库中的
`AGENTS.md` 和写入策略形成精确提案，由你审阅。

## 保存这次工作的结果

在其他项目的任务中说：

> 用 $my-context 记下这次实验的结果、限制和下一步，并告诉我保存状态。

默认情况下，选出的事实带来源进入资料库外的私有待审队列。
如果资料库单独批准了自动记录策略，命令会追加一篇私有工作日记并在本地提交。
它不会自动推送远程，也不会改写已有项目页。

Skill 在被明确调用或由助手选用时运行。希望任务结束时稳定记录，可以直接提出上面的请求。
策略启用与状态检查见 [capture guide](../skills/my-context/references/capture.md)，
安装步骤与常见问题见 [getting started](getting-started.md)。
