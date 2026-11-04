// 経路B：Revolut の使い捨てカードで買った Nevermined の $1 プラン（100 クレジット）が反映されるまで、
// 買い手の残高を 5 分おきに確かめ、増えたら実証1 のゲートウェイ経由で /api/jin/series を 1 回買って終わる（最長 345 分）。
// キーは GitHub Actions の Secrets（NVM_BUYER_API_KEY、Nevermined Live の買い手）からだけ読む。
import { Payments } from '@nevermined-io/payments';
import { saveRun, countItems } from './common.mjs';

const PLAN_ID = '109390300569784239149001680992260682156573712120263169260609849660793213537158';
const AGENT_ID = '40597898777609448364666718252952480148470005949452368282165923844683523900188';
const GATEWAY = 'https://poc-card-credits.vercel.app';
const PATH = '/api/jin/series';
const POLL_MS = 5 * 60_000;
const MAX_MS = 345 * 60_000;
const DELEGATION_LIMIT_CENTS = 100;

// 貼り付けで混ざりやすいもの（ゼロ幅文字・引用符・全角コロン）を落とす
const key = process.env.NVM_BUYER_API_KEY?.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().replace(/^["'“”‘’](.*)["'“”‘’]$/s, '$1').trim().replace(/^([A-Za-z-]{1,20})\s*[：:]\s*/, '$1:');
if (!key) throw new Error('NVM_BUYER_API_KEY is not set');
const purchaseStartedAt = process.env.PURCHASE_STARTED_AT || null; // こちら（人）が購入ボタンを押した時刻
const payments = Payments.getInstance({ nvmApiKey: key, environment: 'live' });
const holder = payments.getAccountAddress();
const balance = async () => BigInt((await payments.plans.getPlanBalance(PLAN_ID)).balance ?? 0);

const startedAt = new Date();
// 購入の前の残高。ワークフローを動かす前にクレジットが付いても見落とさないよう、分かっていれば入力で渡す
const baseline = process.env.BASELINE_BALANCE ? BigInt(process.env.BASELINE_BALANCE) : await balance();
const first = await balance();
const checks = [{ at: startedAt.toISOString(), balance: String(first) }];
let creditedAt = first > baseline ? startedAt : null;
let now = first;
while (!creditedAt && Date.now() - startedAt.getTime() < MAX_MS) {
  await new Promise((r) => setTimeout(r, POLL_MS));
  now = await balance();
  checks.push({ at: new Date().toISOString(), balance: String(now) });
  if (now > baseline) { creditedAt = new Date(); break; }
}

// Nevermined の購入記録（先引きの内訳）。最新の購入を 1 件取る
async function latestPurchase() {
  const r = await fetch('https://api.live.nevermined.app/api/v1/transactions/plans-purchased-detailed?page=1&offset=10', { headers: { authorization: `Bearer ${key}`, accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  const txs = (j?.results ?? []).filter((p) => p.plan?.id === PLAN_ID).flatMap((p) => p.transactions ?? []).filter((t) => t.txType === 'Purchase');
  txs.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const t = txs[0];
  if (!t) return null;
  const m = t.providerMetadata ?? {};
  return {
    createdAt: t.createdAt, settledAt: t.settledAt, priceMicro: t.price, ownerMarginMicro: t.ownerMargin, nvmMarginMicro: t.nvmMargin,
    stripeFeeMicro: t.stripeFee, estimatedStripeFeeMicro: m.estimatedStripeFeeMicro, actualStripeFeeMicro: m.actualStripeFeeMicro,
    settlementCurrency: m.settlementCurrency, exchangeRate: m.exchangeRate, feeDetails: m.feeDetails, reconciliationStatus: t.reconciliationStatus,
  };
}

if (!creditedAt) {
  saveRun('route-b', { route: 'B', purchaseStartedAt, watchStartedAt: startedAt.toISOString(), holder, baseline: String(baseline), credited: false, checks, purchase: await latestPurchase(), error: `credits did not increase within ${MAX_MS / 60000} min` });
  process.exit(1);
}

// カードの委任を用意する（有効なものがあれば使い回す）。残高があるうちは委任から請求されない
const list = await payments.delegation.listDelegations({ accessible: true });
let d = list.delegations.find((x) => x.status === 'Active' && String(x.currency).toLowerCase() === 'usd' && Number(x.spendingLimitCents) <= DELEGATION_LIMIT_CENTS && Number(x.remainingBudgetCents) > 0 && Date.parse(x.expiresAt) > Date.now());
let delegationId = d?.delegationId;
if (!delegationId) {
  const card = (await payments.delegation.listPaymentMethods()).find((m) => m.type === 'card' && (m.status ?? 'Active') === 'Active');
  if (!card) throw new Error('no active card on the buyer account');
  delegationId = (await payments.delegation.createDelegation({ provider: card.provider, providerPaymentMethodId: card.id, spendingLimitCents: DELEGATION_LIMIT_CENTS, durationSecs: 86_400, currency: 'usd' })).delegationId;
}
const { accessToken } = await payments.x402.getX402AccessToken(PLAN_ID, AGENT_ID, { scheme: 'nvm:card-delegation', network: 'stripe', delegationConfig: { delegationId } });
const callStarted = Date.now();
const res = await fetch(`${GATEWAY}${PATH}`, { headers: { 'payment-signature': accessToken } });
const dataAt = new Date();
const out = res.ok ? await res.json().catch(() => null) : await res.text().catch(() => '');

const ms = (a, b) => (a && b ? Date.parse(b) - Date.parse(a) : null);
saveRun('route-b', {
  route: 'B',
  purchaseStartedAt,
  watchStartedAt: startedAt.toISOString(),
  creditedAt: creditedAt.toISOString(),
  dataAt: dataAt.toISOString(),
  msPurchaseToCredit: ms(purchaseStartedAt, creditedAt.toISOString()),
  msPurchaseToData: ms(purchaseStartedAt, dataAt.toISOString()),
  callMs: dataAt.getTime() - callStarted,
  holder,
  balanceBefore: String(baseline),
  balanceAfterCredit: String(now),
  status: res.status,
  creditsConsumed: res.headers.get('x-credits-consumed'),
  creditsRemaining: res.headers.get('x-credits-remaining'),
  items: res.ok ? countItems(out) : null,
  purchase: await latestPurchase(),
  checks,
  error: res.ok ? undefined : String(out).slice(0, 300),
});
if (!res.ok) process.exit(1);
