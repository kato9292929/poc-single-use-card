# 実証3：単回利用カードと x402 の購入比較

状態：**準備済み・未実施**（2026-11-06 時点）。経路 B は止めた（下記）

同じデータ（Japan Inflation Nowcall の `/api/jin/series`）を、x402（USDC 直接）とカード（Revolut の使い捨てカード → Nevermined の $1 プラン）で 1 回ずつ買い、比べる。

## 参照した公式ドキュメント（2026-11-04 確認）

| 対象 | URL | 確かめたこと |
|---|---|---|
| Revolut 使い捨てバーチャルカード | https://www.revolut.com/ja-JP/blog/post/disposable-virtual-cards/ | 1 回払うと自動で無効になり、番号が新しくなる。発行は無料。サブスクリプションなどの継続課金には向かない（2026-01 に発行上限の変更ありとページに記載） |
| JIN の x402 | https://jin.x402jp.com/api/jin/series （402 の要求を 2026-11-04 に取得） | `exact`、`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`、USDC `EPjF…Dt1v`、`amount: 10000`（$0.01）、payTo `4s8X…3VPf` |
| Nevermined の本番プラン | https://nevermined.app/checkout/plan/109390300569784239149001680992260682156573712120263169260609849660793213537158 | $1・100 クレジット・30 日、カード払いのみ（実証1 の docs/live.md） |

指示書との違い：なし。

## 手順

- 経路A：Actions の `route-a-x402` を手で 1 回動かす（`scripts/route-a.mjs`）。Secrets の `BUYER_SOLANA_SECRET_KEY` で署名し、$0.01 を超える要求には署名しない。402 を受けた時刻から 200 までの時間、トランザクション署名、チェーン手数料（Solana の公開 RPC の `getTransaction`）、レスポンスの件数を `runs/` にコミットする
- 経路B：**止めた（2026-11-06）**。売り手（x402）の Stripe アカウント `acct_1U0L1S3vSEcfGG4Q` が日本で使えなくなり、Nevermined の接続状態が `isValidated: false`・`needsReconnect: true` に変わった（2026-11-06 07:50 UTC、Nevermined の `GET /api/v1/fiat/stripe/connect/status`。11/02 は検証済みだった）。$1 プランはカードで買えなくなったため、Revolut の使い捨てカードで買う経路は実行できない。比較は経路 A の数字と、実証1 の本番の $1 購入の記録（付与まで約 5 時間、売り手の取り分 $0.65）で行う

## 結果

| 項目 | A：x402 | B：使い捨てカード（止めた） |
|---|---|---|
| 実施日時 | | |
| 購入完了までの時間（承認待ちを含む） | | |
| 1 件あたりの手数料 | | |
| 成否 | | |
| 失敗したときに残る記録 | トランザクション | カード明細と Nevermined の購入記録 |
| エラー内容 | | |
