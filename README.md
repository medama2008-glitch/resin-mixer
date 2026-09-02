# ResinMixer

光造形用 UV レジンを原料から自家配合するための計算・手順表示アプリ (PWA)。
サーバーなし、`public/recipes.json` をレシピ台帳として GitHub Pages で配信する。

- 目標バッチ量 → 各成分の必要量
- 基準成分 (高粘度主剤) の **実測値を入力すると他成分を再計算**
- step 順の作業手順カード (チェックボックス付き) と印刷設定
- JSON 貼り付けによるレシピのインポート (端末内 localStorage に保存)
- ホーム画面追加、オフライン動作 (前回取得したレシピを使用)

## セットアップ (初回)

```bash
git clone https://github.com/<user>/resin-mixer.git
cd resin-mixer
npm install
npm run dev        # http://localhost:5173/
```

- `npm test` … 計算・手順文言・バリデーションのユニットテスト
- `npm run build` … `dist/` に本番ビルド (GitHub Pages 用に base=/resin-mixer/)
- `npm run preview` … 本番ビルドをローカル確認 (Service Worker の動作確認はこちらで)
- `node scripts/make-icons.mjs` … PWA アイコン PNG を再生成 (通常は不要)

スマホから開発中の画面を見るには `npm run dev -- --host` で LAN 公開する。

## レシピの更新手順

1. チャット (Claude) で確定したレシピを `schema_version: 1` の JSON で受け取る
2. `public/recipes.json` の `recipes` 配列に追加 / 差し替える
   - 古いレシピは削除せず `"status": "archived"` にする
3. `npm test` が通ることを確認 (recipes.json 自体の検証はアプリ起動時に行われる)
4. commit → `main` に push
   ```bash
   git add public/recipes.json
   git commit -m "recipes: B-3 追加"
   git push
   ```
5. GitHub Actions が自動でビルド & デプロイ (数分)。スマホでアプリをリロードすると反映される
   - オフライン時は前回取得分が表示され、次にオンラインで開いたときに更新される

すぐに試したいだけなら、アプリ右上の ⇩ (インポート) に JSON を貼り付ければ
push せずにその端末だけで使える (「ローカル」バッジ付き。同 id は recipes.json より優先)。

### スキーマ

```jsonc
{
  "schema_version": 1,
  "recipes": [
    {
      "id": "B-2",                 // 一意
      "status": "active",          // active | archived | experimental
      "date": "2026-09-01",
      "base_component": "L-6206",  // 実測入力の基準となる成分名 (components に存在すること)
      "components": [
        // ratio は wt%。合計は 100 でなくてよい (比率として扱う)
        // step: 1=先溶かし, 2=モノマーカクテル, 3=主剤合流 (base_component を含む step が合流工程)
        // role: oligomer | diluent | crosslinker | initiator | blocker
        {"name": "L-6206", "ratio": 61.0, "role": "oligomer", "step": 3},
        {"name": "BAPO", "ratio": 1.0, "role": "initiator", "step": 1, "note": "任意の注意書き"}
      ],
      "print_profile": { "exposure_s": 6.0, "layer_mm": 0.05 },  // 任意
      "notes": "任意"
    }
  ]
}
```

手順文言は components / step / role / note から自動生成される。
複数オリゴマーのブレンドは、同じ step に oligomer 行を追加するだけでよい。

## GitHub Pages の初期設定 (1 回だけ)

1. GitHub でリポジトリ `resin-mixer` を作成し、このディレクトリを push
   ```bash
   git remote add origin https://github.com/<user>/resin-mixer.git
   git push -u origin main
   ```
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
3. `main` に push すると `.github/workflows/deploy.yml` が走り、
   `https://<user>.github.io/resin-mixer/` で公開される
4. スマホでその URL を開き、「ホーム画面に追加」

リポジトリ名を変えた場合も、ワークフローがリポジトリ名から自動で base パスを決めるので設定変更は不要。
ローカルで `npm run build` する場合は `vite.config.ts` の既定値 `/resin-mixer/` が使われる。

## 2 台目 PC のセットアップ

```bash
git clone https://github.com/<user>/resin-mixer.git
cd resin-mixer
npm install
npm run dev
```

作業はブランチで行い、`main` にマージしたものだけがデプロイされる。

```bash
git switch -c recipe/b-3        # ブランチ作成
# ... recipes.json を編集 ...
git commit -am "recipes: B-3 追加"
git push -u origin recipe/b-3    # PR を作ってマージ、または main に直接マージ
```

もう一方の PC で作業を続けるときは、始める前に `git pull` すること。

## 構成

```
public/recipes.json      レシピ台帳 (アプリが fetch する)
public/icon*.png, .svg   PWA アイコン
src/lib/calc.ts          配合計算 (目標量 / 実測基準)
src/lib/steps.ts         工程カードの文言生成
src/lib/validate.ts      JSON バリデーション
src/lib/storage.ts       localStorage (インポート分・オフラインキャッシュ・テーマ)
src/useRecipes.ts        recipes.json 取得 + ローカル分のマージ
src/components/          一覧 / 計算+手順 / インポート
.github/workflows/       Pages デプロイ
```

- Vite + React + TypeScript、vite-plugin-pwa (Workbox)
- `recipes.json` は Service Worker で NetworkFirst (オンラインなら常に最新、オフラインなら前回分)
- ルーティングは hash (`#/`, `#/r/<id>`, `#/import`) なので Pages のサブパスでもリロードで壊れない
