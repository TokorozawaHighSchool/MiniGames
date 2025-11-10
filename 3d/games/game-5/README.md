# Forest FPS MVP (Web)

このプロジェクトは、Three.js を使ってローカルブラウザで動く森林3D FPSのMVPです。
外部の3D/音声ファイルは使わず、手続き的に地形・木・環境音を生成します。

## 実行方法（推奨：ローカルHTTPサーバ）
PowerShell を開き、プロジェクトディレクトリに移動して下記を実行します：

```powershell
# Python がインストールされている場合
python -m http.server 8000

# あるいは Node.js がある場合（http-server をインストール済み）
npx http-server -p 8000
```

ブラウザで `http://localhost:8000/` を開いてください。

> file:// で直接開くとポインターロックやモジュール読み込みで問題が出る場合があります。簡易サーバを使うことを推奨します。

## 完全オフライン（ES Module）での実行方法
CDN に依存せずにローカルで実行したい場合は、Three.js の ES Module 版をローカルに置き、`index.html` がそれを import する形にしています。準備は簡単です。

1. PowerShell を開き、プロジェクトルートで以下を実行して three.module.js をダウンロードします：

```powershell
.\download_three_module.ps1
```

2. ダウンロードに成功すると `./lib/three.module.js` が作成されます。あとは `index.html` をダブルクリックして開けば、`<script type="module"> import * as THREE from './lib/three.module.js';` によりオフラインで動作します。

注意：一部のブラウザでは file:// 上での ES Module import に制約がある場合があります。もしうまく動かない場合は、極めて簡易なローカルサーバ（Python や npx http-server）を短時間だけ使うことを推奨します。

## 操作
- ボタンを押して画面をクリック → ポインターロックが有効になります。
- WASD で移動、マウスで視点移動、クリックで射撃（レイ判定）。

## 仕様
- 地形：Perlin風ノイズで生成
- 木：プロシージャル幹（円筒）＋葉はインスタンス平面（風で揺れる）
- 音：WebAudio で合成した風と鳥の音

## 開発メモ
このMVPは拡張可能です。ポストプロセス、SSAO、カスケードシャドウ、LOD/インポスターは次フェーズで追加予定です。
