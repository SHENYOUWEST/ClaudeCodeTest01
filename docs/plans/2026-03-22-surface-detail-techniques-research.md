# 表面细节技术调研报告

**日期:** 2026-03-22
**范围:** Blender 贴图技术 / Tissue 插件 / UE5 材质技术 / UE5 曲面细分

---

## 一、Blender 的 Bump、Normal、Displacement 贴图

### 1.1 Bump Map（凹凸贴图）

- **原理：** 灰度图（8bit，256 级灰度），通过扰动表面法线来模拟凹凸效果
- **特点：**
  - 不改变实际几何体，仅修改着色法线
  - 内存占用最小，性能最优
  - 从掠射角观察时容易穿帮（轮廓线仍然平坦）
- **节点连接：** `Image Texture → Bump Node → Normal Input (Principled BSDF)`
- **适用场景：** 皮肤毛孔、微小皱纹、砖缝等细微纹理

### 1.2 Normal Map（法线贴图）

- **原理：** RGB 三通道分别编码 X/Y/Z 方向的法线偏移（Blender 约定：R=X+, G=Y+, B=Z+）
- **特点：**
  - 比 Bump Map 更精确，能表达更复杂的表面方向变化
  - 同样不改变几何体，轮廓线不受影响
  - 通常由高模烘焙到低模获得
- **节点连接：** `Image Texture (Non-Color) → Normal Map Node → Normal Input`
- **适用场景：** 高模细节转低模、角色/道具表面细节

### 1.3 Displacement Map（置换贴图）

- **原理：** 灰度/高度图驱动顶点实际位移，生成真实几何变形
- **特点：**
  - 改变真实几何体 → 影响轮廓线、可投射阴影、可遮挡其他物体
  - 需要足够多的顶点（细分）才能正常工作
  - 内存和渲染时间显著增加
- **Cycles 中的三种位移模式：**
  - **Bump Only** — 仅法线扰动，无几何变形
  - **Displacement Only** — 仅几何位移
  - **Displacement and Bump** — 大尺度用位移 + 小尺度用凹凸（推荐）

### 1.4 自适应细分（Adaptive Subdivision）

- **要求：** Cycles 渲染器（Blender 5.0 前需开启 Experimental 特性集；5.0+ 已内置）
- **设置步骤：**
  1. 添加 Subdivision Surface 修改器 → 启用 Adaptive Subdivision
  2. Shader Editor 中：`Height Texture (Non-Color) → Displacement Node → Material Output.Displacement`
  3. 材质设置 Displacement 模式为 "Displacement and Bump"
  4. 调整 Render Properties > Subdivision > Dicing Rate（值越小细节越多）
- **优势：** 根据相机距离自动调整细分密度，近处高精度，远处节省资源
- **建议：** 使用 16/32-bit 浮点贴图以获得最佳效果

### 1.5 三者对比

| 特性 | Bump Map | Normal Map | Displacement Map |
|------|----------|------------|-----------------|
| 改变几何体 | 否 | 否 | 是 |
| 轮廓线影响 | 无 | 无 | 有 |
| 投射阴影 | 不能 | 不能 | 能 |
| 性能开销 | 低 | 低 | 高 |
| 内存占用 | 小 | 中 | 大 |
| 精度 | 低 | 中 | 高 |
| 推荐用途 | 微小细节 | 中等细节 | 大尺度变形/英雄资产 |

---

## 二、Blender Tissue 插件

### 2.1 概述

- **作者：** Alessandro Zomparelli（建筑/工程背景的计算设计师）
- **定位：** 面向计算设计（Computational Design）的免费开源插件
- **状态：** Blender 内置插件，但推荐从 GitHub 下载最新版以获得更好的稳定性和功能
- **最新版本：** v0.3.72（2024年10月）

### 2.2 核心功能

#### Tessellate（镶嵌/铺砌）
- 将选定对象（Component）复制到活动对象（Generator）的面上
- 自动适配四边面的形状调整 Component 的包围盒
- **填充模式：** Tri（三角）、Quad（四边形）、Fan（扇形）、Patch（补丁，更平滑的有机形状）
- 支持 Mesh、Curve、Surface、Text、Meta 等多种输入类型
- 可通过顶点组控制分布、旋转、平滑法线等

#### Dual Mesh（对偶网格）
- 将三角网格转换为多边形对偶网格
- 结合 Wireframe + 细分表面修改器可产生 Voronoi 式有机造型
- 是 Tessellate 的一种特殊形式

#### Polyhedral Wireframe（多面体线框）
- 通过拓扑描述内部多面体来定义体积对象
- 生成清洁拓扑，适合数字制造或进一步程序化建模
- 新增属性：`Tissue Node Index`、`Tissue Edge Index`、`tissue_is_wireframe`、`tissue_is_outer`
- 可与 Geometry Nodes 协同使用

#### Reaction Diffusion（反应扩散）
- 基于反应扩散数学模型的权重工具
- 大权重向小权重扩散，产生类似自然界的图案（如豹纹、珊瑚纹理）
- 支持各向异性行为，可基于主应力方向定向结构图案

#### 其他工具
- **Lattice Along Surface** — 沿表面创建晶格
- **UV to Mesh** — UV 展开转为网格
- **Weight Tools** — Area、Curvature、Weight Distance、Weight Formula
- **Streamlines/Contour Curves** — 流线和等高线曲线生成

### 2.3 Tissue vs Geometry Nodes

| 对比项 | Tissue | Geometry Nodes |
|--------|--------|----------------|
| 上手难度 | 低（专用UI面板） | 中高（节点编程） |
| 灵活性 | 中（预设功能） | 高（完全自定义） |
| Tessellate | 原生强项 | 需手动搭建节点 |
| Reaction Diffusion | 内置 | 无原生支持 |
| Polyhedral Wireframe | 内置 | 需复杂节点 |
| 实时预览 | 支持 | 支持 |
| 未来方向 | 社区维护 | Blender 官方发展方向 |

**结论：** 两者互补。Tissue 适合快速实现特定的计算设计工作流；Geometry Nodes 更通用但学习曲线更陡。

---

## 三、UE5 BumpOffset / 法线贴图及相关技术

### 3.1 Normal Map（法线贴图）

- UE5 中最基础的表面细节方法
- 通过光照和阴影让眼睛感知体积，但不实际偏移纹理坐标
- 从近处/特定角度观察时显得平坦

### 3.2 Bump Offset（简单视差映射）

- **原理：** 基于视角和高度图调整 UV 坐标，产生深度错觉
- **特点：**
  - 比 POM 便宜，但掠射角效果差
  - 适合远距离或不需要高精度深度的表面
- **重要规则：** 所有 PBR 纹理采样必须使用 BumpOffset 输出的偏移 UV

### 3.3 Iterative Parallax Mapping（迭代视差映射）

- 在简单 Bump Offset 基础上的改进
- 将上一次视差计算的 UV 作为下一次的输入，多次迭代
- 用法线贴图蓝色通道乘以高度值，防止陡坡处纹理游移
- **性能：** 每次额外迭代增加 5 个 shader 指令；通常不超过 4 次迭代

### 3.4 Parallax Occlusion Mapping (POM)（视差遮蔽映射）

- **原理：** 通过光线步进（Ray Marching）找到正确的纹理坐标，创建透视正确的深度
- **"遮蔽"含义：** 高度图的凸起部分可以遮挡凹陷部分，加上自阴影效果
- **UE5 设置步骤：**
  1. 材质编辑器中添加 `Parallax Occlusion Mapping` 材质函数
  2. 连接高度图 Texture Object → Heightmap Texture 输入
  3. 设置 Height Ratio（高度比）、Min/Max Steps（步进次数）
  4. 连接 Pixel Depth Offset 输出实现景深效果
- **优缺点：**
  - 优点：无需额外建模，任何网格上都可使用
  - 缺点：GPU 开销大、掠射角不精确、不支持重叠 UV、需中等以上画质设置

### 3.5 World Position Offset（世界位置偏移）

- 在顶点着色器阶段偏移顶点位置
- 可实现风吹草动、波浪等动态效果
- 不增加几何体面数，但可用于顶点级位移

### 3.6 Nanite + Displacement（UE 5.3+）

- 见第四章详述

### 3.7 技术对比

| 技术 | GPU 开销 | 几何变形 | 自遮蔽 | 轮廓线 | 适用场景 |
|------|---------|---------|--------|--------|---------|
| Normal Map | 低 | 无 | 无 | 无变化 | 所有表面基础细节 |
| Bump Offset | 低-中 | 无 | 无 | 无变化 | 远处/简单深度效果 |
| Iterative Parallax | 中 | 无 | 部分 | 无变化 | 中等深度效果 |
| POM | 高 | 无 | 有 | 无变化 | 英雄资产近景 |
| World Position Offset | 低-中 | 顶点级 | 无 | 有变化 | 动态效果 |
| Nanite Displacement | 中 | 真实 | 有 | 有变化 | 大规模场景/地形 |

---

## 四、UE5 曲面细分（Tessellation）

### 4.1 历史背景

- **UE4：** 支持硬件曲面细分（Hardware Tessellation），可动态细分网格并配合置换贴图使用
- **UE5：** 完全移除了传统硬件曲面细分，引发社区大量反馈
- **原因：** Epic 认为 Nanite 技术路线是更优的替代方案

### 4.2 Nanite Tessellation（UE 5.3+ 实验性 → UE 5.4 Beta）

- **原理：** 将低分辨率网格内部细分为高多边形版本，再应用 Displacement Map
- **关键进展：**
  - **UE 5.3：** 实验性引入 Nanite Tessellation（仅限地形）
  - **UE 5.4：** 扩展到任意几何体，实时可调
- **启用方式：**
  1. `DefaultEngine.ini` 中添加：
     ```
     r.Nanite.AllowTessellation=1
     r.Nanite.Tessellation=1
     ```
  2. 启用 Nanite Displaced Mesh 插件
  3. 材质 Detail 面板中启用 Tessellation → 解锁 Displacement 设置
- **优势：**
  - 使用 HeightMap Texture 驱动，灵活且可在材质中操控
  - 支持变体和动画
  - Nanite 自动处理 LOD，性能优异

### 4.3 传统曲面细分的替代方案

| 方案 | 说明 | 局限性 |
|------|------|--------|
| Nanite Tessellation | UE5 官方推荐，基于高度图位移 | 需 UE 5.3+，仍为 Beta |
| 预细分网格 | DCC 工具中预先细分后导入 | 文件体积大，无自适应 LOD |
| World Position Offset | 顶点着色器中偏移 | 不增加面数，适合小幅变形 |
| Virtual Heightfield Mesh | 专用于地形的高度场网格 | 仅限地形 |
| Modeling Tool + Displacement | 编辑器内先细分再位移 | 需手动操作，非实时 |

### 4.4 Geometry Script 与程序化几何

- **Geometry Script 插件：** UE5 的 Blueprint/Python 程序化几何库
- **功能：** 查询和操作三角网格，支持布尔运算、Catmull-Clark 细分（仅编辑器模式）
- **Spline Mesh 工作流：**
  - 沿样条线等距采样点 → 近似平滑曲线
  - 采样点越多曲线越平滑，但网格越复杂
  - DynamicMeshComponent + OnRebuildGeneratedMesh 事件驱动
- **局限：** Catmull-Clark 细分等功能仅限编辑器，不可用于运行时

### 4.5 UE5 vs Blender 细分对比

| 对比项 | Blender (Cycles) | UE5 |
|--------|-----------------|-----|
| 自适应细分 | Adaptive Subdivision（成熟） | Nanite Tessellation（Beta） |
| 驱动方式 | Shader 节点 + Displacement Map | 材质 + Height Map |
| LOD 管理 | Dicing Rate + 相机距离 | Nanite 自动 LOD |
| 平滑细分 | Catmull-Clark / Simple | Geometry Script（仅编辑器） |
| 实时渲染 | 仅 Cycles 离线渲染 | 实时渲染 |
| 性能优化 | Dicing Camera | Nanite 集群渲染 |
| 程序化生成 | Geometry Nodes | Geometry Script + PCG |

---

## 五、跨平台技术对比总结

### 5.1 表面细节技术谱系

```
低开销 ◄────────────────────────────────────► 高开销
高性能                                        高质量

Bump Map → Normal Map → BumpOffset → POM → Displacement
  │           │            │          │         │
  ├── 无几何  ├── 无几何   ├── 无几何 ├── 无几何├── 真实几何
  └── Blender └── 两平台   └── UE5    └── UE5  └── 两平台
       /UE5        通用         专属       专属       通用
```

### 5.2 程序化建模技术对比

| 需求 | Blender 方案 | UE5 方案 |
|------|-------------|---------|
| 表面铺砌/镶嵌 | Tissue Tessellate | PCG + Instance Mesh |
| 有机图案生成 | Tissue Reaction Diffusion | 自定义材质/Niagara |
| 对偶网格/线框 | Tissue Dual Mesh/Polyhedral | Geometry Script |
| 程序化几何 | Geometry Nodes | Geometry Script + PCG |
| 地形位移 | Adaptive Subdivision | Nanite Tessellation / Virtual Heightfield |

### 5.3 工作流建议

1. **Blender 离线渲染管线：**
   - 大尺度变形 → Adaptive Subdivision + Displacement
   - 中等细节 → Normal Map（高模烘焙）
   - 微小细节 → Bump Map
   - 复杂镶嵌图案 → Tissue Tessellate
   - 有机/参数化造型 → Tissue + Geometry Nodes 协同

2. **UE5 实时渲染管线：**
   - 大尺度地形/网格变形 → Nanite Tessellation + Displacement（UE 5.4+）
   - 中等表面深度 → POM（英雄资产）或 Iterative Parallax
   - 基础表面细节 → Normal Map（所有资产）
   - 动态效果 → World Position Offset
   - 程序化几何 → Geometry Script

3. **Blender → UE5 资产管线：**
   - 在 Blender 中使用 Tissue 生成复杂几何 → 导出为 FBX/glTF → UE5 中启用 Nanite
   - 在 Blender 中烘焙 Displacement/Normal Map → UE5 材质中使用
   - Blender 的 Adaptive Subdivision 效果可通过 UE5 Nanite Tessellation 近似还原

---

## 参考资料

### Blender 贴图技术
- [Normal vs Displacement vs Bump Maps - CGDirector](https://www.cgdirector.com/normal-vs-displacement-vs-bump-maps/)
- [Displacement - Blender 5.1 Manual](https://docs.blender.org/manual/en/latest/render/materials/components/displacement.html)
- [Blender 5.0 Adaptive Subdivision - CGEcho](https://cgecho.net/how-to-get-true-displacement-with-blender-5-0-adaptive-subdivision/)
- [Normal Map vs Bump Map - TextureMap.app](https://texturemap.app/blog/normal-map-vs-bump-map)

### Blender Tissue
- [Tissue - Blender 4.2 Manual](https://docs.blender.org/manual/en/latest/addons/mesh/tissue.html)
- [Tissue GitHub - Alessandro Zomparelli](https://github.com/alessandro-zomparelli/tissue)
- [Tissue - Co-de-iT](https://www.co-de-it.com/code/blender-tissue)
- [Revolutionizing Computational Design with Tissue - Parametric Architecture](https://parametric-architecture.com/revolutionizing-computational-design-with-blender-insights-from-alessandro-zomparelli-and-tissue-add-on/)

### UE5 材质技术
- [Using Bump Offset - UE4/UE5 Documentation](https://docs.unrealengine.com/4.27/en-US/RenderingAndGraphics/Materials/HowTo/BumpOffset)
- [POM Tutorial - Epic Forums](https://forums.unrealengine.com/t/tutorial-parallax-occlusion-mapping-pom/52527)
- [Creation of POM in UE5 - Game Developer](https://www.gamedeveloper.com/art/creation-of-parallax-occlusion-mapping-pom-in-unreal-engine-5)
- [Height-Based Materials - DeepWiki](https://deepwiki.com/motionforge/Unreal_Engine_Essential_Materials_UE5/3.3-height-based-materials)

### UE5 曲面细分
- [Nanite Tessellation & Displacement UE 5.4 Tutorial](https://dev.epicgames.com/community/learning/tutorials/bOda/unreal-engine-nanite-tessellation-displacement-ue-5-4-step-by-step-tutorial-any-asset-not-just-landscapes)
- [Nanite Tessellation in UE 5.3](https://dev.epicgames.com/community/learning/tutorials/RBvX/unreal-engine-new-in-unreal-5-3-tessellation-displacement-in-nanite-meshes-tutorial)
- [Geometry Scripting Reference - UE5](https://dev.epicgames.com/documentation/en-us/unreal-engine/geometry-scripting-reference-in-unreal-engine)
- [Geometry Script FAQ - Gradientspace](http://www.gradientspace.com/tutorials/2022/12/19/geometry-script-faq)
