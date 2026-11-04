// 経路A：JIN の /api/jin/series を x402（Solana mainnet の USDC $0.01）で 1 回買う。
// 秘密鍵は GitHub Actions の Secrets（BUYER_SOLANA_SECRET_KEY、base58 の 64 バイト鍵）からだけ読む。
// DRY_RUN=1 なら 402 を受けて要求を確かめるところで止め、署名しない。
import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactSvmScheme } from '@x402/svm/exact/client';
import { createKeyPairSignerFromBytes } from '@solana/kit';
import { base58 } from '@scure/base';
import { JIN_SERIES, SOLANA_MAINNET, USDC_MINT, saveRun, countItems, lookupSolanaTx } from './common.mjs';

const MAX_ATOMIC = 10_000n; // $0.01（USDC は 6 桁）。これを超える要求には署名しない
const dry = process.env.DRY_RUN === '1';

const client = new x402Client();
let payer;
if (!dry) {
  const key = process.env.BUYER_SOLANA_SECRET_KEY;
  if (!key) throw new Error('BUYER_SOLANA_SECRET_KEY is not set');
  const signer = await createKeyPairSignerFromBytes(base58.decode(key.trim()));
  payer = signer.address;
  client.register('solana:*', new ExactSvmScheme(signer));
}
const http = new x402HTTPClient(client);

const t0 = Date.now();
const first = await fetch(JIN_SERIES);
const t402 = Date.now();
if (first.status !== 402) throw new Error(`expected 402, got ${first.status}`);
const text = await first.text();
let body;
try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
const pr = http.getPaymentRequiredResponse((n) => first.headers.get(n), body);
const req = pr.accepts.find((a) => a.scheme === 'exact' && a.network === SOLANA_MAINNET && a.asset === USDC_MINT);
if (!req) throw new Error(`no Solana mainnet USDC exact requirement: ${JSON.stringify(pr.accepts.map((a) => [a.scheme, a.network, a.asset]))}`);
if (BigInt(req.amount) > MAX_ATOMIC) throw new Error(`price ${req.amount} exceeds cap ${MAX_ATOMIC}`);

if (dry) {
  saveRun('route-a-dry', { dryRun: true, url: JIN_SERIES, firstStatus: first.status, msTo402: t402 - t0, requirement: { network: req.network, asset: req.asset, amount: req.amount, payTo: req.payTo } });
  process.exit(0);
}

const payload = await client.createPaymentPayload({ ...pr, accepts: [req] });
const headers = new Headers(http.encodePaymentSignatureHeader(payload));
const second = await fetch(JIN_SERIES, { headers });
const t200 = Date.now();
let settled;
try { settled = http.getPaymentSettleResponse((n) => second.headers.get(n)); } catch { settled = undefined; }
const out = second.ok ? await second.json().catch(() => null) : await second.text().catch(() => '');
const tx = settled?.transaction ? await lookupSolanaTx(settled.transaction) : null;

saveRun('route-a', {
  route: 'A',
  url: JIN_SERIES,
  startedAt: new Date(t0).toISOString(),
  received402At: new Date(t402).toISOString(),
  finishedAt: new Date(t200).toISOString(),
  ms402to200: t200 - t402,
  msTotal: t200 - t0,
  status: second.status,
  payer,
  amountAtomic: req.amount,
  amountUsd: Number(req.amount) / 1e6,
  payTo: req.payTo,
  settle: settled ?? null,
  chain: tx, // feePayer が買い手でなければ、チェーン手数料は facilitator が払っている
  items: second.ok ? countItems(out) : null,
  error: second.ok ? undefined : String(out).slice(0, 300),
});
if (!second.ok) process.exit(1);
