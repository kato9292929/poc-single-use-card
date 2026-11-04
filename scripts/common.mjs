import { writeFileSync, mkdirSync } from 'node:fs';

export const JIN_SERIES = 'https://jin.x402jp.com/api/jin/series';
export const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/** 結果を runs/<name>-<時刻>.json に書き、ワークフローのジョブ要約にも出す */
export function saveRun(name, result) {
  mkdirSync('runs', { recursive: true });
  const file = `runs/${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${name}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`, { flag: 'a' });
  }
  console.log(JSON.stringify(result, null, 2));
  return file;
}

/** レスポンスの件数（配列ならその長さ、{ series: [...] } のような形なら最初に見つかった配列の長さ） */
export function countItems(body) {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === 'object') {
    for (const v of Object.values(body)) if (Array.isArray(v)) return v.length;
  }
  return null;
}

/** Solana の公開 RPC でトランザクションを引き、時刻・手数料・手数料の支払い手を返す（見つかるまで最大 60 秒待つ） */
export async function lookupSolanaTx(signature) {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }] }),
    });
    const j = await r.json();
    const tx = j.result;
    if (tx) {
      const keys = tx.transaction.message.accountKeys;
      return {
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        feeLamports: tx.meta.fee,
        feeSol: tx.meta.fee / 1e9,
        feePayer: (keys[0]?.pubkey ?? keys[0])?.toString(),
        err: tx.meta.err,
      };
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
  return { signature, notFound: true };
}
