# poc-single-use-card（実証3）

x402 の 1 回の購入と、カードの前払い（実証1 の本番の記録）を比べる。結果は [docs/result.md](docs/result.md)。

- `.github/workflows/route-a.yml`（`route-a-x402`）：`workflow_dispatch` だけで動く。Secrets `BUYER_SOLANA_SECRET_KEY` を読む。定期実行はしない。鍵はコミットしない
