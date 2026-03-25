# 表面细节技术调研报告

**日期:** 2026-03-22
**范围:** Blender 贴图技术 / Tissue 插件 / UE5 材质技术 / UE5 曲面细分

---

## 一、Blender 的 Bump、Normal、Displacement 贴图

### 1.1 Bump Map（凹凸贴图）

- **原理：** 灰度图（8bit，256 级灰度），Bump 节点通过有限差分法计算高度场梯度，构造新的表面法线
- **特点：**
  - 不改变实际几何体，仅修改着色法线
  - 内存占用最小，性能最优
  - 从掠射角观察时容易穿帮（轮廓线仍然平坦）
- **节点连接：** `Image Texture (Non-Color) → Bump Node (Height) → Principled BSDF (Normal)`
- **参数：**
  - **Strength：** 0.1–1.0，控制凹凸强度
  - **Distance：** 0.01–0.1（场景相关），控制凹凸效果的世界空间尺度
- **适用场景：** 皮肤毛孔、微小皱纹、砖缝等细微纹理
- **EEVEE 支持：** 是

### 1.2 Normal Map（法线贴图）

- **原理：** RGB 三通道分别编码 X/Y/Z 方向的法线偏移（Blender 约定：R=X+, G=Y+, B=Z+）。紫蓝色外观来源于大部分法线朝 Z+ 方向（切线空间 0.5, 0.5, 1.0）
- **特点：**
  - 比 Bump Map 更精确，能表达更复杂的表面方向变化
  - 同样不改变几何体，轮廓线不受影响
  - 通常由高模烘焙到低模获得
- **空间类型：**
  - **Tangent Space（切线空间）：** 最常用，支持变形/动画网格
  - **Object Space（对象空间）：** 仅适用于不变形网格
  - **World Space（世界空间）：** 极少使用
- **节点连接：** `Image Texture (Non-Color) → Normal Map Node (Color) → Principled BSDF (Normal)`
- **组合用法：** Normal Map 输出 → Bump Node (Normal Input)，再将 Bump 高度图连入同一 Bump 节点，实现法线贴图 + 凹凸贴图的叠加效果
- **适用场景：** 高模细节转低模、角色/道具表面细节
- **EEVEE 支持：** 是

### 1.3 Displacement Map（置换贴图）

- **原理：** 灰度/高度图驱动顶点实际位移，生成真实几何变形
- **特点：**
  - 改变真实几何体 → 影响轮廓线、可投射阴影、可遮挡其他物体
  - 需要足够多的顶点（细分）才能正常工作
  - 内存和渲染时间显著增加
- **节点类型：**
  - **Displacement 节点：** 标量高度输入，沿法线方向位移
  - **Vector Displacement 节点：** RGB/向量输入，可沿任意方向位移（X/Y/Z）
- **关键参数：**
  - **Scale：** 控制位移幅度（世界空间单位）
  - **Midlevel：** 默认 0.5，定义"无位移"的高度值。黑=最低时设为 0.0，居中贴图保持 0.5
- **Cycles 中的三种位移模式（Material Properties > Settings > Surface）：**
  - **Bump Only（默认）：** 位移输出仅作为凹凸法线扰动，不移动几何体。即使连接了 Displacement 节点也不会有几何变化
  - **Displacement Only：** 位移输出移动实际几何体，但不做额外的凹凸着色。细分不足时会显得块状/棱角分明
  - **Displacement and Bump（推荐）：** 大尺度用几何位移 + 小尺度细节用凹凸着色。不需要极端细分级别即可获得平滑效果
- **贴图精度建议：** 使用 16 或 32-bit 浮点 EXR 格式，8-bit PNG/JPEG 会产生阶梯伪影
- **EEVEE 支持：** 否（EEVEE/EEVEE Next 均不支持真实位移）

### 1.4 自适应细分（Adaptive Subdivision）

- **要求：** Cycles 渲染器（Blender 4.x 及之前需开启 Experimental 特性集；Blender 5.0+ 已内置无需切换）
- **底层技术：** 基于 OpenSubdiv 库，支持 Catmull-Clark 和 Simple 两种细分模式
- **设置步骤：**
  1. 添加 Subdivision Surface 修改器 → 启用 Adaptive Subdivision
  2. Shader Editor 中：`Height Texture (Non-Color) → Displacement Node → Material Output.Displacement`
  3. 材质设置 Displacement 模式为 "Displacement and Bump"
  4. 调整 Render Properties > Subdivision > Dicing Rate（值越小细节越多，默认 1.0 像素）
- **细分密度控制：**
  - **全局 Dicing Rate：** Render Properties > Subdivision
  - **每对象 Dicing Rate：** Subdivision 修改器上可单独设置
  - **Dicing Camera：** 可指定活动相机，使细分密度基于相机距离计算
  - 值 0.5 = 约 0.5 像素大小的微多边形，非常精细
- **优势：** 根据相机距离自动调整细分密度，近处高精度，远处节省资源
- **局限：**
  - 仅 Cycles，不支持 EEVEE
  - 动画中 Dicing Rate 过低可能产生闪烁
  - 内存消耗较大
- **vs 手动细分：** 手动细分（Subdivision Surface 高级别）全局均匀加密，平坦区域浪费内存；Adaptive 仅在需要处加密

### 1.5 三者对比

| 特性 | Bump Map | Normal Map | Displacement Map |
|------|----------|------------|-----------------|
| 改变几何体 | 否 | 否 | 是 |
| 轮廓线影响 | 无 | 无 | 有 |
| 投射阴影 | 不能 | 不能 | 能 |
| 自遮蔽 | 伪造/有限 | 伪造/有限 | 真实 |
| 性能开销 | 低 | 低 | 高（需细分） |
| 内存占用 | 小（灰度） | 中（RGB） | 小（灰度）但网格内存大 |
| 精度 | 低 | 中 | 高 |
| 掠射角表现 | 差 | 较好 | 完美 |
| EEVEE 支持 | 是 | 是 | 否 |
| 推荐用途 | 微小细节 | 中等细节/游戏资产 | 大尺度变形/英雄资产/特写 |

### 1.6 节点连接速查

| 目标 | 纹理 → | 中间节点 → | 目标 |
|------|--------|-----------|------|
| 仅凹凸 | 灰度 → Bump (Height) | Bump (Normal out) → | BSDF Normal |
| 仅法线贴图 | RGB → Normal Map (Color) | Normal Map (Normal out) → | BSDF Normal |
| 法线 + 凹凸叠加 | RGB → Normal Map → Bump (Normal in); 灰度 → Bump (Height) | Bump (Normal out) → | BSDF Normal |
| 位移 | 灰度 → Displacement (Height) | Displacement (out) → | Material Output (Displacement) |
| 位移 + 凹凸 | 同上 + 凹凸链接到 BSDF Normal | 模式设为 "Displacement and Bump" | 两路输出 |
| 向量位移 | RGB → Vector Displacement (Vector) | Vector Displacement (out) → | Material Output (Displacement) |

---

## 二、Blender Tissue 插件

### 2.1 概述

- **作者：** Alessandro Zomparelli（建筑/工程背景的计算设计师，Co-de-iT）
- **定位：** 面向计算设计（Computational Design）的免费开源插件，桥接参数化设计与 Blender 网格建模
- **核心理念：** 基于组件的生成式设计 — 以基础网格拓扑驱动组件的复制和变形
- **状态：** Blender 2.79+ 起内置（需手动启用：Edit > Preferences > Add-ons），推荐从 GitHub 下载最新版
- **最新版本：** v0.3.72（2024年10月）
- **GitHub：** [alessandro-zomparelli/tissue](https://github.com/alessandro-zomparelli/tissue)

### 2.2 核心功能

#### Tessellate（镶嵌/铺砌）
- 将选定对象（Component）复制到活动对象（Generator/Base）的每个面上
- 自动通过重心/双线性插值将组件的局部坐标映射到面的坐标空间
- **填充模式：**
  - **Quad：** 最基础，组件映射到四边面
  - **Tri：** 自动将面三角化后映射
  - **Fan：** 从面中心三角化后映射
  - **Patch：** 使用细分曲面插值，产生更平滑的有机形状
- **Thickness：** 组件可沿面法线拉伸，通过顶点组或均匀值控制
- **Merge：** 相邻组件实例的边界顶点可合并，创建无缝连续网格
- **顶点组传递：** 基础网格和组件网格的顶点组均可影响镶嵌结果（缩放、厚度、密度等）
- 支持 Mesh、Curve、Surface、Text、Meta 等多种输入类型
- **非破坏性：** 修改基础或组件网格后可通过 Refresh 操作自动更新结果
- **迭代镶嵌：** 一次镶嵌的输出可作为下一次的基础，实现分形递归细分

#### Dual Mesh（对偶网格）
- 将三角网格转换为多边形对偶网格（面→顶点，顶点→面）
- 三角网格 → 六边形图案；四边网格 → 偏移四边网格
- 结合 Wireframe + 细分表面修改器可产生 Voronoi/蜂窝式有机造型
- 是 Tessellate 的一种特殊形式

#### Polyhedral Wireframe（多面体线框）
- 通过拓扑描述内部多面体来定义体积对象
- 生成清洁拓扑，适合数字制造（3D 打印）或进一步程序化建模
- 新增属性：`Tissue Node Index`、`Tissue Edge Index`、`tissue_is_wireframe`、`tissue_is_outer`
- 可与 Geometry Nodes 协同使用
- 实际应用：实验建筑、产品设计中的轻量化晶格结构

#### Reaction Diffusion（反应扩散）
- 基于 **Gray-Scott 模型**的反应扩散模拟系统
- **原理：** 两种虚拟化学物质（激活剂/抑制剂）在网格表面沿边扩散并反应
- **可产生的图案类型：**
  - 斑点（类似细胞分裂）
  - 条纹和迷宫纹
  - 蠕虫状图案
  - 脉冲点
  - 珊瑚/指纹纹理
- **优势：** 直接在3D网格拓扑上运算（非图像），适用于任意3D表面
- **控制参数：** 扩散速率、供给率(f)、杀灭率(k)、迭代次数
- **权重集成：** 结果顶点组可驱动其他 Tissue 操作（镶嵌厚度、组件缩放），形成反馈循环
- 支持各向异性行为，可基于主应力方向定向结构图案

#### Convert to Curves / Convert to Mesh
- **Convert to Curves：** 将网格边提取为 Blender 曲线对象 → 添加倒角轮廓 → 创建物理线框/晶格模型（适合 3D 打印/渲染）
- **Convert to Mesh：** 反向操作，将曲线网络转回网格

#### Weight Tools（权重工具）
- **Weight Formula：** 数学运算组合多个顶点组（加/乘/减/幂/最小/最大）
- **Curvature to Weight：** 从高斯/平均曲率自动生成权重
- **Area to Weight：** 面积映射为顶点权重
- **Harmonic Weights：** 基于拉普拉斯平滑的权重分布
- **Weight from Boundary Distance：** 基于网格边界距离生成渐变
- **Colors-Weight Exchanger：** 顶点颜色 ↔ 顶点组互转
- **Weight Distance / Streamlines / Contour Curves** 等

#### 其他工具
- **Lattice Along Surface** — 沿表面创建晶格变形器
- **UV to Mesh** — UV 展开转为网格
- **Random Materials** — 随机材质分配
- **Tissue Render Animation** — 动画渲染辅助

### 2.3 典型工作流

1. 创建/导入基础网格（通常为细分曲面）
2. 创建组件网格（小型重复单元）
3. 应用 Tessellate 将组件分布到基础上
4. 使用 Dual Mesh 或权重绘制细化图案
5. 可选：运行 Reaction Diffusion 产生有机变体
6. 转换边为曲线（线框结构）
7. 应用材质渲染，或导出用于制造

### 2.4 常见应用领域

| 领域 | 应用实例 |
|------|---------|
| 建筑可视化 | 参数化立面板、穿孔屏风（mashrabiya）、空间桁架、测地穹顶 |
| 产品设计 | Voronoi/晶格灯罩、珠宝花纹、鞋底纹路 |
| 3D 打印 | 轻量化晶格结构、Voronoi 镂空、互锁瓷砖系统 |
| 数字艺术/VFX | 有机珊瑚/真菌生长、外星/科幻表面细节、抽象生成艺术 |
| 纺织模拟 | 锁子甲网格、编织/针织图案近似 |

### 2.5 Tissue vs Geometry Nodes

| 对比项 | Tissue | Geometry Nodes |
|--------|--------|----------------|
| 可用性 | 插件（内置但需启用） | 内置（Blender 3.0+） |
| 上手难度 | 低（专用 UI 面板） | 中高（节点编程） |
| 性能 | Python 实现，密集网格较慢 | C++ 评估，显著更快 |
| 非破坏性 | 半非破坏性（手动刷新） | 完全非破坏性，实时 |
| Tessellate | 原生强项，一键设置 | 需手动搭建节点（Instance on Points 等） |
| Dual Mesh | 内置操作符 | Blender 3.1+ 有原生 Dual Mesh 节点 |
| Reaction Diffusion | 内置 | 无原生支持，需 Simulation Zone hack |
| Polyhedral Wireframe | 内置 | 需复杂节点图 |
| 动画支持 | 有限 | 完整动画集成 |
| 迭代组合 | 输出可作为下一次输入 | 节点连接天然可组合 |
| 未来方向 | 社区维护，节奏变慢 | Blender 官方核心发展方向 |

**结论：** 两者互补。Tissue 适合快速实现特定的计算设计工作流（尤其 Tessellate 和 Reaction Diffusion）；Geometry Nodes 更通用、更快、更适合动画，但学习曲线更陡。许多 Tissue 工作流现在可用 Geometry Nodes 复现，但设置更复杂。

---

## 三、UE5 BumpOffset / 法线贴图及相关技术

### 3.1 Normal Map（法线贴图）

- UE5 中最基础且开销最小的表面细节方法
- **格式：** 默认切线空间法线贴图（蓝紫色贴图），引擎内部重建 Z 分量
- **纹理设置：** Sampler Type = Normal，Compression = Normalmap（禁用 sRGB，使用 BC5 压缩）
- **关键节点/技术：**
  - **FlattenNormal：** 衰减法线贴图强度（向 (0,0,1) 插值）
  - **BlendAngleCorrectedNormals：** 正确叠加多层法线贴图（重定向法线映射 RNM，优于旧 BlendNormals）
  - **Detail Texturing：** 以不同 Tiling 缩放的第二层法线贴图叠加，增加近距离细粒度
  - **NormalFromHeightmap：** 运行时从高度图生成法线（昂贵，4+ 纹理采样）
- **性能：** 极低开销，仅一次额外纹理采样

### 3.2 Bump Offset（简单视差映射）

- **原理：** 基于高度图和相机视角计算 UV 偏移，产生深度错觉
- **参数：**
  - **Height Ratio：** 偏移强度
  - **Reference Plane：** 0-1，定义"零深度"参考面（通常 0.5）
- **输出：** float2 UV 偏移 → 插入所有其他纹理采样器（Diffuse/Normal/Roughness 等）的 UV 输入
- **特点：**
  - 单步光线近似 — 无自遮蔽、无轮廓校正
  - 大角度和高深度值时效果差
  - 适合微小/浅层表面深度效果（砂浆线、浅浮雕）
- **性能：** 极低（仅 1 次额外高度图采样）

### 3.3 Iterative Parallax Mapping（迭代视差映射）

- 在简单 Bump Offset 基础上的改进
- 将上一次视差计算的 UV 作为下一次的输入，多次迭代
- 用法线贴图蓝色通道乘以高度值，防止陡坡处纹理游移
- **性能：** 每次额外迭代增加 5 个 shader 指令（或使用多 BumpOffset 节点时每次 3 个）；通常不超过 4 次迭代

### 3.4 Parallax Occlusion Mapping (POM)（视差遮蔽映射）

- **原理：** 通过光线步进（Ray Marching）穿过高度场找到正确的纹理坐标
- **"遮蔽"含义：** 高度图的凸起部分可以遮挡凹陷部分
- **可选自阴影：** 在找到表面交点后，向光源方向发射第二条光线步进
- **UE5 设置步骤：**
  1. 材质编辑器中添加 `Parallax Occlusion Mapping` 材质函数（非单独节点）
  2. 连接高度图 Texture Object → Heightmap Texture 输入
  3. 设置 Height Ratio（高度比）、Min/Max Steps（步进次数，16-128 不等）
  4. 连接 Pixel Depth Offset 输出实现景深效果
  5. 可将部分 POM 计算移到 CustomizedUVs（顶点着色器）优化性能
- **优化技巧：**
  - LOD 距离衰减：远处减少步进次数
  - CameraDepthFade 函数：超出一定距离禁用 POM
  - 简化材质实例用于远距 LOD
- **优缺点：**
  - 优点：无需额外建模，任何网格上都可使用，内部深度效果良好
  - 缺点：GPU 开销大（最昂贵的像素着色器技术）、掠射角不精确、不支持重叠 UV、轮廓线仍然平坦

### 3.5 World Position Offset（世界位置偏移）

- 材质输出节点上的通用顶点位移机制
- **原理：** float3 向量加到每个顶点的世界位置上，在顶点着色器中执行
- **常见用途：** 植被风动、雪面变形、交互水面、呼吸/脉动效果
- **注意事项：**
  - 不更新碰撞网格（物理仍用原始几何体）
  - 阴影可能不匹配（需配置材质的 "Used with..." 选项）
  - 包围盒可能需手动调整（Bounds Extension）防止裁剪
  - Nanite 网格 WPO 支持：UE 5.4+ 支持（称为 "Nanite WPO"），但会禁用部分 Nanite 优化

### 3.6 Material Layer 系统

- UE5 支持 **Material Layer** 架构：各表面类型（锈迹、油漆、织物）作为独立 Material Layer 资产
- **Material Layer Blend** 资产定义两层如何混合（高度混合、角度混合、遮罩等）
- 通过 **Material Attributes Layers** 节点组合为最终材质
- 推荐用于复杂多表面材质的生产工作流
- **辅助函数：** HeightLerp（高度混合）、MF_ObjectScale（对象缩放补偿）、Triplanar Mapping（三平面投影避免 UV 拉伸）

### 3.7 技术对比

| 技术 | GPU 开销 | 几何变形 | 自遮蔽 | 轮廓线 | 适用场景 |
|------|---------|---------|--------|--------|---------|
| Normal Map | 极低 | 无 | 无 | 无变化 | 所有表面基础细节 |
| Bump Offset | 低 | 无 | 无 | 无变化 | 远处/浅层深度效果 |
| Iterative Parallax | 中 | 无 | 部分 | 无变化 | 中等深度效果 |
| POM | 高（16-128 采样/像素） | 无 | 有（含可选自阴影） | 无变化 | 英雄资产近景 |
| World Position Offset | 低-中 | 顶点级 | 无 | 有变化 | 动态效果/植被风动 |
| Nanite Displacement | 中 | 真实几何 | 有 | 有变化 | 大规模场景/地形 |

### 3.8 推荐选择指南

| 目标 | 推荐技术 |
|------|---------|
| 细粒度表面细节（划痕、颗粒） | Normal Map（Detail 层） |
| 浅层深度错觉（砂浆线） | BumpOffset |
| 深度表面浮雕（鹅卵石、深裂缝） | POM（配合距离衰减） |
| 真实几何位移（静态网格） | Nanite Displacement 或烘焙高模 + Nanite |
| 地形细节几何 | Virtual Heightfield Mesh |
| 动态顶点动画（风、波浪） | World Position Offset |
| 多材质表面（金属上的锈迹） | Material Layers + Height Blend |
| 打破纹理重复感 | 宏观变化 + Detail Normals + Triplanar |

---

## 四、UE5 曲面细分（Tessellation）

### 4.1 历史背景

- **UE4：** 支持 DX11 硬件曲面细分（Hull/Domain Shader），材质可通过 Tessellation Multiplier + World Displacement 引脚动态细分
- **UE5：** 完全移除了传统硬件曲面细分，材质编辑器中不再暴露相关引脚
- **移除原因：**
  - 与 Nanite GPU 驱动的集群渲染管线不兼容
  - 性能不可预测：平坦表面过度细分，轮廓处细分不足；AMD GPU 上尤其昂贵
  - UE5 渲染管线围绕 Nanite + Lumen 重构，传统曲面细分路径难以维护
- **社区反馈：** 大量请求恢复（Change.org 请愿），因 Nanite 最初不支持位移贴图

### 4.2 Nanite 如何替代传统曲面细分

**Nanite 核心机制：**
- 将网格分解为 ~128 三角形的集群（Cluster），构建层次化 DAG（有向无环图）
- 运行时对每个集群独立选择 LOD 级别（基于屏幕空间误差阈值）
- 同一网格的不同部分可同时以不同 LOD 渲染
- 小三角形使用软件光栅化（Compute Shader），大三角形使用硬件光栅化
- 完全 GPU 驱动：裁剪和 LOD 选择均在 GPU 上完成，消除 CPU Draw Call 开销
- 使用 Visibility Buffer 而非传统 G-Buffer 光栅化
- 几何数据按需从磁盘流式加载

**Nanite 的工作流范式转变：**
- **UE4 思路：** 低模 + 运行时曲面细分 + 位移贴图 → 生成高精度几何
- **UE5 思路：** DCC 工具中预先烘焙高模 → 导入 → Nanite 自动处理 LOD
- 从"运行时生成细节"转变为"导入完整细节，运行时智能简化"

### 4.3 Nanite Tessellation（UE 5.2/5.3+ → UE 5.4/5.5 改进）

- **UE 5.2/5.3：** 实验性引入 Nanite Displacement/Tessellation
- **UE 5.3：** 主要针对地形，Nanite 可在软件光栅化管线内细分三角形并应用位移
- **UE 5.4：** 扩展到任意 Nanite 静态网格，实时可调，从实验到 Beta
- **UE 5.5：** 进一步优化性能，减少内存开销，改善 Lumen GI/反射交互
- **启用方式：**
  1. `DefaultEngine.ini` 中添加：
     ```
     r.Nanite.AllowTessellation=1
     r.Nanite.Tessellation=1
     ```
  2. 启用 Nanite Displaced Mesh 插件
  3. 材质 Detail 面板中启用 Tessellation → 解锁 Displacement 引脚
- **工作原理：**
  - 在 Nanite 软件光栅化管线内评估位移
  - 按集群生成位移几何，并集成到 Nanite 的 LOD 和可见性系统中
  - 比 UE4 硬件曲面细分性能好得多

### 4.4 其他位移/细分方案

| 方案 | 说明 | 局限性 |
|------|------|--------|
| **Nanite Tessellation** | UE5 官方推荐，基于高度图位移 | 需 UE 5.3+，5.4 为 Beta |
| **预细分网格** | DCC 工具中预先烘焙位移后导入高模 | 文件大，但 Nanite 处理高效 |
| **World Position Offset** | 顶点着色器中偏移现有顶点 | 不增加面数，不更新碰撞 |
| **Virtual Heightfield Mesh** | 从 RVT 高度数据生成 Nanite 兼容地形网格 | 仅限地形，GPU 开销大 |
| **Parallax Occlusion Mapping** | 像素着色器光线步进模拟深度 | 无真实几何，轮廓线平坦 |
| **Modeling Tool + Displacement** | 编辑器内先细分再位移 | 需手动操作，非实时 |

### 4.5 Geometry Script 与程序化几何

- **Geometry Script 插件：** UE5 的 Blueprint/Python 程序化几何库（实验/Beta）
- **需手动启用：** 默认未启用
- **核心概念：** 基于 UDynamicMesh 对象的几何处理操作
- **可用操作：**
  - `ApplyPNTessellation` — Point-Normal 插值细分
  - `ApplyUniformTessellation` — 均匀三角形细分
  - `ApplySimplification` — 三角形简化
  - `ApplyMeshBoolean` — 布尔运算（并/交/差）
  - `ApplyDisplaceFromTexture` — 基于纹理的顶点位移
  - Catmull-Clark 细分（**仅编辑器模式**）
- **Spline Mesh 工作流：**
  - USplineMeshComponent 沿样条线变形静态网格（管道、铁轨、道路）
  - 需沿长度方向有足够顶点密度才能平滑弯曲
  - 或通过等距采样样条线点 → 近似平滑曲线 → DynamicMeshComponent 生成网格
  - 采样点越多曲线越平滑，但网格越复杂
- **局限：**
  - Catmull-Clark 等功能仅限编辑器，不可用于运行时
  - DynamicMeshComponent 不兼容 Nanite（但可转换为 StaticMesh 后启用 Nanite）
  - Spline Mesh 不兼容 Nanite（涉及逐帧顶点变形）

### 4.6 性能对比：Nanite vs 传统曲面细分

| 方面 | UE4 硬件曲面细分 | UE5 Nanite |
|------|-----------------|-----------|
| 三角形生成 | 运行时，GPU Hull/Domain Shader | 预计算 LOD 层级，运行时选择 |
| LOD 粒度 | 每 Draw Call 或每 Patch | 每集群（~128 三角形） |
| 过度绘制 | 高（曲面细分 Patch 常重叠） | 极少（Visibility Buffer，逐像素解析） |
| CPU 开销 | 中等（Draw Call 仍由 CPU 管理） | 极低（GPU 驱动，Draw Call 合并） |
| GPU 开销 | 高密度时昂贵，AMD GPU 尤其差 | 可预测，随屏幕像素而非场景三角形缩放 |
| 内存 | 低（基础网格 + 位移贴图） | 较高（完整 LOD 链，但流式加载） |
| 轮廓质量 | 好（实际几何位移） | 优秀（高模源几何） |
| 动画支持 | 是（每帧重新细分） | 有限（5.4+ 支持 WPO/骨骼实验性） |
| 可扩展性 | 高密度时差 | 优秀 — 百万/十亿三角形近恒定开销 |

**关键差异：** 渲染开销随 **屏幕分辨率** 缩放而非 **场景复杂度**，这是 Nanite 的根本架构优势。

### 4.7 UE5 vs Blender 细分对比

| 对比项 | Blender (Cycles) | UE5 |
|--------|-----------------|-----|
| 自适应细分 | Adaptive Subdivision（OpenSubdiv，成熟） | Nanite Tessellation（5.4+ Beta） |
| 设计思路 | 低模 → 渲染时细分生成高模 | 高模导入 → 渲染时智能简化 |
| 驱动方式 | Shader 节点 + Displacement Map | 材质 + Height Map |
| LOD 管理 | Dicing Rate + 相机距离 | Nanite 集群 LOD，逐集群自动选择 |
| 平滑细分 | Catmull-Clark / Simple（渲染时） | Geometry Script Catmull-Clark（仅编辑器） |
| 实时性 | 仅 Cycles 离线渲染 | 实时渲染（60fps+） |
| 性能优化 | Dicing Camera + 距离自适应 | Nanite 软件光栅化 + Visibility Buffer |
| 程序化生成 | Geometry Nodes（C++，高效） | Geometry Script + PCG |
| 向量位移 | Vector Displacement 节点 | 无直接等效（需 WPO） |
| 微多边形渲染 | 支持（Dicing Rate < 1.0） | 不支持（概念不同） |

### 4.8 UE 5.4/5.5 新特性汇总

**UE 5.4（2024 年中）：**
- Nanite WPO 支持 — Nanite 网格可使用世界位置偏移（有性能代价）
- Nanite 遮罩材质 — 透明遮罩现在兼容 Nanite（之前需禁用 Nanite）
- Nanite Displacement 改进 — 更稳定，更好的细分密度控制工具
- Nanite 骨骼网格（实验性）— 初步支持通过 Nanite 渲染骨骼网格
- Substrate（前 Strata）材质系统改进 — 实验性高级着色模型

**UE 5.5（2024 年末 / 2025 年初）：**
- Nanite Tessellation 性能优化，减少内存开销
- Nanite 位移几何正确参与 Lumen GI 和反射
- Virtual Shadow Maps 改进 — 更好处理 WPO 位移阴影投射
- Geometry Script 更多操作暴露，Blueprint 集成改善
- Substrate 材质系统进一步完善（仍为实验性但更接近生产就绪）

---

## 五、跨平台技术对比总结

### 5.1 表面细节技术谱系

```
低开销 ◄──────────────────────────────────────────────► 高开销
高性能                                                   高质量

Normal Map → Bump Map → BumpOffset → Iter.Parallax → POM → Displacement
    │            │          │             │            │        │
    │            │          │             │            │        ├── 真实几何
    ├── 无几何   ├── 无几何 ├── 无几何    ├── 无几何   ├── 无几何│   影响轮廓
    │            │          │             │            │        │   投射阴影
    └── 两平台   └── Blender└── UE5      └── UE5     └── UE5  └── 两平台
         通用         /UE5      专属          专属        专属       通用
```

### 5.2 程序化建模技术对比

| 需求 | Blender 方案 | UE5 方案 |
|------|-------------|---------|
| 表面铺砌/镶嵌 | Tissue Tessellate（一键） | PCG + Instance Mesh（需搭建） |
| 有机图案生成 | Tissue Reaction Diffusion | 自定义材质/Niagara（无直接等效） |
| 对偶网格/线框 | Tissue Dual Mesh/Polyhedral | Geometry Script（需编程） |
| 程序化几何 | Geometry Nodes（C++，高效） | Geometry Script + PCG（Blueprint） |
| 地形位移 | Adaptive Subdivision + Displacement | Nanite Tessellation / Virtual Heightfield |
| 曲线细分 | Subdivision Surface 修改器 | Geometry Script（仅编辑器） |
| 样条线网格 | Curve to Mesh 节点 | Spline Mesh Component |

### 5.3 工作流建议

#### 1. Blender 离线渲染管线
- 大尺度变形 → Adaptive Subdivision + Displacement（推荐 "Displacement and Bump" 模式）
- 中等细节 → Normal Map（高模烘焙）+ 可叠加 Bump
- 微小细节 → Bump Map
- 复杂镶嵌图案 → Tissue Tessellate
- 有机/参数化造型 → Tissue（快速原型）+ Geometry Nodes（生产/动画）
- 16/32-bit EXR 位移贴图获得最佳效果

#### 2. UE5 实时渲染管线
- 大尺度地形/网格变形 → Nanite Tessellation + Displacement（UE 5.4+）
- 英雄资产近景深度 → POM（配合 CameraDepthFade 距离衰减）
- 一般表面深度 → BumpOffset 或 Iterative Parallax
- 基础表面细节 → Normal Map（所有资产，含 Detail 层叠加）
- 动态效果 → World Position Offset
- 多材质混合 → Material Layers + Height Blend
- 程序化几何 → Geometry Script（编辑器工具）

#### 3. Blender → UE5 资产管线
- Blender 使用 Tissue 生成复杂几何 → 导出 FBX/glTF → UE5 启用 Nanite
- Blender 烘焙 Displacement/Normal Map → UE5 材质中使用
- Blender 的 Adaptive Subdivision 效果可通过 UE5 Nanite Tessellation 近似还原
- 高模直接导入 + Nanite 是最简单可靠的工作流

---

## 参考资料

### Blender 贴图技术
- [Normal vs Displacement vs Bump Maps - CGDirector](https://www.cgdirector.com/normal-vs-displacement-vs-bump-maps/)
- [Displacement - Blender 5.1 Manual](https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html)
- [Blender 5.0 Adaptive Subdivision - CGEcho](https://cgecho.net/how-to-get-true-displacement-with-blender-5-0-adaptive-subdivision/)
- [Normal Map vs Bump Map - TextureMap.app](https://texturemap.app/blog/normal-map-vs-bump-map)
- [Difference Between Normal Bump and Displacement Maps - A23D](https://www.a23d.co/blog/difference-between-normal-bump-and-displacement-maps/)

### Blender Tissue
- [Tissue - Blender 4.2 Manual](https://docs.blender.org/manual/en/latest/addons/mesh/tissue.html)
- [Tissue GitHub - Alessandro Zomparelli](https://github.com/alessandro-zomparelli/tissue)
- [Tissue - Co-de-iT](https://www.co-de-it.com/code/blender-tissue)
- [Revolutionizing Computational Design with Tissue - Parametric Architecture](https://parametric-architecture.com/revolutionizing-computational-design-with-blender-insights-from-alessandro-zomparelli-and-tissue-add-on/)
- [Tissue — Blender Extensions](https://extensions.blender.org/add-ons/tissue/)

### UE5 材质技术
- [Using Bump Offset - UE4/UE5 Documentation](https://docs.unrealengine.com/4.27/en-US/RenderingAndGraphics/Materials/HowTo/BumpOffset)
- [POM Tutorial - Epic Forums](https://forums.unrealengine.com/t/tutorial-parallax-occlusion-mapping-pom/52527)
- [Creation of POM in UE5 - Game Developer](https://www.gamedeveloper.com/art/creation-of-parallax-occlusion-mapping-pom-in-unreal-engine-5)
- [POM in Details - Epic Community](https://dev.epicgames.com/community/learning/tutorials/kyXK/unreal-engine-creation-of-parallax-occlusion-mapping-pom-in-details)
- [Height-Based Materials - DeepWiki](https://deepwiki.com/motionforge/Unreal_Engine_Essential_Materials_UE5/3.3-height-based-materials)

### UE5 曲面细分
- [Nanite Tessellation & Displacement UE 5.4 Tutorial](https://dev.epicgames.com/community/learning/tutorials/bOda/unreal-engine-nanite-tessellation-displacement-ue-5-4-step-by-step-tutorial-any-asset-not-just-landscapes)
- [Nanite Tessellation in UE 5.3](https://dev.epicgames.com/community/learning/tutorials/RBvX/unreal-engine-new-in-unreal-5-3-tessellation-displacement-in-nanite-meshes-tutorial)
- [Displacement and Nanite Tessellation Tutorial](https://dev.epicgames.com/community/learning/tutorials/5J0Y/displacement-and-nanite-tessellation-in-unreal-engine-5)
- [Geometry Scripting Reference - UE5](https://dev.epicgames.com/documentation/en-us/unreal-engine/geometry-scripting-reference-in-unreal-engine)
- [Geometry Script FAQ - Gradientspace](http://www.gradientspace.com/tutorials/2022/12/19/geometry-script-faq)
