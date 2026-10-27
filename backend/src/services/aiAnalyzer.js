const { Anthropic } = require('@anthropic-ai/sdk');
const store = require('../data/mockStore');

const MODEL = process.env.AI_MODEL || 'deepseek-v4-pro';
const MAX_TOKENS_DEFAULT = Number(process.env.AI_MAX_TOKENS) || 2000;
const MAX_TOKENS_REPORT = Number(process.env.AI_MAX_TOKENS_REPORT) || 4000;
const BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';

function createClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('sk-your-api-key') || apiKey.startsWith('sk-ant-api03-your-key')) {
    throw new Error('AI_API_KEY_NOT_CONFIGURED');
  }
  return new Anthropic({ apiKey, baseURL: BASE_URL });
}

function gatherBusinessContext() {
  const products = store.list('products');
  const customers = store.list('customers');
  const suppliers = store.list('suppliers');
  const sales = store.list('sales');
  const purchases = store.list('purchases');
  const inventory = store.list('inventory');
  const accounts = store.list('accounts');
  const warehouses = store.list('warehouses');
  const finance = store.getFinanceSummary();

  const totalSalesAmount = sales.reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalPurchasesAmount = purchases.reduce((s, o) => s + Number(o.amount || 0), 0);
  const avgSaleAmount = sales.length ? Math.round(totalSalesAmount / sales.length) : 0;
  const avgPurchaseAmount = purchases.length ? Math.round(totalPurchasesAmount / purchases.length) : 0;
  const totalInventoryQuantity = inventory.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalInventoryValue = inventory.reduce(
    (s, i) => s + Number(i.quantity || 0) * Number(i.price || 0), 0
  );

  return {
    summary: {
      productCount: products.length,
      customerCount: customers.length,
      supplierCount: suppliers.length,
      salesCount: sales.length,
      purchasesCount: purchases.length,
      totalSalesAmount,
      totalPurchasesAmount,
      avgSaleAmount,
      avgPurchaseAmount,
      receivable: finance.receivable || 0,
      payable: finance.payable || 0,
      cashBalance: finance.cashBalance || 0,
      monthlyProfit: finance.monthlyProfit || 0,
      totalInventoryQuantity,
      totalInventoryValue,
    },
    products: products.slice(0, 30).map((p) => ({
      name: p.name, category: p.category, price: p.price, unit: p.unit, stock: p.stock, sold: p.sold || 0,
    })),
    customers: customers.slice(0, 20).map((c) => ({
      name: c.name, contacts: c.contacts, phone: c.phone, level: c.level, balance: c.balance,
    })),
    suppliers: suppliers.slice(0, 20).map((s) => ({
      name: s.name, contacts: s.contacts, phone: s.phone, payable: s.payable,
    })),
    accounts: accounts.map((a) => ({
      name: a.name, type: a.type, balance: a.balance,
    })),
    warehouses: warehouses.map((w) => ({
      name: w.name, address: w.address,
    })),
    recentSales: sales.slice(0, 30).map((s) => ({
      orderNo: s.orderNo, customer: s.customer, status: s.status,
      amount: s.amount, date: s.date,
      itemCount: (s.items || []).length,
    })),
    recentPurchases: purchases.slice(0, 30).map((p) => ({
      orderNo: p.orderNo, supplier: p.supplier, status: p.status,
      amount: p.amount, date: p.date,
      itemCount: (p.items || []).length,
    })),
    recentTransactions: (finance.transactions || []).slice(0, 30).map((t) => ({
      title: t.title, type: t.type, counterparty: t.counterparty, amount: t.amount, date: t.date,
    })),
    inventory: inventory.slice(0, 30).map((i) => ({
      productName: i.productName, warehouseId: i.warehouseId, quantity: i.quantity,
    })),
  };
}

function buildSystemPrompt(context, featureType) {
  const base = `你是Lutra 财务管理系统的AI分析助手。你拥有企业当前所有业务数据的完整访问权限，可以分析财务状况、销售趋势、采购动态、库存水平等问题。

## 当前业务数据
${JSON.stringify(context, null, 2)}

## 回答要求
- 用中文回答，专业简洁
- 所有分析必须基于上述实际数据，不得编造
- 金额单位：元（人民币）
- 当数据不足以回答问题时，明确说明"根据现有数据，无法确定..."
- 需要对数据进行具体计算时，展示计算过程和结果`;

  const additions = {
    query: `\n请回答用户的以下问题。`,
    report: `\n请生成一份详细的财务分析报告。`,
    anomalies: `\n请分析上述数据中的异常情况。以JSON数组格式返回，每个异常对象包含：type(类型), severity(严重程度:high/medium/low), title(标题), description(描述), suggestion(建议)。只返回JSON数组，不要包含其他文字或markdown标记。异常类型包括但不限于：abnormal_transaction(异常大额交易), revenue_drop(收入下滑), inventory_anomaly(库存异常), credit_risk(应收风险), payment_urgency(应付压力)。`,
    advice: `\n用户正在寻求经营建议。请提供3-5条具体可执行的建议，每条包含：建议内容、数据依据、预期效果。`,
  };

  return base + (additions[featureType] || additions.query);
}

function translateApiError(error) {
  if (!error) return '未知错误';
  if (error.message === 'AI_API_KEY_NOT_CONFIGURED') {
    return 'AI服务未配置API密钥，请在 backend/.env 中设置 ANTHROPIC_API_KEY';
  }
  const status = error.status || (error.response && error.response.status);
  if (status === 401 || status === 403) return 'AI API密钥无效，请联系管理员检查配置';
  if (status === 429) return 'AI服务请求过于频繁，请15分钟后重试';
  if (status && status >= 500) return 'AI服务暂时不可用，请稍后重试';
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return 'AI服务连接失败，请检查网络';
  if (error.error && error.error.type === 'overloaded_error') return 'AI服务当前负载过高，请稍后重试';
  return `AI分析失败: ${error.message || '未知错误'}`;
}

async function queryData(question, options = {}) {
  const { stream = false } = options;
  const anthropic = createClaudeClient();
  const context = gatherBusinessContext();
  const systemPrompt = buildSystemPrompt(context, 'query');

  const messages = [{ role: 'user', content: question }];

  if (stream) {
    return anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS_DEFAULT,
      system: systemPrompt,
      messages,
    });
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_DEFAULT,
    system: systemPrompt,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

async function generateReport(reportType = 'comprehensive', options = {}) {
  const anthropic = createClaudeClient();
  const context = gatherBusinessContext();

  const reportInstructions = {
    trend: '请生成一份财务趋势分析报告，包含：收入趋势分析、支出趋势分析、利润变化分析、库存变动趋势、客户消费趋势，以及改进建议。',
    forecast: '请生成一份财务预测报告，包含：基于历史数据的收入预测、支出预测、库存需求预测，以及风险因素分析。',
    risk: '请生成一份风险预警报告，包含：财务风险评估、应收账款风险、库存风险、现金流风险，以及风险应对建议。',
    comprehensive: '请生成一份综合财务分析报告，包含：经营概览、收入与利润分析、成本分析、客户分析、库存分析、风险评估、改进建议。',
  };

  const instruction = reportInstructions[reportType] || reportInstructions.comprehensive;
  const systemPrompt = buildSystemPrompt(context, 'report') + '\n' + instruction;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_REPORT,
    system: systemPrompt,
    messages: [{ role: 'user', content: `请生成${reportType === 'comprehensive' ? '综合' : reportType === 'trend' ? '趋势' : reportType === 'forecast' ? '预测' : '风险'}分析报告。` }],
  });

  return {
    reportType,
    report: response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(''),
    generatedAt: new Date().toISOString(),
  };
}

async function detectAnomalies(options = {}) {
  const anthropic = createClaudeClient();
  const context = gatherBusinessContext();
  const systemPrompt = buildSystemPrompt(context, 'anomalies');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_DEFAULT,
    system: systemPrompt,
    messages: [{ role: 'user', content: '请扫描以上数据中的所有异常情况，返回JSON数组。' }],
  });

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  let anomalies = [];
  try {
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    anomalies = JSON.parse(cleaned);
    if (!Array.isArray(anomalies)) anomalies = [];
  } catch {
    anomalies = [
      {
        type: 'parse_error',
        severity: 'low',
        title: 'AI返回格式异常',
        description: '无法解析AI返回的异常检测结果，请重试',
        suggestion: rawText.slice(0, 200),
      },
    ];
  }

  return {
    anomalies,
    scannedRecords: {
      sales: context.recentSales.length,
      purchases: context.recentPurchases.length,
      products: context.products.length,
      accounts: context.accounts.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function getAdvice(question, options = {}) {
  const { stream = false, focus = 'general' } = options;
  const anthropic = createClaudeClient();
  const context = gatherBusinessContext();

  const focusInstructions = {
    purchasing: '用户正在寻求采购方面的建议。请结合当前库存水平、销售趋势和供应商情况，给出具体的采购建议。',
    pricing: '用户正在寻求定价方面的建议。请结合产品销售数据、客户消费水平和市场情况，给出合理的定价策略。',
    inventory: '用户正在寻求库存管理方面的建议。请结合当前库存水平、销售速度和仓储情况，给出库存优化建议。',
    customer: '用户正在寻求客户管理方面的建议。请结合客户消费数据、等级分布和应收账款情况，给出客户关系管理建议。',
    general: '用户正在寻求经营方面的建议。请结合当前业务数据和财务状况，给出3-5条具体可执行的经营建议。',
  };

  const systemPrompt =
    buildSystemPrompt(context, 'advice') +
    '\n' +
    (focusInstructions[focus] || focusInstructions.general);

  const messages = [{ role: 'user', content: question || '请给我一些经营建议' }];

  if (stream) {
    return anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS_DEFAULT,
      system: systemPrompt,
      messages,
    });
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS_DEFAULT,
    system: systemPrompt,
    messages,
  });

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

module.exports = {
  queryData,
  generateReport,
  detectAnomalies,
  getAdvice,
  translateApiError,
};
