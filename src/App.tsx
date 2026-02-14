import { useState, useEffect, useMemo } from 'react';
import { NavigationClient } from './API/client';
import { MockNavigationClient } from './API/mock';
import { Site, Group } from './API/http';
import { GroupWithSites } from './types';
import ThemeToggle from './components/ThemeToggle';
import GroupCard from './components/GroupCard';
import SiteCard from './components/SiteCard';
import LoginForm from './components/LoginForm';
import VisitorHome from './components/VisitorHome';
import UserAvatar from './components/UserAvatar';
import SearchBox from './components/SearchBox';
import AIChatPanel from './components/AIChatPanel';
import { sanitizeCSS, isSecureUrl, extractDomain } from './utils/url';
import { SearchResultItem } from './utils/search';
import './App.css';

// 缓存相关的常量和辅助函数
const CACHE_CONFIG_KEY = 'nav_configs_cache';
const CACHE_DATA_KEY = 'nav_data_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

const saveToCache = (key: string, data: any) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('保存缓存失败:', e);
  }
};

const loadFromCache = (key: string) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { timestamp, data } = JSON.parse(cached);
    // 检查是否过期
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('尝试加载缓存失败:', e);
    return null;
  }
};

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableGroupItem from './components/SortableGroupItem';
import PageSkeleton from './components/LoadingSkeleton';
// Material UI 导入
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stack,
  createTheme,
  ThemeProvider,
  CssBaseline,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,

  Snackbar,
  InputAdornment,
  Slider,
  FormControlLabel,
  Switch,
  Fab,
  Zoom,
  Fade,
  useScrollTrigger,
} from '@mui/material';


import CancelIcon from '@mui/icons-material/Cancel';
import GitHubIcon from '@mui/icons-material/GitHub';
import CloseIcon from '@mui/icons-material/Close';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

// 根据环境选择使用真实API还是模拟API
// @cloudflare/vite-plugin 在 npm run dev 时自动代理 Worker + 本地 D1
// 设置 VITE_USE_MOCK=true 可以回退到 mock 模式
const useMockApi = import.meta.env.VITE_USE_MOCK === 'true';

const api = useMockApi
  ? new MockNavigationClient()
  : new NavigationClient('/api');

// 排序模式枚举
enum SortMode {
  None, // 不排序
  GroupSort, // 分组排序
  SiteSort, // 站点排序
  CrossGroupDrag, // 跨分组拖动
}

// 默认配置
const DEFAULT_CONFIGS = {
  'site.title': '导航站',
  'site.name': '导航站',
  'site.customCss': '',
  'site.backgroundImage': '', // 背景图片URL
  'site.backgroundOpacity': '0.15', // 背景蒙版透明度
  'site.iconApi': 'https://www.faviconextractor.com/favicon/{domain}?larger=true', // 默认使用的API接口，带上 ?larger=true 参数可以获取最大尺寸的图标
  'site.searchBoxEnabled': 'true', // 是否启用搜索框
  'site.searchBoxGuestEnabled': 'true', // 访客是否可以使用搜索框
};

function ScrollTop(props: { children: React.ReactElement; window?: () => Window }) {
  const { children, window } = props;
  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (
      (event.target as HTMLDivElement).ownerDocument || document
    ).querySelector('#back-to-top-anchor');

    if (anchor) {
      anchor.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 96, right: 16, zIndex: 100 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

function App() {
  // 主题模式状态
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 创建Material UI主题
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
        },
      }),
    [darkMode]
  );

  // 切换主题的回调函数
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('theme', !darkMode ? 'dark' : 'light');
  };

  const [groups, setGroups] = useState<GroupWithSites[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(SortMode.None);
  const [currentSortingGroupId, setCurrentSortingGroupId] = useState<number | null>(null);

  // 新增认证状态
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [_isAuthRequired, setIsAuthRequired] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // 注册状态
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  // 密码重置状态
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState<string | null>(null);

  // 访问模式状态 (readonly: 访客模式, edit: 编辑模式)
  type ViewMode = 'readonly' | 'edit';
  const [viewMode, setViewMode] = useState<ViewMode>('readonly');

  // 配置状态
  const [configs, setConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);
  const [openConfig, setOpenConfig] = useState(false);
  const [tempConfigs, setTempConfigs] = useState<Record<string, string>>(DEFAULT_CONFIGS);

  // 渐进式加载状态：初始显示的分组数量
  const [visibleGroupsCount, setVisibleGroupsCount] = useState(5);

  // 登录界面状态
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // 配置传感器，支持鼠标、触摸和键盘操作
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // 降低激活阈值，使拖拽更敏感
        delay: 0, // 移除延迟
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100, // 降低触摸延迟
        tolerance: 3, // 降低容忍值
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 新增状态管理
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [openAddSite, setOpenAddSite] = useState(false);
  const [newGroup, setNewGroup] = useState<Partial<Group>>({
    name: '',
    order_num: 0,
    is_public: 1, // 默认为公开
  });
  const [newSite, setNewSite] = useState<Partial<Site>>({
    name: '',
    url: '',
    icon: '',
    description: '',
    notes: '',
    order_num: 0,
    group_id: 0,
    is_public: 1, // 默认为公开
  });

  // 新增导入对话框状态
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // 错误提示框状态
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('error');
  // 导入结果提示框状态
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importResultMessage, setImportResultMessage] = useState('');

  // 跨分组拖拽状态
  const [draggedSiteId, setDraggedSiteId] = useState<string | null>(null);
  const [activeSite, setActiveSite] = useState<Site | null>(null);
  const [dragStartGroupId, setDragStartGroupId] = useState<number | null>(null);

  // 菜单打开关闭
  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      // setIsAuthChecking(true); // 不再在这里设置，我们在 useEffect 开始时设置
      console.log('开始检查认证状态...');

      // 尝试进行API调用,检查是否需要认证
      const result = await api.checkAuthStatus();
      console.log('认证检查结果:', result);

      if (!result) {
        // 未认证，设置为访客模式
        console.log('未认证，设置访客模式');
        api.isAuthenticated = false; // 同步 API 客户端状态
        setIsAuthenticated(false);
        setIsAuthRequired(false);
        setViewMode('readonly');
      } else {
        // 已认证，设置为编辑模式
        api.isAuthenticated = true; // 同步 API 客户端状态
        setIsAuthenticated(true);
        setIsAuthRequired(false);
        setViewMode('edit');
        setUsername('admin');
      }

      // 统一在认证状态确定后加载业务数据
      await fetchData();

    } catch (error) {
      console.error('认证检查及数据加载流程失败:', error);
      setIsAuthenticated(false);
      setIsAuthRequired(false);
      setViewMode('readonly');

      // 容错处理：尝试加载公开数据
      await fetchData().catch(e => console.error('最终业务负载失败:', e));
    } finally {
      setIsAuthChecking(false);
      setLoading(false); // 确保 loading 也会关闭
    }
  };

  // 登录功能
  const handleLogin = async (username: string, password: string, rememberMe: boolean = false) => {
    try {
      setLoginLoading(true);
      setLoginError(null);

      // 调用登录接口
      const loginResponse = await api.login(username, password, rememberMe);

      if (loginResponse?.success) {
        // 登录成功，立即切换状态并关闭登录界面
        api.isAuthenticated = true; // 同步 API 客户端状态
        setIsAuthenticated(true);
        setIsAuthRequired(false);
        setViewMode('edit');
        setUsername(username);
        setIsLoginOpen(false);
        setLoginLoading(false);

        // 单独加载数据，失败不影响登录成功状态
        try {
          await fetchData();
          await fetchConfigs();
        } catch (dataError) {
          console.error('登录后加载数据失败:', dataError);
          // 不回滚认证状态，仅提示数据加载问题
        }
      } else {
        // 登录失败
        const message = loginResponse?.message || '用户名或密码错误';
        handleError(message);
        setLoginError(message);
        setIsAuthenticated(false);
        setViewMode('readonly');
      }
    } catch (error) {
      console.error('登录失败:', error);
      handleError('登录失败: ' + (error instanceof Error ? error.message : '未知错误'));
      setIsAuthenticated(false);
      setViewMode('readonly');
    } finally {
      setLoginLoading(false);
    }
  };

  // 注册功能
  const handleRegister = async (username: string, password: string, email: string) => {
    try {
      setRegisterLoading(true);
      setRegisterError(null);
      setRegisterSuccess(null);

      const result = await api.register(username, password, email);

      if (result?.success) {
        setRegisterSuccess(result.message || '注册成功，正在自动登录...');
        // 注册成功后自动登录
        setTimeout(() => {
          handleLogin(username, password, true);
        }, 500);
      } else {
        setRegisterError(result?.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      setRegisterError('注册失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setRegisterLoading(false);
    }
  };

  // 密码重置功能
  const handleResetPassword = async (username: string, newPassword: string, code: string) => {
    try {
      setResetPasswordLoading(true);
      setResetPasswordError(null);
      setResetPasswordSuccess(null);

      const result = await api.resetPassword(username, newPassword, code);

      if (result?.success) {
        setResetPasswordSuccess(result.message || '密码重置成功，请返回登录');
      } else {
        setResetPasswordError(result?.message || '密码重置失败');
      }
    } catch (error) {
      console.error('密码重置失败:', error);
      setResetPasswordError('密码重置失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // 发送重置验证码
  const handleSendCode = async (username: string, email: string) => {
    try {
      return await api.sendResetCode(username, email);
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, message: '请求失败，请稍后重试' };
    }
  };

  // 登出功能
  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setIsAuthRequired(false); // 允许继续以访客身份访问
    setViewMode('readonly'); // 切换到只读模式

    // 重新加载数据（仅公开内容）
    await fetchData();
    await fetchConfigs();


  };

  // 加载配置
  const fetchConfigs = async () => {
    // 1. 先尝试从缓存加载以快速响应
    const cachedConfigs = loadFromCache(CACHE_CONFIG_KEY);
    if (cachedConfigs) {
      setConfigs({ ...DEFAULT_CONFIGS, ...cachedConfigs });
      setTempConfigs({ ...DEFAULT_CONFIGS, ...cachedConfigs });
    }

    try {
      const configsData = await api.getConfigs();
      const finalConfigs = {
        ...DEFAULT_CONFIGS,
        ...configsData,
      };

      setConfigs(finalConfigs);
      setTempConfigs(finalConfigs);

      // 保存到缓存
      saveToCache(CACHE_CONFIG_KEY, configsData);
    } catch (error) {
      console.error('加载配置失败:', error);
      // 如果没有缓存也没有接口数据，使用默认配置（已经在初期状态中设置）
    }
  };

  useEffect(() => {
    // 立即开始初始化，但不阻塞渲染
    const init = async () => {
      try {
        setLoading(true);
        setIsAuthChecking(true);

        // 并行加载配置和初始化数据库（如果需要）
        // 配置会立即影响 UI（标题、自定义 CSS 等）
        const configPromise = fetchConfigs();
        const dbPromise = api.initDB();

        await Promise.all([configPromise, dbPromise]);

        // 数据库初始化和配置加载后，进行认证检查和业务数据加载
        checkAuthStatus();
      } catch (error) {
        console.error('初始化失败:', error);
        setLoading(false);
        setIsAuthChecking(false);
      }
    };
    init();

    // 检查 URL 参数是否请求登录 (隐式入口)
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') !== null || params.get('admin') !== null) {
      setIsLoginOpen(true);
    }

    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  }, []);

  // 渐进式加载逻辑：逐步增加显示的分组数量，直到全部显示
  useEffect(() => {
    if (!loading && groups.length > visibleGroupsCount) {
      const timer = setTimeout(() => {
        // 每次增加 5 个，直到涵盖所有分组
        setVisibleGroupsCount(prev => Math.min(prev + 5, groups.length));
      }, 100); // 100ms 间隔，既能保证流畅度又能分批渲染
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, groups.length, visibleGroupsCount]);

  // 设置文档标题
  useEffect(() => {
    document.title = configs['site.title'] || '导航站';
  }, [configs]);

  // 应用自定义CSS
  useEffect(() => {
    const customCss = configs['site.customCss'];
    let styleElement = document.getElementById('custom-style');

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-style';
      document.head.appendChild(styleElement);
    }

    // 使用安全的 CSS 清理函数，防止XSS攻击
    const sanitized = sanitizeCSS(customCss || '');
    styleElement.textContent = sanitized;

    // 清理函数：组件卸载时移除样式
    return () => {
      const el = document.getElementById('custom-style');
      if (el) {
        el.remove();
      }
    };
  }, [configs]);

  // 同步HTML的class以保持与现有CSS兼容
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 处理错误的函数
  const handleError = (errorMessage: string) => {
    setSnackbarSeverity('error');
    setSnackbarMessage(errorMessage);
    setSnackbarOpen(true);
    console.error(errorMessage);
  };

  // 处理成功的函数
  const handleSuccess = (successMessage: string) => {
    setSnackbarSeverity('success');
    setSnackbarMessage(successMessage);
    setSnackbarOpen(true);
  };

  // 关闭提示框
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const fetchData = async () => {
    // 1. 实现 SWR (Stale-While-Revalidate) 策略
    // 访客模式下尝试从缓存加载数据
    if (viewMode === 'readonly') {
      const cachedData = loadFromCache(CACHE_DATA_KEY);
      if (cachedData) {
        setGroups(cachedData);
        // 如果有缓存，可以暂时关闭 loading
        setLoading(false);
      }
    }

    try {
      // 只有在没有缓存或者非只读模式时才强制开启 loading
      if (viewMode !== 'readonly' || !localStorage.getItem(CACHE_DATA_KEY)) {
        setLoading(true);
      }
      setError(null);

      // 使用新的 getGroupsWithSites API 优化 N+1 查询问题
      const groupsWithSites = await api.getGroupsWithSites();

      setGroups(groupsWithSites);

      // 只有在只读模式下才缓存业务数据
      if (viewMode === 'readonly') {
        saveToCache(CACHE_DATA_KEY, groupsWithSites);
      }
    } catch (error) {
      console.error('加载数据失败:', error);

      // 仅在完全没有数据可显示时才弹出错误
      if (groups.length === 0) {
        handleError('加载数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }

      // 如果因为认证问题导致加载失败，处理认证状态
      if (error instanceof Error && error.message.includes('认证')) {
        setIsAuthRequired(true);
        setIsAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 更新站点
  const handleSiteUpdate = async (updatedSite: Site) => {
    try {
      if (updatedSite.id) {
        await api.updateSite(updatedSite.id, updatedSite);
        await fetchData(); // 重新加载数据
      }
    } catch (error) {
      console.error('更新站点失败:', error);
      handleError('更新站点失败: ' + (error as Error).message);
    }
  };

  // 删除站点
  const handleSiteDelete = async (siteId: number) => {
    // 记录旧状态以便回滚
    const previousGroups = [...groups];

    // 1. 乐观更新：立即从前端界面移除
    setGroups((prevGroups) =>
      prevGroups.map((group) => ({
        ...group,
        sites: group.sites.filter((site) => site.id !== siteId),
      }))
    );

    try {
      // 2. 异步后台删除
      await api.deleteSite(siteId);

      // 3. 响应删除完成（显示成功提示）
      handleSuccess('书签已成功删除');
    } catch (error) {
      console.error('删除站点失败:', error);
      // 回滚
      setGroups(previousGroups);
      handleError('删除站点失败: ' + (error as Error).message);
    }
  };



  // 保存站点排序
  const handleSaveSiteOrder = async (groupId: number, sites: Site[]) => {
    try {
      console.log('保存站点排序', groupId, sites);

      // 构造需要更新的站点顺序数据
      const siteOrders = sites.map((site, index) => ({
        id: site.id as number,
        order_num: index,
      }));

      // 调用API更新站点顺序
      const result = await api.updateSiteOrder(siteOrders);

      if (result) {
        console.log('站点排序更新成功');
        // 重新获取最新数据
        // 重新获取最新数据
        // await fetchData();
      } else {
        throw new Error('站点排序更新失败');
      }



      // setSortMode(SortMode.None);
      // setCurrentSortingGroupId(null);
    } catch (error) {
      console.error('更新站点排序失败:', error);
      handleError('更新站点排序失败: ' + (error as Error).message);
    }
  };

  // 启动分组排序
  const startGroupSort = () => {
    console.log('开始分组排序');
    setSortMode(SortMode.GroupSort);
    setCurrentSortingGroupId(null);

  };

  // 启动站点排序
  const startSiteSort = (groupId: number) => {
    console.log('开始站点排序');
    setSortMode(SortMode.SiteSort);
    setCurrentSortingGroupId(groupId);

  };

  // 取消排序
  const cancelSort = () => {
    setSortMode(SortMode.None);
    setCurrentSortingGroupId(null);
  };

  // 处理站点恢复
  const handleSiteRestored = (siteOrSites: Site | Site[]) => {
    const sitesToRestore = Array.isArray(siteOrSites) ? siteOrSites : [siteOrSites];
    if (sitesToRestore.length === 0) return;

    setGroups((prevGroups) => {
      const newGroups = [...prevGroups];
      let updated = false;

      // 按分组 ID 对要恢复的站点进行归类
      const sitesByGroup = sitesToRestore.reduce((acc, site) => {
        if (site.group_id !== undefined && site.group_id !== null) {
          const gid = site.group_id;
          if (!acc[gid]) acc[gid] = [];
          acc[gid]!.push(site);
        }
        return acc;
      }, {} as Record<number, Site[]>);

      for (const [groupIdStr, sites] of Object.entries(sitesByGroup)) {
        const groupId = Number(groupIdStr);
        const groupIndex = newGroups.findIndex((g) => g.id === groupId);

        if (groupIndex !== -1) {
          const targetGroup = { ...newGroups[groupIndex] };
          const existingSites = targetGroup.sites ? [...targetGroup.sites] : [];
          let groupUpdated = false;

          for (const site of sites) {
            if (!existingSites.find((s) => s.id === site.id)) {
              existingSites.push(site);
              groupUpdated = true;
            }
          }

          if (groupUpdated) {
            existingSites.sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
            targetGroup.sites = existingSites;
            newGroups[groupIndex] = targetGroup as GroupWithSites;
            updated = true;
          }
        } else {
          // 如果找不到分组，可能是数据不同步，标记需要刷新
          updated = false;
          fetchData();
          return prevGroups;
        }
      }

      if (updated) {
        setSnackbarMessage(
          Array.isArray(siteOrSites)
            ? `已批量恢复 ${siteOrSites.length} 个站点`
            : `已恢复站点: ${siteOrSites?.name || ''}`
        );
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        return newGroups;
      }

      return prevGroups;
    });
  };

  // 启动跨分组拖动模式
  const startCrossGroupDrag = () => {
    console.log('开始跨分组拖动');
    setSortMode(SortMode.CrossGroupDrag);
    setCurrentSortingGroupId(null);

  };

  // 处理跨分组拖拽的 DragOver 事件
  const handleSiteDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    if (sortMode !== SortMode.CrossGroupDrag) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (!activeId.startsWith('site-')) return;
    const activeSiteId = parseInt(activeId.replace('site-', ''));

    // 查找 active 所在的 Group
    const activeGroup = groups.find(g => g.sites.some(s => s.id === activeSiteId));
    if (!activeGroup) return;

    // 查找 over 所在的 Group
    let overGroupId: number | null = null;
    if (overId.startsWith('group-')) {
      overGroupId = parseInt(overId.replace('group-', ''));
    } else if (overId.startsWith('site-')) {
      const overSiteId = parseInt(overId.replace('site-', ''));
      const g = groups.find(g => g.sites.some(s => s.id === overSiteId));
      if (g) overGroupId = g.id;
    }

    if (!overGroupId || activeGroup.id === overGroupId) return;

    const overSiteId = overId.startsWith('site-') ? parseInt(overId.replace('site-', '')) : null;

    // 移动站点以显示占位
    setGroups((prev) => {
      // 找到源分组和目标分组
      const sourceIndex = prev.findIndex(g => g.sites.some(s => s.id === activeSiteId));
      const targetIndex = overId.startsWith('group-')
        ? prev.findIndex(g => g.id === overGroupId)
        : prev.findIndex(g => g.sites.some(s => s.id === overSiteId));

      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const source = prev[sourceIndex];
      const target = prev[targetIndex];

      if (!source || !target) return prev;

      // 如果源和目标相同，且是 site-to-site，dnd-kit-sortable 会处理，这里不处理
      if (sourceIndex === targetIndex) return prev;

      const siteIndex = source.sites.findIndex(s => s.id === activeSiteId);
      if (siteIndex === -1) return prev;

      // 仅在真正发生跨组变化或位置变化时更新状态
      const movedSite = source.sites[siteIndex];

      // 创建新数组，仅克隆受影响的分组
      const newGroups = [...prev];

      // 更新源分组：移除站点
      const newSourceSites = [...source.sites];
      newSourceSites.splice(siteIndex, 1);
      newGroups[sourceIndex] = { ...source, sites: newSourceSites } as any;

      // 更新目标分组：插入站点
      const newTargetSites = [...target.sites];
      const siteToInsert = { ...movedSite, group_id: target.id as number } as any;

      let insertIndex = newTargetSites.length;
      if (overId.startsWith('site-')) {
        const idx = newTargetSites.findIndex(s => s.id === overSiteId);
        if (idx !== -1) {
          const activeRect = active.rect.current.translated;
          const overRect = over.rect;
          if (activeRect && overRect) {
            const isAfter = activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2 ||
              (Math.abs(activeRect.top - overRect.top) < 10 && activeRect.left > overRect.left);
            insertIndex = idx + (isAfter ? 1 : 0);
          } else {
            insertIndex = idx;
          }
        }
      }

      newTargetSites.splice(insertIndex, 0, siteToInsert);
      newGroups[targetIndex] = { ...target, sites: newTargetSites } as any;

      return newGroups;
    });
  };

  // 处理跨分组拖拽结束事件
  const handleCrossGroupDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id.toString();

    setDraggedSiteId(null);
    setActiveSite(null);
    const startGroupId = dragStartGroupId;
    setDragStartGroupId(null);

    if (!over || !activeId.startsWith('site-')) return;

    const activeSiteId = parseInt(activeId.replace('site-', ''));

    // 查找当前所在的组 (可能已经在 DragOver 中移动了)
    const currentGroup = groups.find(g => g.sites.some(s => s.id === activeSiteId));
    if (!currentGroup) return;

    let finalSites = [...currentGroup.sites];
    let orderChanged = false;

    // 处理同组内的排序
    if (over.id.toString().startsWith('site-')) {
      const overSiteId = parseInt(over.id.toString().replace('site-', ''));
      const oldIndex = currentGroup.sites.findIndex(s => s.id === activeSiteId);
      const overIndex = currentGroup.sites.findIndex(s => s.id === overSiteId);

      if (oldIndex !== -1 && overIndex !== -1) {
        let newIndex = overIndex;

        // 使用 Rect 判断相对位置，修正 finalIndex
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;

        if (activeRect && overRect) {
          const activeCenterY = activeRect.top + activeRect.height / 2;
          const overCenterY = overRect.top + overRect.height / 2;
          const activeCenterX = activeRect.left + activeRect.width / 2;
          const overCenterX = overRect.left + overRect.width / 2;

          let isAfter = false;
          if (activeCenterY > overCenterY + overRect.height / 2) {
            isAfter = true;
          } else if (activeCenterY < overCenterY - overRect.height / 2) {
            isAfter = false;
          } else {
            if (activeCenterX > overCenterX) isAfter = true;
          }

          // 根据拖拽方向和相对位置修正索引
          if (oldIndex < overIndex) {
            // 向下拖拽，默认是放在 over 后面 (Index=overIndex)
            // 如果判断实际上是 Before (Top half)，则 -1
            if (!isAfter) newIndex = overIndex - 1;
          } else {
            // 向上拖拽，默认是放在 over 前面 (Index=overIndex)
            // 如果判断实际上是 After (Bottom half)，则 +1
            if (isAfter) newIndex = overIndex + 1;
          }
        }

        if (oldIndex !== newIndex) {
          finalSites = arrayMove(currentGroup.sites, oldIndex, newIndex);
          orderChanged = true;

          // 更新本地状态
          setGroups(prev => prev.map(g =>
            g.id === currentGroup.id ? { ...g, sites: finalSites } : g
          ));
        }
      }
    }

    // 同步到 API
    try {
      // 检查是否跨组移动
      if (startGroupId && currentGroup.id !== startGroupId) {
        await api.updateSite(activeSiteId, { group_id: currentGroup.id });
        await handleSaveSiteOrder(currentGroup.id, finalSites);
        setSnackbarMessage('已移动站点');
        setSnackbarOpen(true);
      } else if (orderChanged) {
        // 仅排序
        await handleSaveSiteOrder(currentGroup.id, finalSites);
      }
    } catch (error) {
      console.error('移动/排序失败:', error);
      handleError('移动/排序失败: ' + (error as Error).message);
      await fetchData(); // 失败回滚
    }
  };

  // 处理拖拽开始事件
  const handleDragStart = (event: any) => {
    const { active } = event;
    setDraggedSiteId(active.id.toString());

    // 查找拖拽的站点
    const activeId = active.id.toString();
    if (activeId.startsWith('site-')) {
      const activeSiteId = parseInt(activeId.replace('site-', ''));
      for (const group of groups) {
        const site = group.sites.find((s) => s.id === activeSiteId);
        if (site) {
          setActiveSite(site);
          setDragStartGroupId(group.id);
          break;
        }
      }
    }
  };

  // 处理拖拽结束事件
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedSiteId(null);
    setActiveSite(null);

    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // 处理分组排序
    if (!activeId.startsWith('site-') && !overId.startsWith('site-')) {
      if (activeId !== overId) {
        const oldIndex = groups.findIndex((group) => `group-${group.id}` === activeId);
        const newIndex = groups.findIndex((group) => `group-${group.id}` === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newGroups = arrayMove(groups, oldIndex, newIndex);
          setGroups(newGroups);

          // 自动保存分组顺序
          const groupOrders = newGroups.map((group, index) => ({
            id: group.id as number,
            order_num: index,
          }));
          api.updateGroupOrder(groupOrders).catch(err => {
            console.error('自动保存分组排序失败:', err);
            handleError('自动保存分组排序失败: ' + err.message);
          });
        }
      }
    }
    // 处理站点排序 (同组内)
    else if (activeId.startsWith('site-') && overId.startsWith('site-')) {
      // 只有在 SiteSort 模式且在当前编辑组内才处理
      if (sortMode === SortMode.SiteSort && currentSortingGroupId) {
        const activeSiteId = parseInt(activeId.replace('site-', ''));
        const overSiteId = parseInt(overId.replace('site-', ''));

        const currentGroupId = currentSortingGroupId;
        const groupIndex = groups.findIndex(g => g.id === currentGroupId);
        if (groupIndex !== -1) {
          const targetGroup = groups[groupIndex];
          if (targetGroup) {
            const oldIndex = targetGroup.sites.findIndex(s => s.id === activeSiteId);
            const newIndex = targetGroup.sites.findIndex(s => s.id === overSiteId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newSites = arrayMove(targetGroup.sites, oldIndex, newIndex);
              const newGroups = [...groups];
              newGroups[groupIndex] = { ...targetGroup, sites: newSites } as any;
              setGroups(newGroups);

              // 自动保存站点顺序
              handleSaveSiteOrder(currentGroupId!, newSites).catch(err => {
                console.error('自动保存站点排序失败:', err);
              });
            }
          }
        }
      }
    }
  };

  // 新增分组相关函数
  const handleOpenAddGroup = () => {
    setNewGroup({ name: '', order_num: groups.length, is_public: 1 }); // 默认公开
    setOpenAddGroup(true);
  };

  const handleCloseAddGroup = () => {
    setOpenAddGroup(false);
  };

  const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroup({
      ...newGroup,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateGroup = async () => {
    try {
      if (!newGroup.name) {
        handleError('分组名称不能为空');
        return;
      }

      await api.createGroup(newGroup as Group);
      await fetchData(); // 重新加载数据
      handleCloseAddGroup();
      setNewGroup({ name: '', order_num: 0 }); // 重置表单
    } catch (error) {
      console.error('创建分组失败:', error);
      handleError('创建分组失败: ' + (error as Error).message);
    }
  };

  // 新增站点相关函数
  const handleOpenAddSite = (groupId: number) => {
    const group = groups.find((g) => g.id === groupId);
    const maxOrderNum = group?.sites.length
      ? Math.max(...group.sites.map((s) => s.order_num)) + 1
      : 0;

    setNewSite({
      name: '',
      url: '',
      icon: '',
      description: '',
      notes: '',
      group_id: groupId,
      order_num: maxOrderNum,
      is_public: 1, // 默认为公开
    });

    setOpenAddSite(true);
  };

  const handleCloseAddSite = () => {
    setOpenAddSite(false);
  };

  const handleSiteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSite({
      ...newSite,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateSite = async () => {
    try {
      if (!newSite.name || !newSite.url) {
        handleError('站点名称和URL不能为空');
        return;
      }

      await api.createSite(newSite as Site);
      await fetchData(); // 重新加载数据
      handleCloseAddSite();
    } catch (error) {
      console.error('创建站点失败:', error);
      handleError('创建站点失败: ' + (error as Error).message);
    }
  };

  // 配置相关函数
  const handleOpenConfig = () => {
    setTempConfigs({ ...configs });
    setOpenConfig(true);
  };

  const handleCloseConfig = () => {
    setOpenConfig(false);
  };

  const handleConfigInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempConfigs({
      ...tempConfigs,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveConfig = async () => {
    try {
      // 保存所有配置
      for (const [key, value] of Object.entries(tempConfigs)) {
        if (configs[key] !== value) {
          await api.setConfig(key, value);
        }
      }

      // 更新配置状态
      setConfigs({ ...tempConfigs });
      handleCloseConfig();
    } catch (error) {
      console.error('保存配置失败:', error);
      handleError('保存配置失败: ' + (error as Error).message);
    }
  };

  // 处理导出数据
  const handleExportData = async () => {
    try {
      setLoading(true);

      // 提取所有站点数据为单独的数组
      const allSites: Site[] = [];
      groups.forEach((group) => {
        if (group.sites && group.sites.length > 0) {
          allSites.push(...group.sites);
        }
      });

      const exportData = {
        // 只导出分组基本信息，不包含站点
        groups: groups.map((group) => ({
          id: group.id,
          name: group.name,
          order_num: group.order_num,
        })),
        // 站点数据作为单独的顶级数组
        sites: allSites,
        configs: configs,
        // 添加版本和导出日期
        version: '1.0',
        exportDate: new Date().toISOString(),
      };

      // 创建并下载JSON文件
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileName = `导航站备份_${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileName);
      linkElement.click();
    } catch (error) {
      console.error('导出数据失败:', error);
      handleError('导出数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 处理导入对话框
  const handleOpenImport = () => {
    setImportFile(null);
    setImportError(null);
    setOpenImport(true);

  };

  const handleCloseImport = () => {
    setOpenImport(false);
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setImportFile(selectedFile);
        setImportError(null);
      }
    }
  };

  // 处理导入数据
  const handleImportData = async () => {
    if (!importFile) {
      handleError('请选择要导入的文件');
      return;
    }

    try {
      setImportLoading(true);
      setImportError(null);

      const fileReader = new FileReader();
      fileReader.readAsText(importFile, 'UTF-8');

      fileReader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('读取文件失败');
          }

          const importData = JSON.parse(e.target.result as string);

          // 验证导入数据格式
          if (!importData.groups || !Array.isArray(importData.groups)) {
            throw new Error('导入文件格式错误：缺少分组数据');
          }

          if (!importData.sites || !Array.isArray(importData.sites)) {
            throw new Error('导入文件格式错误：缺少站点数据');
          }

          // configs 是可选字段，如果缺失则使用空对象
          if (!importData.configs) {
            importData.configs = {};
          } else if (typeof importData.configs !== 'object') {
            throw new Error('导入文件格式错误：配置数据格式无效');
          }

          // 调用API导入数据
          const result = await api.importData(importData);

          if (!result.success) {
            throw new Error(result.error || '导入失败');
          }

          // 显示导入结果统计
          const stats = result.stats;
          if (stats) {
            const summary = [
              `导入成功！`,
              `分组：发现${stats.groups.total}个，新建${stats.groups.created}个，合并${stats.groups.merged}个`,
              `卡片：发现${stats.sites.total}个，新建${stats.sites.created}个，更新${stats.sites.updated}个，跳过${stats.sites.skipped}个`,
            ].join('\n');

            setImportResultMessage(summary);
            setImportResultOpen(true);
          }

          // 刷新数据
          await fetchData();
          await fetchConfigs();
          handleCloseImport();
        } catch (error) {
          console.error('解析导入数据失败:', error);
          handleError('解析导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
        } finally {
          setImportLoading(false);
        }
      };

      fileReader.onerror = () => {
        handleError('读取文件失败');
        setImportLoading(false);
      };
    } catch (error) {
      console.error('导入数据失败:', error);
      handleError('导入数据失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setImportLoading(false);
    }
  };

  // 渲染登录页面
  const renderLoginForm = () => {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <LoginForm
          onLogin={handleLogin}
          onRegister={handleRegister}
          onResetPassword={handleResetPassword}
          onSendCode={handleSendCode}
          loading={loginLoading}
          error={loginError}
          registerLoading={registerLoading}
          registerError={registerError}
          registerSuccess={registerSuccess}
          resetPasswordLoading={resetPasswordLoading}
          resetPasswordError={resetPasswordError}
          resetPasswordSuccess={resetPasswordSuccess}
        />
        {/* 如果不是强制认证（比如访客模式点击登录），显示返回按钮 */}
        {!isAuthenticated && (
          <Button
            onClick={() => setIsLoginOpen(false)}
            sx={{ mt: 2 }}
            variant="text"
          >
            返回访客模式
          </Button>
        )}
      </Box>
    );
  };

  // 如果正在检查认证状态，显示加载界面
  if (isAuthChecking) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
          }}
        >
          <CircularProgress size={60} thickness={4} />
        </Box>
      </ThemeProvider>
    );
  }

  // 显式显示登录界面
  if (isLoginOpen) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {renderLoginForm()}
      </ThemeProvider>
    );
  }

  // 更新分组
  const handleGroupUpdate = async (updatedGroup: Group) => {
    try {
      if (updatedGroup.id) {
        await api.updateGroup(updatedGroup.id, updatedGroup);
        await fetchData(); // 重新加载数据
      }
    } catch (error) {
      console.error('更新分组失败:', error);
      handleError('更新分组失败: ' + (error as Error).message);
    }
  };

  // 删除分组
  const handleGroupDelete = async (groupId: number) => {
    try {
      await api.deleteGroup(groupId);
      await fetchData(); // 重新加载数据
    } catch (error) {
      console.error('删除分组失败:', error);
      handleError('删除分组失败: ' + (error as Error).message);
    }
  };

  // 记录站点点击
  const handleSiteClick = async (siteId: number) => {
    try {
      await api.clickSite(siteId);
    } catch (error) {
      console.warn('记录点击失败:', error);
    }
  };

  // 打开站点设置时刷新数据
  const handleSiteSettingsOpen = async (siteId: number) => {
    try {
      const updatedSite = await api.getSite(siteId);
      if (updatedSite) {
        setGroups(prev => prev.map(group => ({
          ...group,
          sites: group.sites.map(site => site.id === siteId ? updatedSite : site)
        })));
      }
    } catch (error) {
      console.warn('刷新站点数据失败:', error);
    }
  };

  // 批量删除站点
  const handleBatchDeleteSites = async (siteIds: number[]) => {
    if (siteIds.length === 0) return;

    try {
      const success = await api.deleteSites(siteIds);
      if (success) {
        // 乐观更新 UI：从当前分组状态中移除被删除的站点
        setGroups(prev => prev.map(group => ({
          ...group,
          sites: group.sites.filter(site => !siteIds.includes(site.id as number))
        })));

        handleSuccess(`成功删除 ${siteIds.length} 个书签`);
      } else {
        handleError('批量删除书签失败');
      }
    } catch (error) {
      console.error('批量删除书签出错:', error);
      handleError('批量删除书签出错: ' + (error as Error).message);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div id="back-to-top-anchor" />

      {/* 错误提示 Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={1000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          variant='filled'
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* 导入结果提示 Snackbar */}
      <Snackbar
        open={importResultOpen}
        autoHideDuration={6000}
        onClose={() => setImportResultOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setImportResultOpen(false)}
          severity='success'
          variant='filled'
          sx={{
            width: '100%',
            whiteSpace: 'pre-line',
            backgroundColor: (theme) => (theme.palette.mode === 'dark' ? '#2e7d32' : undefined),
            color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
            '& .MuiAlert-icon': {
              color: (theme) => (theme.palette.mode === 'dark' ? '#fff' : undefined),
            },
          }}
        >
          {importResultMessage}
        </Alert>
      </Snackbar>

      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
          transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out',
          position: 'relative', // 添加相对定位，作为背景图片的容器
          overflow: 'hidden', // 防止背景图片溢出
        }}
      >
        {/* 背景图片 */}
        {configs['site.backgroundImage'] && isSecureUrl(configs['site.backgroundImage']) && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${configs['site.backgroundImage']})`,
                backgroundSize: '100% auto', // 宽度铺满，高度按比例自适应
                backgroundPosition: 'top center', // 从顶部开始
                backgroundRepeat: 'repeat-y', // 纵向重复
                zIndex: 0,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, ' + (1 - Number(configs['site.backgroundOpacity'])) + ')'
                      : 'rgba(255, 255, 255, ' +
                      (1 - Number(configs['site.backgroundOpacity'])) +
                      ')',
                  zIndex: 1,
                },
              }}
            />
          </>
        )}

        <Container
          maxWidth='lg'
          sx={{
            py: 4,
            px: { xs: 2, sm: 3, md: 4 },
            position: 'relative', // 使内容位于背景图片和蒙版之上
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 5,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 },
            }}
          >
            <Typography
              variant='h3'
              component='h1'
              fontWeight='bold'
              color='text.primary'
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.125rem', md: '3rem' },
                textAlign: { xs: 'center', sm: 'left' },
              }}
            >
              {configs['site.name']}
            </Typography>
            <Stack
              direction={{ xs: 'row', sm: 'row' }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems='center'
              width={{ xs: '100%', sm: 'auto' }}
              justifyContent={{ xs: 'center', sm: 'flex-end' }}
              flexWrap='wrap'
              sx={{ gap: { xs: 1, sm: 2 }, py: { xs: 1, sm: 0 } }}
            >
              {sortMode !== SortMode.None ? (
                <>

                  {sortMode === SortMode.CrossGroupDrag && (
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ alignSelf: 'center', mr: 1 }}
                    >
                      拖动站点到其他分组
                    </Typography>
                  )}
                  <Button
                    variant='outlined'
                    color='inherit'
                    startIcon={<CancelIcon />}
                    onClick={cancelSort}
                    size='small'
                    sx={{
                      minWidth: 'auto',
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    取消编辑
                  </Button>
                </>
              ) : (
                <>
                  {viewMode === 'readonly' ? (
                    // 访客模式：隐藏登录按钮 (通过 URL ?login=1 进入)
                    null
                  ) : (
                    // 编辑模式：隐藏管理按钮 (已移至头像菜单)
                    null
                  )}
                </>
              )}
              <ThemeToggle darkMode={darkMode} onToggle={toggleTheme} />
              {isAuthenticated && (
                <UserAvatar
                  username={username}
                  onLogout={handleLogout}
                  onSiteRestored={handleSiteRestored}
                  onStartGroupSort={startGroupSort}
                  onStartCrossGroupDrag={startCrossGroupDrag}
                  onOpenConfig={handleOpenConfig}
                  onExportData={handleExportData}
                  onOpenImport={handleOpenImport}
                  onOpenAddGroup={handleOpenAddGroup}
                  api={api}
                />
              )}
              {/* GitHub 图标 */}
              <IconButton
                component='a'
                href='https://github.com/zqq-nuli/Navihive'
                target='_blank'
                rel='noopener noreferrer'
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: 'background.paper',
                  boxShadow: 1,
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <GitHubIcon />
              </IconButton>
            </Stack>
          </Box>

          {!isAuthenticated ? (
            <VisitorHome
              api={api}
              onLoginClick={() => {
                console.log('VisitorHome onLoginClick triggered');
                setIsLoginOpen(true);
              }}
            />
          ) : (
            <>
              {/* 搜索框 - 根据配置条件渲染 */}
              {(() => {
                // 检查搜索框是否启用
                const searchBoxEnabled = configs['site.searchBoxEnabled'] === 'true';
                if (!searchBoxEnabled) {
                  return null;
                }

                // 如果是访客模式，检查访客是否可用搜索框
                if (viewMode === 'readonly') {
                  const guestEnabled = configs['site.searchBoxGuestEnabled'] === 'true';
                  if (!guestEnabled) {
                    return null;
                  }
                }

                return (
                  <Box sx={{ mb: 4 }}>
                    <SearchBox
                      groups={groups}
                      sites={groups.flatMap((g) => g.sites || [])}
                      onDelete={isAuthenticated ? handleSiteDelete : undefined}
                      onInternalResultClick={(result: SearchResultItem) => {
                        // 可选：滚动到对应的元素
                        if (result.type === 'group') {
                          const groupElement = document.getElementById(`group-${result.id}`);
                          groupElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        } else if (result.type === 'site' && result.groupId) {
                          const groupElement = document.getElementById(`group-${result.groupId}`);
                          groupElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                    />
                  </Box>
                );
              })()}

              {loading && groups.length === 0 && (
                <PageSkeleton />
              )}

              {!loading && !error && (
                <Fade in={!loading} timeout={800}>
                  <Box
                    sx={{
                      '& > *': { mb: 5 },
                      minHeight: '100px',
                    }}
                  >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={sortMode === SortMode.CrossGroupDrag ? handleCrossGroupDragEnd : handleDragEnd}
                      onDragOver={handleSiteDragOver}
                    >
                      {sortMode === SortMode.GroupSort ? (
                        <SortableContext
                          items={groups.map((group) => `group-${group.id}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <Stack spacing={2}>
                            {groups.map((group) => (
                              <SortableGroupItem key={group.id} id={`group-${group.id}`} group={group} />
                            ))}
                          </Stack>
                        </SortableContext>
                      ) : (
                        <Box sx={{ '& > *': { mb: 5 } }}>
                          {groups.slice(0, visibleGroupsCount).map((group) => (
                            <GroupCard
                              key={group.id}
                              group={group}
                              sortMode={sortMode === SortMode.None ? 'None' : sortMode === SortMode.CrossGroupDrag ? 'CrossGroupDrag' : 'SiteSort'}
                              currentSortingGroupId={currentSortingGroupId}
                              viewMode={viewMode}
                              onUpdate={handleSiteUpdate}
                              onDelete={handleSiteDelete}
                              onStartSiteSort={startSiteSort}
                              onAddSite={handleOpenAddSite}
                              onUpdateGroup={handleGroupUpdate}
                              onDeleteGroup={handleGroupDelete}
                              onBatchDelete={handleBatchDeleteSites}
                              onSiteClick={handleSiteClick}
                              onSettingsOpen={handleSiteSettingsOpen}
                              configs={configs}
                              draggedSiteId={draggedSiteId}
                            />
                          ))}
                          {groups.length > visibleGroupsCount && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                              <CircularProgress size={24} />
                            </Box>
                          )}
                        </Box>
                      )}

                      <DragOverlay dropAnimation={{
                        duration: 200,
                        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                      }}>
                        {activeSite ? (
                          <Box
                            sx={{
                              width: {
                                xs: 200,
                                sm: 220,
                                md: 250,
                                lg: 280,
                                xl: 300,
                              },
                              padding: 1,
                            }}
                          >
                            <SiteCard
                              site={activeSite}
                              onUpdate={() => { }}
                              onDelete={() => { }}
                              onSiteClick={() => { }}
                              isEditMode={true}
                              viewMode={viewMode}
                              iconApi={configs['site.iconApi']}
                            />
                          </Box>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </Box>
                </Fade>
              )}

            </>
          )}

          {/* 新增分组对话框 */}
          <Dialog
            open={openAddGroup}
            onClose={handleCloseAddGroup}
            maxWidth='md'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 3, md: 4 },
                width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' },
                maxWidth: { sm: '600px' },
              },
            }}
          >
            <DialogTitle>
              新增分组
              <IconButton
                aria-label='close'
                onClick={handleCloseAddGroup}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>请输入新分组的信息</DialogContentText>
              <TextField
                autoFocus
                margin='dense'
                id='group-name'
                name='name'
                label='分组名称'
                type='text'
                fullWidth
                variant='outlined'
                value={newGroup.name}
                onChange={handleGroupInputChange}
                sx={{ mb: 2 }}
              />

              {/* 公开/私密开关 */}
              <FormControlLabel
                control={
                  <Switch
                    checked={newGroup.is_public !== 0}
                    onChange={(e) =>
                      setNewGroup({ ...newGroup, is_public: e.target.checked ? 1 : 0 })
                    }
                    color='primary'
                  />
                }
                label={
                  <Box>
                    <Typography variant='body1'>
                      {newGroup.is_public !== 0 ? '公开分组' : '私密分组'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {newGroup.is_public !== 0
                        ? '所有访客都可以看到此分组'
                        : '只有管理员登录后才能看到此分组'}
                    </Typography>
                  </Box>
                }
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseAddGroup} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleCreateGroup} variant='contained' color='primary'>
                创建
              </Button>
            </DialogActions>
          </Dialog>

          {/* 新增站点对话框 */}
          <Dialog
            open={openAddSite}
            onClose={handleCloseAddSite}
            maxWidth='md'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 'auto' },
                width: { xs: 'calc(100% - 32px)', sm: 'auto' },
              },
            }}
          >
            <DialogTitle>
              新增站点
              <IconButton
                aria-label='close'
                onClick={handleCloseAddSite}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>请输入新站点的信息</DialogContentText>
              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      autoFocus
                      margin='dense'
                      id='site-name'
                      name='name'
                      label='站点名称'
                      type='text'
                      fullWidth
                      variant='outlined'
                      value={newSite.name}
                      onChange={handleSiteInputChange}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      margin='dense'
                      id='site-url'
                      name='url'
                      label='站点URL'
                      type='url'
                      fullWidth
                      variant='outlined'
                      value={newSite.url}
                      onChange={handleSiteInputChange}
                    />
                  </Box>
                </Box>
                <TextField
                  margin='dense'
                  id='site-icon'
                  name='icon'
                  label='图标URL'
                  type='url'
                  fullWidth
                  variant='outlined'
                  value={newSite.icon}
                  onChange={handleSiteInputChange}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton
                          onClick={() => {
                            if (!newSite.url) {
                              handleError('请先输入站点URL');
                              return;
                            }
                            const domain = extractDomain(newSite.url);
                            if (domain) {
                              const actualIconApi =
                                configs['site.iconApi'] ||
                                'https://www.faviconextractor.com/favicon/{domain}?larger=true';
                              const iconUrl = actualIconApi.replace('{domain}', domain);
                              setNewSite({
                                ...newSite,
                                icon: iconUrl,
                              });
                            } else {
                              handleError('无法从URL中获取域名');
                            }
                          }}
                          edge='end'
                          title='自动获取图标'
                        >
                          <AutoFixHighIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  margin='dense'
                  id='site-description'
                  name='description'
                  label='站点描述'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={newSite.description}
                  onChange={handleSiteInputChange}
                />
                <TextField
                  margin='dense'
                  id='site-notes'
                  name='notes'
                  label='备注'
                  type='text'
                  fullWidth
                  multiline
                  rows={2}
                  variant='outlined'
                  value={newSite.notes}
                  onChange={handleSiteInputChange}
                />

                {/* 公开/私密开关 */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={newSite.is_public !== 0}
                      onChange={(e) =>
                        setNewSite({ ...newSite, is_public: e.target.checked ? 1 : 0 })
                      }
                      color='primary'
                    />
                  }
                  label={
                    <Box>
                      <Typography variant='body1'>
                        {newSite.is_public !== 0 ? '公开站点' : '私密站点'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {newSite.is_public !== 0
                          ? '所有访客都可以看到此站点'
                          : '只有管理员登录后才能看到此站点'}
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseAddSite} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleCreateSite} variant='contained' color='primary'>
                创建
              </Button>
            </DialogActions>
          </Dialog>

          {/* 网站配置对话框 */}
          <Dialog
            open={openConfig}
            onClose={handleCloseConfig}
            maxWidth='sm'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 3, md: 4 },
                width: { xs: 'calc(100% - 32px)', sm: '80%', md: '70%', lg: '60%' },
                maxWidth: { sm: '600px' },
              },
            }}
          >
            <DialogTitle>
              网站设置
              <IconButton
                aria-label='close'
                onClick={handleCloseConfig}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>配置网站的基本信息和外观</DialogContentText>
              <Stack spacing={2}>
                <TextField
                  margin='dense'
                  id='site-title'
                  name='site.title'
                  label='网站标题 (浏览器标签)'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={tempConfigs['site.title']}
                  onChange={handleConfigInputChange}
                />
                <TextField
                  margin='dense'
                  id='site-name'
                  name='site.name'
                  label='网站名称 (显示在页面中)'
                  type='text'
                  fullWidth
                  variant='outlined'
                  value={tempConfigs['site.name']}
                  onChange={handleConfigInputChange}
                />
                {/* 获取图标API设置项 */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant='subtitle1' gutterBottom>
                    获取图标API设置
                  </Typography>
                  <TextField
                    margin='dense'
                    id='site-icon-api'
                    name='site.iconApi'
                    label='获取图标API URL'
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={tempConfigs['site.iconApi']}
                    onChange={handleConfigInputChange}
                    placeholder='https://example.com/favicon/{domain}'
                    helperText='输入获取图标API的地址，使用 {domain} 作为域名占位符'
                  />
                </Box>
                {/* 新增背景图片设置 */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant='subtitle1' gutterBottom>
                    背景图片设置
                  </Typography>
                  <TextField
                    margin='dense'
                    id='site-background-image'
                    name='site.backgroundImage'
                    label='背景图片URL'
                    type='url'
                    fullWidth
                    variant='outlined'
                    value={tempConfigs['site.backgroundImage']}
                    onChange={handleConfigInputChange}
                    placeholder='https://example.com/background.jpg'
                    helperText='输入图片URL，留空则不使用背景图片'
                  />

                  <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      id='background-opacity-slider'
                      gutterBottom
                    >
                      背景蒙版透明度: {Number(tempConfigs['site.backgroundOpacity']).toFixed(2)}
                    </Typography>
                    <Slider
                      aria-labelledby='background-opacity-slider'
                      name='site.backgroundOpacity'
                      min={0}
                      max={1}
                      step={0.01}
                      valueLabelDisplay='auto'
                      value={Number(tempConfigs['site.backgroundOpacity'])}
                      onChange={(_, value) => {
                        setTempConfigs({
                          ...tempConfigs,
                          'site.backgroundOpacity': String(value),
                        });
                      }}
                    />
                    <Typography variant='caption' color='text.secondary'>
                      值越大，背景图片越清晰，内容可能越难看清
                    </Typography>
                  </Box>
                </Box>
                {/* 搜索框功能设置 */}
                <Box sx={{ mb: 1 }}>
                  <Typography variant='subtitle1' gutterBottom>
                    搜索框功能设置
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={tempConfigs['site.searchBoxEnabled'] === 'true'}
                        onChange={(e) =>
                          setTempConfigs({
                            ...tempConfigs,
                            'site.searchBoxEnabled': e.target.checked ? 'true' : 'false',
                          })
                        }
                        color='primary'
                      />
                    }
                    label={
                      <Box>
                        <Typography variant='body1'>启用搜索框</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          控制是否在页面中显示搜索框功能
                        </Typography>
                      </Box>
                    }
                  />
                  {tempConfigs['site.searchBoxEnabled'] === 'true' && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={tempConfigs['site.searchBoxGuestEnabled'] === 'true'}
                          onChange={(e) =>
                            setTempConfigs({
                              ...tempConfigs,
                              'site.searchBoxGuestEnabled': e.target.checked ? 'true' : 'false',
                            })
                          }
                          color='primary'
                        />
                      }
                      label={
                        <Box>
                          <Typography variant='body1'>访客可用搜索框</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            允许未登录的访客使用搜索功能
                          </Typography>
                        </Box>
                      }
                      sx={{ ml: 4, mt: 1 }}
                    />
                  )}
                </Box>
                <TextField
                  margin='dense'
                  id='site-custom-css'
                  name='site.customCss'
                  label='自定义CSS'
                  type='text'
                  fullWidth
                  multiline
                  rows={6}
                  variant='outlined'
                  value={tempConfigs['site.customCss']}
                  onChange={handleConfigInputChange}
                  placeholder='/* 自定义样式 */\nbody { }'
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseConfig} variant='outlined'>
                取消
              </Button>
              <Button onClick={handleSaveConfig} variant='contained' color='primary'>
                保存设置
              </Button>
            </DialogActions>
          </Dialog>

          {/* 导入数据对话框 */}
          <Dialog
            open={openImport}
            onClose={handleCloseImport}
            maxWidth='sm'
            fullWidth
            PaperProps={{
              sx: {
                m: { xs: 2, sm: 'auto' },
                width: { xs: 'calc(100% - 32px)', sm: 'auto' },
              },
            }}
          >
            <DialogTitle>
              导入数据
              <IconButton
                aria-label='close'
                onClick={handleCloseImport}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                请选择要导入的JSON文件，导入将覆盖现有数据。
              </DialogContentText>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant='outlined'
                  component='label'
                  startIcon={<FileUploadIcon />}
                  sx={{ mb: 2 }}
                >
                  选择文件
                  <input type='file' hidden accept='.json' onChange={handleFileSelect} />
                </Button>
                {importFile && (
                  <Typography variant='body2' sx={{ mt: 1 }}>
                    已选择: {importFile.name}
                  </Typography>
                )}
              </Box>
              {importError && (
                <Alert severity='error' sx={{ mb: 2 }}>
                  {importError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={handleCloseImport} variant='outlined'>
                取消
              </Button>
              <Button
                onClick={handleImportData}
                variant='contained'
                color='primary'
                disabled={!importFile || importLoading}
                startIcon={importLoading ? <CircularProgress size={20} /> : <FileUploadIcon />}
              >
                {importLoading ? '导入中...' : '导入'}
              </Button>
            </DialogActions>
          </Dialog>


        </Container>
        <ScrollTop>
          <Fab size="large" aria-label="scroll back to top" color="primary">
            <KeyboardArrowUpIcon fontSize="large" />
          </Fab>
        </ScrollTop>
      </Box>
      {/* AI 智能问答悬浮窗 */}
      {isAuthenticated && <AIChatPanel api={api} username={username} />}
    </ThemeProvider>
  );
}

export default App;
