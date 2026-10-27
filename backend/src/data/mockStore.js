const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { clone, signState, encryptSensitiveState, decryptSensitiveState } = require('../shared/crypto');
const { buildDefaultState, defaultAdminPassword, defaultAdminHash } = require('../shared/seedData');

const now = () => new Date().toISOString();
const dataDir = process.env.MOCK_DATA_DIR
  ? path.resolve(process.env.MOCK_DATA_DIR)
  : path.resolve(__dirname, '../../data');
const storeFile = path.join(dataDir, 'mock-store.json');
const backupDir = path.join(dataDir, 'backups');
const backupSignKey = process.env.BACKUP_SIGN_KEY || process.env.JWT_SECRET || 'finance-backup-sign';
const secondaryBackupDir = process.env.SECONDARY_BACKUP_DIR
  ? path.resolve(process.env.SECONDARY_BACKUP_DIR)
  : '';

const sumBy = (items, key) =>
  (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item?.[key] || 0), 0);

const toCurrencyText = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0 });

// ---- 文件 I/O ----

const ensureDirs = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
};

const normalizeUsers = (users) => {
  if (!Array.isArray(users)) {
    return clone(buildDefaultState().users);
  }

  return users.map((user, index) => {
    const passwordHash =
      user.passwordHash || user.password_hash ||
      (user.password ? bcrypt.hashSync(user.password, 10) : index === 0 ? defaultAdminHash : null);
    return {
      id: user.id || index + 1,
      username: user.username,
      passwordHash,
      role: user.role || 'viewer',
      phone: user.phone || '',
      email: user.email || '',
      status: typeof user.status === 'number' ? user.status : 1,
      createdAt: user.createdAt || user.created_at || now(),
      lastLoginAt: user.lastLoginAt || user.last_login_at || null,
      passwordUpdatedAt: user.passwordUpdatedAt || user.password_updated_at || null,
      failedLoginAttempts: Number(user.failedLoginAttempts || user.failed_login_attempts || 0),
      lockedUntil: user.lockedUntil || user.locked_until || null,
    };
  });
};

const normalizeState = (raw) => {
  const base = buildDefaultState();
  const merged = {
    ...base,
    ...(raw || {}),
  };

  return {
    ...merged,
    users: normalizeUsers(merged.users),
    products: Array.isArray(merged.products) ? merged.products : [],
    customers: Array.isArray(merged.customers) ? merged.customers : [],
    suppliers: Array.isArray(merged.suppliers) ? merged.suppliers : [],
    sales: Array.isArray(merged.sales) ? merged.sales : [],
    purchases: Array.isArray(merged.purchases) ? merged.purchases : [],
    inventory: Array.isArray(merged.inventory) ? merged.inventory : [],
    accounts: Array.isArray(merged.accounts) ? merged.accounts : [],
    warehouses: Array.isArray(merged.warehouses) ? merged.warehouses : [],
    financeTransactions: Array.isArray(merged.financeTransactions) ? merged.financeTransactions : [],
    dataTasks: Array.isArray(merged.dataTasks) ? merged.dataTasks : clone(base.dataTasks),
    auditLogs: Array.isArray(merged.auditLogs) ? merged.auditLogs : [],
  };
};

const loadStateFromDisk = () => {
  try {
    ensureDirs();
    if (!fs.existsSync(storeFile)) {
      return buildDefaultState();
    }

    const raw = fs.readFileSync(storeFile, 'utf8');
    return normalizeState(decryptSensitiveState(JSON.parse(raw)));
  } catch (error) {
    console.error('加载本地数据失败，已回退默认数据:', error.message);
    return buildDefaultState();
  }
};

const state = loadStateFromDisk();

const persistState = () => {
  ensureDirs();
  const sanitized = normalizeState(state);
  const encrypted = encryptSensitiveState(sanitized);
  const tmpFile = `${storeFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(encrypted, null, 2), 'utf8');
  fs.renameSync(tmpFile, storeFile);
};

// ---- 资源映射 ----

const resourceMap = {
  products: 'products',
  customers: 'customers',
  suppliers: 'suppliers',
  sales: 'sales',
  purchases: 'purchases',
  inventory: 'inventory',
  accounts: 'accounts',
  warehouses: 'warehouses',
};

const getCollection = (name) => {
  const key = resourceMap[name] || name;
  if (!state[key]) {
    state[key] = [];
  }
  return state[key];
};

// ---- CRUD ----

const list = (name) => clone(getCollection(name));

const create = (name, payload) => {
  const collection = getCollection(name);
  const ts = now();
  const item = {
    id: collection.length ? Math.max(...collection.map((entry) => entry.id || 0)) + 1 : 1,
    ...payload,
    createdAt: payload.createdAt || ts,
    updatedAt: ts,
  };
  collection.unshift(item);
  persistState();
  return clone(item);
};

const update = (name, id, payload) => {
  const collection = getCollection(name);
  const index = collection.findIndex((entry) => String(entry.id) === String(id));

  if (index === -1) {
    return null;
  }

  collection[index] = {
    ...collection[index],
    ...payload,
    updatedAt: now(),
  };
  persistState();
  return clone(collection[index]);
};

const remove = (name, id) => {
  const collection = getCollection(name);
  const index = collection.findIndex((entry) => String(entry.id) === String(id));

  if (index === -1) {
    return false;
  }

  collection.splice(index, 1);
  persistState();
  return true;
};

// ---- 用户管理 ----

const findUserByUsername = (username) =>
  state.users.find((user) => user.username === username && user.status === 1) || null;

const findUserById = (id) => state.users.find((user) => String(user.id) === String(id)) || null;

const verifyUserPassword = async (user, plainPassword) => {
  if (!user?.passwordHash || !plainPassword) {
    return false;
  }
  return bcrypt.compare(plainPassword, user.passwordHash);
};

const createUser = (payload) => {
  const user = {
    id: state.users.length ? Math.max(...state.users.map((entry) => entry.id || 0)) + 1 : 1,
    status: 1,
    createdAt: now(),
    lastLoginAt: null,
    passwordUpdatedAt: now(),
    username: payload.username,
    passwordHash: bcrypt.hashSync(payload.password, 10),
    role: payload.role || 'viewer',
    phone: payload.phone || '',
    email: payload.email || '',
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  state.users.push(user);
  persistState();
  return clone(user);
};

const touchLastLogin = (id) => {
  const user = findUserById(id);
  if (user) {
    user.lastLoginAt = now();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    persistState();
  }
};

const isUsingDefaultAdminPassword = async (user, plainPassword) => {
  if (user?.username !== 'admin') {
    return false;
  }
  const defaultHashMatches = await bcrypt.compare(defaultAdminPassword, user.passwordHash || '');
  if (!defaultHashMatches) {
    return false;
  }
  return verifyUserPassword(user, plainPassword);
};

const changeUserPassword = async ({ userId, username, oldPassword, newPassword }) => {
  const user =
    typeof userId !== 'undefined' && userId !== null
      ? findUserById(userId)
      : findUserByUsername(username);

  if (!user || user.status !== 1) {
    return { ok: false, error: '用户不存在' };
  }

  const matched = await verifyUserPassword(user, oldPassword);
  if (!matched) {
    return { ok: false, error: '原密码错误' };
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordUpdatedAt = now();
  persistState();
  return { ok: true };
};

// ---- 财务管理 ----

const getFinanceSummary = () => {
  const receivable = sumBy(state.customers, 'balance');
  const payable = sumBy(state.suppliers, 'payable');
  const cashBalance = sumBy(state.accounts, 'balance');
  const received = sumBy(
    state.financeTransactions.filter((item) => item.type === 'received'),
    'amount'
  );
  const paid = sumBy(
    state.financeTransactions.filter((item) => item.type === 'paid'),
    'amount'
  );

  return {
    receivable,
    payable,
    cashBalance,
    monthlyProfit: received - paid,
    transactions: clone(state.financeTransactions),
  };
};

const addFinanceTransaction = (type, payload) => {
  const transaction = {
    id: state.financeTransactions.length
      ? Math.max(...state.financeTransactions.map((entry) => entry.id || 0)) + 1
      : 1,
    type,
    date: payload.date || new Date().toISOString().slice(0, 10),
    ...payload,
  };
  state.financeTransactions.unshift(transaction);
  persistState();
  return clone(transaction);
};

// ---- 报表 ----

const getReportSummary = () => {
  const completedSales = state.sales.filter((s) => s.status === '已完成').length;
  const totalSales = state.sales.length;
  const receivedAmount = sumBy(
    state.financeTransactions.filter((t) => t.type === 'received'),
    'amount'
  );
  const paidAmount = sumBy(
    state.financeTransactions.filter((t) => t.type === 'paid'),
    'amount'
  );
  const totalStock = sumBy(state.inventory, 'quantity');
  const aLevelCustomers = state.customers.filter((c) => c.level === 'A').length;

  return {
    cards: [
      {
        key: 'sales',
        title: '累计销售额',
        value: toCurrencyText(sumBy(state.sales, 'amount')),
        trend: `${totalSales} 笔订单 · ${completedSales} 笔已完成`,
      },
      {
        key: 'profit',
        title: '累计利润',
        value: toCurrencyText(getFinanceSummary().monthlyProfit),
        trend: `收 ${toCurrencyText(receivedAmount)} · 支 ${toCurrencyText(paidAmount)}`,
      },
      {
        key: 'stock',
        title: '库存件数',
        value: String(totalStock),
        trend: `${state.products.length} 种商品`,
      },
      {
        key: 'customers',
        title: '客户总数',
        value: String(state.customers.length),
        trend: `${aLevelCustomers} 家A级客户`,
      },
    ],
    topProducts: clone(state.products).slice(0, 5),
  };
};

// ---- 系统 ----

const getSystemInfo = () => ({
  appName: 'Lutra 财务管理系统',
  mode: 'production',
  version: '1.0.9',
  features: ['正式版数据存储', '账号鉴权', '本地备份恢复', '操作审计'],
});

const getDataTasks = () => clone(state.dataTasks);

// ---- 备份 ----

const listBackups = () => {
  ensureDirs();
  return fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const fullPath = path.join(backupDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        fileName: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

const createBackup = (operator = 'system') => {
  ensureDirs();
  const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fullPath = path.join(backupDir, fileName);
  const stateClone = encryptSensitiveState(clone(state));
  const signature = signState(stateClone);
  const content = {
    meta: {
      createdAt: now(),
      operator,
      version: '1.0.9',
      signature,
    },
    state: stateClone,
  };
  fs.writeFileSync(fullPath, JSON.stringify(content, null, 2), 'utf8');
  let secondaryFullPath = '';
  if (secondaryBackupDir) {
    if (!fs.existsSync(secondaryBackupDir)) {
      fs.mkdirSync(secondaryBackupDir, { recursive: true });
    }
    secondaryFullPath = path.join(secondaryBackupDir, fileName);
    fs.copyFileSync(fullPath, secondaryFullPath);
  }
  return {
    fileName,
    fullPath,
    secondaryFullPath,
  };
};

const restoreBackup = (fileName) => {
  ensureDirs();
  const safeName = path.basename(fileName || '');
  const fullPath = path.join(backupDir, safeName);
  if (!safeName || !safeName.endsWith('.json') || !fs.existsSync(fullPath)) {
    return { ok: false, error: '备份文件不存在' };
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = JSON.parse(raw);
    const nextState = parsed?.state;
    const backupSignature = parsed?.meta?.signature;

    if (!nextState || !Array.isArray(nextState.users)) {
      return { ok: false, error: '备份文件格式无效' };
    }
    if (!backupSignature || signState(nextState) !== backupSignature) {
      return { ok: false, error: '备份签名校验失败，文件可能被篡改' };
    }

    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, normalizeState(decryptSensitiveState(nextState)));

    persistState();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `恢复失败: ${error.message}` };
  }
};

// ---- 审计 ----

const appendAuditLog = (entry) => {
  const item = {
    id: state.auditLogs.length ? Math.max(...state.auditLogs.map((log) => log.id || 0)) + 1 : 1,
    createdAt: now(),
    ...entry,
  };
  state.auditLogs.unshift(item);
  state.auditLogs = state.auditLogs.slice(0, 2000);
  persistState();
  return clone(item);
};

const listAuditLogs = (limit = 200) => clone(state.auditLogs.slice(0, limit));

module.exports = {
  list,
  create,
  update,
  remove,
  findUserByUsername,
  findUserById,
  verifyUserPassword,
  createUser,
  touchLastLogin,
  getFinanceSummary,
  addFinanceTransaction,
  getReportSummary,
  getSystemInfo,
  getDataTasks,
  isUsingDefaultAdminPassword,
  changeUserPassword,
  listBackups,
  createBackup,
  restoreBackup,
  appendAuditLog,
  listAuditLogs,
};
