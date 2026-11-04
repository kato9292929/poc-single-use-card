# poc-single-use-card（実証3）

単回利用カードと x402 で、同じデータを 1 回ずつ買って比べる。結果は [docs/result.md](docs/result.md)。

- 経路A：`.github/workflows/route-a.yml`（Secrets `BUYER_SOLANA_SECRET_KEY`）
- 経路B：`.github/workflows/route-b.yml`（Secrets `NVM_BUYER_API_KEY`）

どちらも `workflow_dispatch` だけで動く。定期実行はしない。鍵はコミットしない。
