# iOS 云打包（只用当前这台 Windows 电脑）

本项目已提供 `codemagic.yaml`，可直接在 Codemagic 使用云端 Mac 构建 `.ipa`。

## 1. 推送代码

在本机执行：

```powershell
cd E:\workspace\food
git add .
git commit -m "Add codemagic iOS workflow"
git push
```

## 2. 在 Codemagic 创建应用

1. 登录 Codemagic，连接你的 Git 仓库。
2. 选择本仓库后，使用 `codemagic.yaml` 作为工作流配置。
3. 选择工作流：`ios-ipa`。

## 3. 配置签名（关键）

在 Codemagic 的 `Team > Environment variables` 新建变量组 `app_store_credentials`，至少包含：

- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_IDENTIFIER`
- `APP_STORE_CONNECT_PRIVATE_KEY`
- `CERTIFICATE_PRIVATE_KEY`
- `CERTIFICATE_P12`
- `CERTIFICATE_PASSWORD`
- `PROFILE`（mobileprovision 内容）

说明：
- 上面变量名与 `xcode-project use-profiles` 兼容。
- 最简单方式是使用 Codemagic 的 iOS signing 向导自动生成这些变量。

## 4. 修改两个占位项

打开项目根目录 `codemagic.yaml`，修改：

1. `environment.vars.BUNDLE_ID`
   - 改成你的真实 iOS Bundle ID（必须和证书/描述文件一致）
2. `publishing.email.recipients`
   - 改成你自己的邮箱（接收构建结果）

## 5. 发起构建

在 Codemagic 点击 `Start new build`，选择 `ios-ipa`。

构建成功后，在 Artifacts 下载：

- `build/ios/ipa/*.ipa`

该 `.ipa` 可用于 TestFlight/Ad Hoc 分发。

