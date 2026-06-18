# GitHub Pagesで公開する手順

このフォルダをGitHubにアップロードすると、スマホから見られるURLを作れます。

## 1. GitHubで新しいリポジトリを作る

GitHubで `keiba-consensus` などの名前で新しいリポジトリを作ります。

## 2. ファイルをアップロードする

このフォルダ内のファイルをすべてアップロードします。

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `.nojekyll`
- `.github/workflows/pages.yml`
- `DEPLOY_GITHUB_PAGES.md`

## 3. GitHub Pagesを有効にする

リポジトリの `Settings` → `Pages` を開きます。

`Build and deployment` の `Source` を `GitHub Actions` にします。

## 4. 公開URLを確認する

アップロード後、`Actions` の処理が終わると公開されます。

URLは通常この形です。

```text
https://ユーザー名.github.io/リポジトリ名/
```

## テスト表示

土曜午前として動作確認したいときは、URLの末尾にこれを付けます。

```text
?demoTime=2026-06-20T10:00:00+09:00
```
