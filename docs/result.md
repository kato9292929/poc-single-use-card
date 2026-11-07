# 実証3：x402 の 1 回の購入とカードの前払いの比較

状態：**完了**（2026-11-07）

同じデータ（Japan Inflation Nowcall の `/api/jin/series`）について、x402（Solana の USDC $0.01）で 1 回買った記録と、実証1 の本番でのカードの前払い（$1・100 クレジット）の記録を並べて比べる。カード側は新たに買わない。

計画：https://note.com/x402inc/n/naf32f4cea741

## 参照した公式ドキュメント（2026-11-07 確認）

| 対象 | URL | 確かめたこと |
|---|---|---|
| x402 の決済方式 | https://docs.x402.org/schemes/overview | `exact` は固定額のリクエスト向け |
| JIN の x402 | https://jin.x402jp.com/api/jin/series （402 の要求を 2026-11-04 に取得） | `exact`、`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`、USDC `EPjF…Dt1v`、`amount: 10000`（$0.01）、payTo `4s8X…3VPf` |
| カードの前払い（実証1） | https://nevermined.app/checkout/plan/109390300569784239149001680992260682156573712120263169260609849660793213537158 | $1・100 クレジット・30 日。2026-11-02 の本番の購入記録（poc-card-credits の docs/live.md） |

## 手順

- x402：Actions の `route-a-x402` を手で 1 回動かす（`scripts/route-a.mjs`）。Secrets の `BUYER_SOLANA_SECRET_KEY` で署名し、$0.01 を超える要求には署名しない。402 を受けてから 200 までの時間、トランザクション署名、チェーン手数料（Solana の公開 RPC の `getTransaction`）、レスポンスの件数を `runs/` にコミットする
- カードの前払い：実証1 の本番の記録を使う

## 結果

x402 の実行：Actions `route-a-x402` #1（2026-11-07 11:15 UTC、成功）。記録は [`runs/route-a-2026-11-07T11-15-18-509Z.json`](../runs/route-a-2026-11-07T11-15-18-509Z.json)。トランザクションは [`5Zn4ii7G…AYKCMJwV`](https://solscan.io/tx/5Zn4ii7GEMboAp5Bs9eAP5u77robC5RvzxpFMuYZpzDSoZW758LWq94pNyXwv2tXgWAJPMKLA58djeNAAYKCMJwV)（slot 466491889）。

| 項目 | x402（USDC） | カードの前払い（実証1 の本番の記録） |
|---|---|---|
| 実施日時 | 2026-11-07 11:15:15 UTC | 2026-11-02（購入）、2026-11-03 00:01 UTC（初回の利用） |
| 1 回の支払い | $0.01（1 リクエスト） | $1（100 クレジット＝100 リクエスト分） |
| seller の受取 | **$0.01（100%）**。チェーン上の USDC の移動は買い手 `3HG2…rcgV` −0.01、seller `4s8X…3VPf` ＋0.01 | **$0.65（65%）**。Nevermined の手数料 $0.02 と、Stripe 手数料の見積もり $0.33 を先に引く（実際の Stripe 手数料は $0.039） |
| 支払いから使えるまでの時間 | **1.4 秒**（402 を受けてから 200 まで 1,445 ms。最初のリクエストからは 2,796 ms） | **約 5 時間**（購入完了から、Nevermined がクレジットを付けた 17:19:33 UTC まで） |
| チェーン手数料 | 10,001 lamports（0.000010001 SOL）。払ったのは facilitator `CjNF…eKww` で、買い手・seller の負担は 0 | — |
| 成否 | 成功（HTTP 200、14 件） | 成功（JIN 1 回、HTTP 200） |
| 失敗したときに残る記録 | Solana のトランザクション（誰でも署名で引ける） | カード明細と Nevermined の購入記録（それぞれの事業者の画面・API の中） |
| エラー内容 | なし | なし（ただし購入画面の「Order complete」から付与まで約 5 時間、付与されない状態が続いた） |

まとめ：同じ `/api/jin/series` 1 回分について、x402 は seller に 100% が 1.4 秒で届いた。カードの前払いは 100 回分をまとめて買っても seller に残るのは 65% で、使えるまで約 5 時間かかった。
