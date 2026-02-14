// src/api/http.ts
// 不使用外部JWT库，改为内置的crypto API
import { compareSync, hashSync } from 'bcrypt-edge';

// 定义D1数据库类型
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
}

// 定义环境变量接口
interface Env {
  DB: D1Database;
  AUTH_ENABLED?: string; // 是否启用身份验证
  AUTH_USERNAME?: string; // 认证用户名
  AUTH_PASSWORD?: string; // 认证密码哈希 (bcrypt)
  AUTH_SECRET?: string; // JWT密钥
}

// 数据类型定义
export interface Group {
  id?: number;
  name: string;
  order_num: number;
  is_public?: number; // 0 = 私密（仅管理员可见），1 = 公开（访客可见）
  user_id?: number; // 新增归属用户ID
  created_at?: string;
  updated_at?: string;
}

export interface Site {
  id?: number;
  group_id: number;
  name: string;
  url: string;
  icon: string;
  description: string;
  notes: string;
  order_num: number;
  is_public?: number; // 0 = 私密（仅管理员可见），1 = 公开（访客可见）
  created_at?: string;
  updated_at?: string;
  is_deleted?: number;
  deleted_at?: string;
}

// 分组及其站点 (用于优化 N+1 查询)
export interface GroupWithSites extends Group {
  id: number; // 确保 id 存在
  sites: Site[];
}

// 新增配置接口
export interface Config {
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

// 扩展导出数据接口，添加导入结果类型
export interface ExportData {
  groups: Group[];
  sites: Site[];
  configs: Record<string, string>;
  version: string;
  exportDate: string;
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  stats?: {
    groups: {
      total: number;
      created: number;
      merged: number;
    };
    sites: {
      total: number;
      created: number;
      updated: number;
      skipped: number;
    };
  };
  error?: string;
}

// 新增用户登录接口
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean; // 新增记住我选项
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  message?: string;
}

// 注册接口
export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
}

// 密码重置接口
export interface ResetPasswordRequest {
  username: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message?: string;
}

// API 类
export class NavigationAPI {
  private db: D1Database;
  private authEnabled: boolean;
  private username: string;
  private passwordHash: string; // 存储bcrypt哈希而非明文密码
  private secret: string;

  constructor(env: Env) {
    this.db = env.DB;
    this.authEnabled = env.AUTH_ENABLED === 'true';
    this.username = env.AUTH_USERNAME || '';
    this.passwordHash = env.AUTH_PASSWORD || ''; // 现在存储的是哈希
    this.secret = env.AUTH_SECRET || 'DefaultSecretKey';
  }

  // 初始化数据库表
  // 修改initDB方法，将SQL语句分开执行
  async initDB(): Promise<{ success: boolean; alreadyInitialized: boolean }> {
    // 尝试自动修复缺失的字段 (即使已初始化也尝试执行，以修复旧版本数据库)
    try {
      await this.db.exec('ALTER TABLE groups ADD COLUMN is_public INTEGER DEFAULT 1;');
    } catch { }
    try {
      await this.db.exec('ALTER TABLE sites ADD COLUMN is_public INTEGER DEFAULT 1;');
    } catch { }
    try {
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_sites_is_public ON sites(is_public);');
    } catch { }

    // 迁移：groups 表添加 user_id 字段
    try {
      await this.db.exec('ALTER TABLE groups ADD COLUMN user_id INTEGER DEFAULT 1;'); // 默认为 admin(1)
    } catch { }
    try {
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);');
    } catch { }

    // 迁移：groups 表添加 user_id 字段
    try {
      await this.db.exec('ALTER TABLE groups ADD COLUMN user_id INTEGER DEFAULT 1;'); // 默认为 admin(1)
    } catch { }
    try {
      await this.db.exec('CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);');
    } catch { }

    // 创建 users 表（即使已初始化也尝试创建，以支持旧版本升级）
    try {
      await this.db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT DEFAULT \'user\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');
    } catch { }

    // 迁移环境变量中的管理员到 users 表
    try {
      if (this.username && this.passwordHash) {
        const existingAdmin = await this.db
          .prepare('SELECT id FROM users WHERE username = ?')
          .bind(this.username)
          .first();
        if (!existingAdmin) {
          await this.db
            .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
            .bind(this.username, this.passwordHash, 'admin')
            .run();
        }
      }
    } catch { }

    // 首先检查数据库是否已初始化
    // 即使已初始化，我们也继续检查是否需要迁移或补充数据 (CREATE TABLE IF NOT EXISTS 是安全的)
    try {
      /* 移除旧的提前返回逻辑，确保新功能（如数据初始化）能执行
      const isInitialized = await this.getConfig('DB_INITIALIZED');
      if (isInitialized === 'true') {
        return { success: true, alreadyInitialized: true };
      }
      */
    } catch { }

    // 先创建groups表
    await this.db.exec(
      `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, order_num INTEGER NOT NULL, is_public INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`
    );

    // 再创建sites表
    await this.db.exec(
      `CREATE TABLE IF NOT EXISTS sites (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, url TEXT NOT NULL, icon TEXT, description TEXT, notes TEXT, order_num INTEGER NOT NULL, is_public INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE);`
    );

    // 创建全局配置表
    await this.db.exec('CREATE TABLE IF NOT EXISTS configs (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');

    // 数据库迁移：添加 user_id 到 groups 表
    try {
      await this.db.exec("ALTER TABLE groups ADD COLUMN user_id INTEGER DEFAULT 1");
      console.log('Migrated: Added user_id to groups table');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }

    // 初始化默认数据 (仅当从未初始化数据时)
    try {
      const isDataInitialized = await this.getConfig('DATA_INITIALIZED');
      if (isDataInitialized !== 'true') {
        console.log('Initializing default data...');

        // 1. 插入默认分组 (User ID 1 = Admin)
        await this.db.prepare(
          `INSERT INTO groups (name, order_num, is_public, user_id) VALUES 
           ('常用工具', 1, 1, 1),
           ('开发社区', 2, 1, 1)
           RETURNING id`
        ).run();

        // 由于 D1 批量插入返回 ID 可能有限制，简单起见我们假设 ID 是连续的 (或查询获取)
        // 这里为了稳健，分别插入

        // 重新查询刚才插入的分组 ID
        const toolsGroup = await this.db.prepare("SELECT id FROM groups WHERE name = '常用工具' ORDER BY id DESC LIMIT 1").first<{ id: number }>();
        const devGroup = await this.db.prepare("SELECT id FROM groups WHERE name = '开发社区' ORDER BY id DESC LIMIT 1").first<{ id: number }>();

        if (toolsGroup && devGroup) {
          // 2. 插入默认站点
          await this.db.prepare(`
             INSERT INTO sites (group_id, name, url, icon, description, order_num, is_public) VALUES 
             (?, 'Google', 'https://www.google.com', 'https://www.google.com/favicon.ico', '全球最大的搜索引擎', 1, 1),
             (?, 'GitHub', 'https://github.com', 'https://github.com/favicon.ico', '代码托管平台', 2, 1),
             (?, 'ChatGPT', 'https://chat.openai.com', 'https://chat.openai.com/favicon.ico', 'AI 助手', 3, 1)
           `).bind(toolsGroup.id, toolsGroup.id, toolsGroup.id).run();

          await this.db.prepare(`
             INSERT INTO sites (group_id, name, url, icon, description, order_num, is_public) VALUES 
             (?, 'Stack Overflow', 'https://stackoverflow.com', 'https://www.google.com/s2/favicons?domain=stackoverflow.com&sz=64', '开发者问答社区', 1, 1),
             (?, 'MDN Web Docs', 'https://developer.mozilla.org', 'https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=64', 'Web 开发文档', 2, 1),
             (?, 'V2EX', 'https://www.v2ex.com', 'https://www.google.com/s2/favicons?domain=v2ex.com&sz=64', '创意工作者社区', 3, 1)
           `).bind(devGroup.id, devGroup.id, devGroup.id).run();
        }

        await this.setConfig('DATA_INITIALIZED', 'true');
        console.log('Default data initialized.');
      }
    } catch (e) {
      console.error('Failed to initialize default data:', e);
    }

    // 设置 DB 初始化标志
    await this.setConfig('DB_INITIALIZED', 'true');

    return { success: true, alreadyInitialized: false };
  }

  // 验证用户登录
  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    // 如果未启用身份验证，直接返回成功
    if (!this.authEnabled) {
      return {
        success: true,
        token: await this.generateToken({ username: 'guest' }, false),
        message: '身份验证未启用，默认登录成功',
      };
    }

    // 优先从 users 表查询用户
    try {
      const user = await this.db
        .prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?')
        .bind(loginRequest.username)
        .first<{ id: number; username: string; password_hash: string; role: string }>();

      if (user) {
        const isPasswordValid = compareSync(loginRequest.password, user.password_hash);
        if (isPasswordValid) {
          const token = await this.generateToken(
            { id: user.id, username: user.username, role: user.role },
            loginRequest.rememberMe || false
          );
          return { success: true, token, message: '登录成功' };
        }
        return { success: false, message: '用户名或密码错误' };
      }
    } catch {
      // users 表可能不存在（旧版数据库），回退到环境变量认证
    }

    // 回退：使用环境变量中的管理员账号（兼容旧版）
    if (loginRequest.username !== this.username) {
      return { success: false, message: '用户名或密码错误' };
    }

    const isPasswordValid = compareSync(loginRequest.password, this.passwordHash);
    if (isPasswordValid) {
      const token = await this.generateToken(
        { id: 1, username: loginRequest.username, role: 'admin' }, // 默认管理员 ID 为 1
        loginRequest.rememberMe || false
      );
      return { success: true, token, message: '登录成功' };
    }

    return { success: false, message: '用户名或密码错误' };
  }

  // 注册新用户
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    try {
      // 检查用户名是否已存在
      const existing = await this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(request.username)
        .first();

      if (existing) {
        return { success: false, message: '用户名已存在' };
      }

      // bcrypt 哈希密码
      const passwordHash = hashSync(request.password, 10);

      // 插入新用户
      await this.db
        .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
        .bind(request.username, passwordHash, 'user')
        .run();

      return { success: true, message: '注册成功' };
    } catch (error) {
      console.error('注册失败:', error);
      return { success: false, message: '注册失败，请稍后重试' };
    }
  }

  // 重置密码
  async resetPassword(request: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    try {
      // 查找用户
      const user = await this.db
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(request.username)
        .first<{ id: number }>();

      if (!user) {
        // 也检查环境变量中的管理员
        if (request.username === this.username) {
          // 更新环境变量管理员的密码 —— 需要将其迁移到 users 表
          const passwordHash = hashSync(request.newPassword, 10);
          await this.db
            .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash = ?, updated_at = CURRENT_TIMESTAMP')
            .bind(request.username, passwordHash, 'admin', passwordHash)
            .run();
          return { success: true, message: '密码重置成功' };
        }
        return { success: false, message: '用户名不存在' };
      }

      // 更新密码
      const passwordHash = hashSync(request.newPassword, 10);
      await this.db
        .prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind(passwordHash, user.id)
        .run();

      return { success: true, message: '密码重置成功' };
    } catch (error) {
      console.error('密码重置失败:', error);
      return { success: false, message: '密码重置失败，请稍后重试' };
    }
  }

  // 验证令牌有效性
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
    if (!this.authEnabled) {
      return { valid: true };
    }

    try {
      // 解析JWT
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false };
      }

      const [encodedHeader, encodedPayload, signature] = parts;

      // Validate all parts exist
      if (!encodedHeader || !encodedPayload || !signature) {
        return { valid: false };
      }

      // 重新生成签名进行验证
      const encoder = new TextEncoder();
      const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
      const keyData = encoder.encode(this.secret);

      // 导入密钥
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      // 解码签名
      const signatureBytes = this.base64UrlDecode(signature);

      // 验证签名
      const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, data);

      if (!isValid) {
        return { valid: false };
      }

      // 解码并验证 payload
      const payloadStr = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadStr) as Record<string, unknown>;

      // 检查过期时间
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && typeof payload.exp === 'number' && payload.exp < now) {
        return { valid: false };
      }

      return { valid: true, payload };
    } catch (error) {
      console.error('Token验证失败:', error);
      return { valid: false };
    }
  }

  // 生成JWT令牌
  private async generateToken(
    payload: Record<string, unknown>,
    rememberMe: boolean = false
  ): Promise<string> {
    // 准备payload
    const expiresIn = rememberMe
      ? 30 * 24 * 60 * 60 // 30天 (一个月)
      : 24 * 60 * 60; // 24小时

    const tokenPayload = {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      iat: Math.floor(Date.now() / 1000),
    };

    // 创建Header和Payload部分
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(tokenPayload));

    // 使用 Web Crypto API 进行 HMAC-SHA256 签名
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const keyData = encoder.encode(this.secret);

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // 生成签名
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
    const signature = this.base64UrlEncode(signatureBuffer);

    // 组合JWT
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // 辅助方法：base64url 编码（支持字符串和 ArrayBuffer）
  private base64UrlEncode(data: string | ArrayBuffer): string {
    let base64: string;

    if (typeof data === 'string') {
      base64 = btoa(data);
    } else {
      // ArrayBuffer 转 base64
      const bytes = new Uint8Array(data);
      const binary = Array.from(bytes)
        .map((byte) => String.fromCharCode(byte))
        .join('');
      base64 = btoa(binary);
    }

    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // 辅助方法：base64url 解码为 ArrayBuffer
  private base64UrlDecode(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // 检查认证是否启用
  isAuthEnabled(): boolean {
    return this.authEnabled;
  }

  // 分组相关 API
  // 获取所有分组
  async getGroups(userId?: number): Promise<Group[]> {
    let query = 'SELECT * FROM groups';
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY order_num ASC';

    const result = await this.db.prepare(query).bind(...params).all<Group>();
    return result.results || [];
  }

  async getGroup(id: number): Promise<Group | null> {
    const result = await this.db
      .prepare('SELECT id, name, order_num, created_at, updated_at FROM groups WHERE id = ?')
      .bind(id)
      .first<Group>();
    return result;
  }

  async createGroup(group: Group, userId?: number): Promise<Group> {
    const finalUserId = userId || 1; // 默认为 admin
    const result = await this.db
      .prepare(
        'INSERT INTO groups (name, order_num, is_public, user_id) VALUES (?, ?, ?, ?) RETURNING id, name, order_num, is_public, user_id, created_at, updated_at'
      )
      .bind(group.name, group.order_num, group.is_public ?? 1, finalUserId)
      .all<Group>();
    if (!result.results || result.results.length === 0) {
      throw new Error('创建分组失败');
    }
    const createdGroup = result.results[0];
    if (!createdGroup) {
      throw new Error('创建分组失败');
    }
    return createdGroup;
  }

  async updateGroup(id: number, group: Partial<Group>): Promise<Group | null> {
    // 字段白名单
    const ALLOWED_FIELDS = ['name', 'order_num', 'is_public'] as const;
    type AllowedField = (typeof ALLOWED_FIELDS)[number];

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    // 只允许更新白名单中的字段
    Object.entries(group).forEach(([key, value]) => {
      if (ALLOWED_FIELDS.includes(key as AllowedField) && value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        console.warn(`尝试更新不允许的字段: ${key}`);
      }
    });

    if (updates.length === 1) {
      // 只有 updated_at，没有实际更新
      throw new Error('没有可更新的字段');
    }

    // 构建安全的参数化查询
    const query = `UPDATE groups SET ${updates.join(
      ', '
    )} WHERE id = ? RETURNING id, name, order_num, created_at, updated_at`;
    params.push(id);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Group>();

    if (!result.results || result.results.length === 0) {
      return null;
    }
    const updatedGroup = result.results[0];
    return updatedGroup || null;
  }

  async deleteGroup(id: number): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
    return result.success;
  }

  // 网站相关 API
  async getSites(groupId?: number): Promise<Site[]> {
    let query =
      'SELECT id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at FROM sites WHERE (is_deleted = 0 OR is_deleted IS NULL)';
    const params: (string | number)[] = [];

    if (groupId !== undefined) {
      query += ' AND group_id = ?';
      params.push(groupId);
    }

    query += ' ORDER BY order_num';

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Site>();
    return result.results || [];
  }

  /**
   * 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
   * 返回格式: GroupWithSites[] (每个分组包含其站点数组)
   */
  // 获取所有分组及其站点 (使用 JOIN 优化,避免 N+1 查询)
  async getGroupsWithSites(userId?: number): Promise<GroupWithSites[]> {
    // 使用 LEFT JOIN 一次性获取所有数据
    let query = `
      SELECT
        g.id as group_id,
        g.name as group_name,
        g.order_num as group_order,
        g.is_public as group_is_public,
        g.created_at as group_created_at,
        g.updated_at as group_updated_at,
        s.id as site_id,
        s.name as site_name,
        s.url as site_url,
        s.icon as site_icon,
        s.description as site_description,
        s.notes as site_notes,
        s.order_num as site_order,
        s.is_public as site_is_public,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at
      FROM groups g
      LEFT JOIN sites s ON g.id = s.group_id AND (s.is_deleted = 0 OR s.is_deleted IS NULL)
    `;

    const params: any[] = [];
    if (userId !== undefined) {
      query += ' WHERE g.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY g.order_num ASC, s.order_num ASC';

    const result = await this.db.prepare(query).bind(...params).all<{
      group_id: number;
      group_name: string;
      group_order: number;
      group_is_public?: number;
      group_created_at: string;
      group_updated_at: string;
      site_id: number | null;
      site_name: string | null;
      site_url: string | null;
      site_icon: string | null;
      site_description: string | null;
      site_notes: string | null;
      site_order: number | null;
      site_is_public?: number;
      site_created_at: string | null;
      site_updated_at: string | null;
    }>();

    // 将查询结果转换为 GroupWithSites 格式
    const groupsMap = new Map<number, GroupWithSites>();

    for (const row of result.results || []) {
      // 如果分组不存在,创建它
      if (!groupsMap.has(row.group_id)) {
        groupsMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          order_num: row.group_order,
          is_public: row.group_is_public,
          created_at: row.group_created_at,
          updated_at: row.group_updated_at,
          sites: [],
        });
      }

      // 如果有站点数据,添加到分组的 sites 数组
      if (row.site_id !== null) {
        const group = groupsMap.get(row.group_id)!;
        group.sites.push({
          id: row.site_id,
          group_id: row.group_id,
          name: row.site_name!,
          url: row.site_url!,
          icon: row.site_icon || '',
          description: row.site_description || '',
          notes: row.site_notes || '',
          order_num: row.site_order!,
          is_public: row.site_is_public,
          created_at: row.site_created_at!,
          updated_at: row.site_updated_at!,
        });
      }
    }

    return Array.from(groupsMap.values());
  }

  // 随机获取站点（访客模式）
  async getRandomSites(limit: number = 20): Promise<{
    site: Site;
    groupName: string;
    ownerName: string;
  }[]> {
    // 确保 groups 和 sites 都是公开的
    const query = `
      SELECT 
        s.id as site_id,
        s.group_id,
        s.name as site_name,
        s.url as site_url,
        s.icon as site_icon,
        s.description as site_description,
        s.notes as site_notes,
        s.order_num as site_order,
        s.is_public as site_is_public,
        s.created_at as site_created_at,
        s.updated_at as site_updated_at,
        g.name as group_name,
        u.username as owner_name
      FROM sites s
      JOIN groups g ON s.group_id = g.id
      JOIN users u ON g.user_id = u.id
      WHERE s.is_public = 1 AND g.is_public = 1
      ORDER BY RANDOM()
      LIMIT ?
    `;

    const result = await this.db.prepare(query).bind(limit).all<{
      site_id: number;
      group_id: number;
      site_name: string;
      site_url: string;
      site_icon: string;
      site_description: string;
      site_notes: string;
      site_order: number;
      site_is_public: number;
      site_created_at: string;
      site_updated_at: string;
      group_name: string;
      owner_name: string;
    }>();

    return (result.results || []).map(row => ({
      site: {
        id: row.site_id,
        group_id: row.group_id,
        name: row.site_name,
        url: row.site_url,
        icon: row.site_icon,
        description: row.site_description,
        notes: row.site_notes,
        order_num: row.site_order,
        is_public: row.site_is_public,
        created_at: row.site_created_at,
        updated_at: row.site_updated_at
      },
      groupName: row.group_name,
      ownerName: row.owner_name
    }));
  }

  async getSite(id: number): Promise<Site | null> {
    const result = await this.db
      .prepare(
        'SELECT id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at FROM sites WHERE id = ?'
      )
      .bind(id)
      .first<Site>();
    return result;
  }

  async createSite(site: Site): Promise<Site> {
    const result = await this.db
      .prepare(
        `
      INSERT INTO sites (group_id, name, url, icon, description, notes, order_num, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id, group_id, name, url, icon, description, notes, order_num, is_public, created_at, updated_at
    `
      )
      .bind(
        site.group_id,
        site.name,
        site.url,
        site.icon || '',
        site.description || '',
        site.notes || '',
        site.order_num,
        site.is_public ?? 1
      )
      .all<Site>();

    if (!result.results || result.results.length === 0) {
      throw new Error('创建站点失败');
    }
    const createdSite = result.results[0];
    if (!createdSite) {
      throw new Error('创建站点失败');
    }
    return createdSite;
  }

  async updateSite(id: number, site: Partial<Site>): Promise<Site | null> {
    // 字段白名单
    const ALLOWED_FIELDS = [
      'group_id',
      'name',
      'url',
      'icon',
      'description',
      'notes',
      'order_num',
      'is_public',
    ] as const;
    type AllowedField = (typeof ALLOWED_FIELDS)[number];

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    // 只允许更新白名单中的字段
    Object.entries(site).forEach(([key, value]) => {
      if (ALLOWED_FIELDS.includes(key as AllowedField) && value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      } else if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
        console.warn(`尝试更新不允许的字段: ${key}`);
      }
    });

    if (updates.length === 1) {
      // 只有 updated_at，没有实际更新
      throw new Error('没有可更新的字段');
    }

    // 构建安全的参数化查询
    const query = `UPDATE sites SET ${updates.join(
      ', '
    )} WHERE id = ? RETURNING id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at`;
    params.push(id);

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<Site>();

    if (!result.results || result.results.length === 0) {
      return null;
    }
    const updatedSite = result.results[0];
    return updatedSite || null;
  }

  async deleteSite(id: number): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    return result.success;
  }

  // Soft delete site
  async softDeleteSite(id: number): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE sites SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  // Restore site
  async restoreSite(id: number): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE sites SET is_deleted = 0, deleted_at = NULL WHERE id = ?')
      .bind(id)
      .run();
    return result.success;
  }

  // Get trash sites
  async getTrashSites(userId?: number): Promise<Site[]> {
    let query = `
      SELECT s.id, s.group_id, s.name, s.url, s.icon, s.description, s.notes, s.order_num, s.created_at, s.updated_at, s.deleted_at 
      FROM sites s
      JOIN groups g ON s.group_id = g.id
      WHERE s.is_deleted = 1
    `;
    const params: any[] = [];

    if (userId !== undefined) {
      query += ' AND g.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY s.deleted_at DESC';

    const result = await this.db.prepare(query).bind(...params).all<Site>();
    return result.results || [];
  }

  // 配置相关API
  async getConfigs(): Promise<Record<string, string>> {
    const result = await this.db.prepare('SELECT key, value FROM configs').all<Config>();

    // 将结果转换为键值对对象
    const configs: Record<string, string> = {};
    for (const config of result.results || []) {
      configs[config.key] = config.value;
    }

    return configs;
  }

  async getConfig(key: string): Promise<string | null> {
    const result = await this.db
      .prepare('SELECT value FROM configs WHERE key = ?')
      .bind(key)
      .first<{ value: string }>();

    return result ? result.value : null;
  }

  async setConfig(key: string, value: string): Promise<boolean> {
    try {
      // 使用UPSERT语法（SQLite支持）
      const result = await this.db
        .prepare(
          `INSERT INTO configs (key, value, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP) 
                    ON CONFLICT(key) 
                    DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`
        )
        .bind(key, value, value)
        .run();

      return result.success;
    } catch (error) {
      console.error('设置配置失败:', error);
      return false;
    }
  }

  async deleteConfig(key: string): Promise<boolean> {
    const result = await this.db.prepare('DELETE FROM configs WHERE key = ?').bind(key).run();

    return result.success;
  }

  // 批量更新排序
  async updateGroupOrder(groupOrders: { id: number; order_num: number }[]): Promise<boolean> {
    // 使用事务确保所有更新一起成功或失败
    return await this.db
      .batch(
        groupOrders.map((item) =>
          this.db
            .prepare('UPDATE groups SET order_num = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(item.order_num, item.id)
        )
      )
      .then(() => true)
      .catch(() => false);
  }

  async updateSiteOrder(siteOrders: { id: number; order_num: number }[]): Promise<boolean> {
    // 使用事务确保所有更新一起成功或失败
    return await this.db
      .batch(
        siteOrders.map((item) =>
          this.db
            .prepare('UPDATE sites SET order_num = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(item.order_num, item.id)
        )
      )
      .then(() => true)
      .catch(() => false);
  }

  // 导出所有数据
  async exportData(): Promise<ExportData> {
    // 获取所有分组
    const groups = await this.getGroups();

    // 获取所有站点
    const sites = await this.getSites();

    // 获取所有配置
    const configs = await this.getConfigs();

    return {
      groups,
      sites,
      configs,
      version: '1.0', // 数据版本号，便于后续兼容性处理
      exportDate: new Date().toISOString(),
    };
  }

  // 导入所有数据
  async importData(data: ExportData): Promise<ImportResult> {
    try {
      // 创建新旧分组ID的映射
      const groupMap = new Map<number, number>();

      // 统计信息
      const stats = {
        groups: {
          total: data.groups.length,
          created: 0,
          merged: 0,
        },
        sites: {
          total: data.sites.length,
          created: 0,
          updated: 0,
          skipped: 0,
        },
      };

      // 导入分组数据
      for (const group of data.groups) {
        // 检查是否已存在同名分组
        const existingGroup = await this.getGroupByName(group.name);

        if (existingGroup) {
          // 如果存在同名分组，使用现有分组ID
          if (group.id) {
            groupMap.set(group.id, existingGroup.id as number);
          }

          // 可选：更新分组顺序（如果需要）
          // 此处可以决定是否需要更新现有分组的order_num
          // 如果需要，可以执行：
          // await this.updateGroup(existingGroup.id as number, { order_num: group.order_num });

          stats.groups.merged++;
        } else {
          // 如果不存在同名分组，创建新分组
          const newGroup = await this.createGroup({
            name: group.name,
            order_num: group.order_num,
          });

          // 添加到映射
          if (group.id && newGroup.id) {
            groupMap.set(group.id, newGroup.id);
          }

          stats.groups.created++;
        }
      }

      // 导入站点数据，更新分组ID
      for (const site of data.sites) {
        // 获取新的分组ID
        const newGroupId = groupMap.get(site.group_id);

        // 如果没有映射到新ID（可能是因为分组被过滤掉），则跳过该站点
        if (!newGroupId) {
          console.warn(`无法为站点"${site.name}"找到对应的分组ID，已跳过`);
          stats.sites.skipped++;
          continue;
        }

        // 检查该分组下是否已存在相同URL的站点
        const existingSite = await this.getSiteByGroupIdAndUrl(newGroupId, site.url);

        if (existingSite) {
          // 如果存在相同URL的站点，可以选择更新或跳过
          // 这里选择更新站点信息（名称、图标、描述等）
          await this.updateSite(existingSite.id as number, {
            name: site.name,
            icon: site.icon,
            description: site.description,
            notes: site.notes,
            // 不更新order_num以保持现有排序
          });

          stats.sites.updated++;
        } else {
          // 如果不存在相同URL的站点，创建新站点
          await this.createSite({
            ...site,
            id: undefined, // 不使用旧ID
            group_id: newGroupId,
          });

          stats.sites.created++;
        }
      }

      // 导入配置数据
      for (const [key, value] of Object.entries(data.configs)) {
        if (key !== 'DB_INITIALIZED') {
          // 跳过数据库初始化标志
          await this.setConfig(key, value);
        }
      }

      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('导入数据失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // 根据名称查询分组
  async getGroupByName(name: string): Promise<Group | null> {
    const result = await this.db
      .prepare('SELECT id, name, order_num, created_at, updated_at FROM groups WHERE name = ?')
      .bind(name)
      .first<Group>();
    return result;
  }

  // 查询特定分组下是否已存在指定URL的站点
  async getSiteByGroupIdAndUrl(groupId: number, url: string): Promise<Site | null> {
    const result = await this.db
      .prepare(
        'SELECT id, group_id, name, url, icon, description, notes, order_num, created_at, updated_at FROM sites WHERE group_id = ? AND url = ?'
      )
      .bind(groupId, url)
      .first<Site>();
    return result;
  }
}

// 创建 API 辅助函数
export function createAPI(env: Env): NavigationAPI {
  return new NavigationAPI(env);
}
