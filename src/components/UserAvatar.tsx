import React, { useState, Suspense } from 'react';
import {
    Avatar,
    Box,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    List,
    ListItem,
    Chip,
    TextField,
    Alert,
    CircularProgress,
    useMediaQuery,
    useTheme,
    Switch,
    FormControlLabel,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import LockResetIcon from '@mui/icons-material/LockReset';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EmailIcon from '@mui/icons-material/Email';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SortIcon from '@mui/icons-material/Sort';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SettingsIcon from '@mui/icons-material/Settings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
const RecycleBin = React.lazy(() => import('./RecycleBin'));
import { Site } from '../API/http';

interface UserAvatarProps {
    username: string;
    onLogout: () => void;
    onChangePassword?: (oldPassword: string, newPassword: string) => Promise<boolean>;
    onSiteRestored: (site: Site | Site[]) => void;
    onStartGroupSort: () => void;
    onStartCrossGroupDrag: () => void;
    onOpenConfig: () => void;
    onExportData: () => void;
    onOpenImport: () => void;
    onOpenAddGroup: () => void;
    configs: Record<string, string>;
    onUpdateConfigs: (newConfigs: Record<string, string>) => Promise<void>;
    onBatchUpdateIcons: () => void;
    onResetData: () => void;
    isAdmin?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
    username,
    onLogout,
    onChangePassword,
    onSiteRestored,
    onStartGroupSort,
    onStartCrossGroupDrag,
    onOpenConfig,
    onExportData,
    onOpenImport,
    onOpenAddGroup,
    configs,
    onUpdateConfigs,
    onBatchUpdateIcons,
    onResetData,
    isAdmin,
    api
}) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    // ... (keep existing state)

    const [infoOpen, setInfoOpen] = useState(false);
    const [changePwdOpen, setChangePwdOpen] = useState(false);
    const [recycleBinOpen, setRecycleBinOpen] = useState(false);
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changePwdLoading, setChangePwdLoading] = useState(false);
    const [changePwdError, setChangePwdError] = useState<string | null>(null);
    const [changePwdSuccess, setChangePwdSuccess] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string>('');
    const [infoLoading, setInfoLoading] = useState(false);
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [editEmail, setEditEmail] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);

    const menuOpen = Boolean(anchorEl);

    const handleAvatarClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleInfoOpen = async () => {
        handleMenuClose();
        setInfoOpen(true);
        setInfoLoading(true);
        try {
            // 需要后端提供获取当前用户信息的接口，或者从 props 传递
            // 这里假设通过 api 获取，如果没实现则捕获错误
            const profile = await api.getUserProfile?.();
            if (profile && profile.email) {
                setUserEmail(profile.email);
            } else {
                // 回退：如果 getUserProfile 未实现，尝试获取全部配置看是否有相关信息
                // 或者在组件挂载时通过 props 传进来更合适。
                // 暂时这里留空，稍后检查 API 定义
            }
        } catch (error) {
            console.error("Failed to fetch user email:", error);
        } finally {
            setInfoLoading(false);
        }
    };

    const handleInfoClose = () => {
        setInfoOpen(false);
        setIsEditingEmail(false);
    };

    const handleUpdateEmail = async () => {
        if (!editEmail.trim()) {
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
            alert('请输入有效的邮箱地址');
            return;
        }

        setUpdateLoading(true);
        try {
            const result = await api.updateUserProfile({ email: editEmail.trim() });
            if (result.success) {
                setUserEmail(editEmail.trim());
                setIsEditingEmail(false);
            } else {
                alert(result.message || '更新邮箱失败');
            }
        } catch (error) {
            console.error('Failed to update email:', error);
            alert('更新邮箱失败');
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleChangePwdOpen = () => {
        handleMenuClose();
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePwdError(null);
        setChangePwdSuccess(null);
        setChangePwdOpen(true);
    };

    const handleChangePwdClose = () => {
        setChangePwdOpen(false);
    };

    const handleChangePwdSubmit = async () => {
        setChangePwdError(null);
        setChangePwdSuccess(null);

        if (!oldPassword) {
            setChangePwdError('请输入当前密码');
            return;
        }
        if (!newPassword) {
            setChangePwdError('请输入新密码');
            return;
        }
        if (newPassword.length < 6) {
            setChangePwdError('新密码长度至少为6个字符');
            return;
        }
        if (newPassword !== confirmPassword) {
            setChangePwdError('两次输入的新密码不一致');
            return;
        }

        if (onChangePassword) {
            setChangePwdLoading(true);
            try {
                const success = await onChangePassword(oldPassword, newPassword);
                if (success) {
                    setChangePwdSuccess('密码修改成功');
                    setTimeout(() => handleChangePwdClose(), 1500);
                } else {
                    setChangePwdError('密码修改失败，请检查当前密码是否正确');
                }
            } catch {
                setChangePwdError('密码修改失败');
            } finally {
                setChangePwdLoading(false);
            }
        }
    };

    const handleRecycleBinOpen = () => {
        handleMenuClose();
        setRecycleBinOpen(true);
    };

    const handleRecycleBinClose = () => {
        setRecycleBinOpen(false);
    };

    const handleRestoreSite = (site: Site | Site[]) => {
        if (onSiteRestored) {
            onSiteRestored(site);
        }
    };

    const handleLogoutClick = () => {
        handleMenuClose();
        onLogout();
    };


    // 基于用户名生成稳定的颜色 (Memoized)
    const avatarColor = React.useMemo(() => {
        const colors = [
            '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
            '#f57c00', '#0097a7', '#5d4037', '#455a64',
            '#e91e63', '#00838f', '#6a1b9a', '#ef6c00',
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }, [username]);

    // 获取用户名首字母 (Memoized)
    const avatarLetter = React.useMemo(() => {
        if (!username) return '?';
        return username.charAt(0).toUpperCase();
    }, [username]);

    const menuItemSx = { py: 1, minHeight: 40 };

    return (
        <>
            <IconButton
                onClick={handleAvatarClick}
                size='small'
                aria-controls={menuOpen ? 'user-menu' : undefined}
                aria-haspopup='true'
                aria-expanded={menuOpen ? 'true' : undefined}
                sx={{ ml: 1 }} // 移除 p:0 增加点击区域，添加 ml:1 保持间距
            >
                <Avatar
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: avatarColor,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s',
                        '&:hover': {
                            boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.3)',
                        },
                    }}
                >
                    {avatarLetter}
                </Avatar>
            </IconButton>

            {/* 用户下拉菜单 */}
            <Menu
                id='user-menu'
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                // 改回左对齐，使其向右展开。
                // 这样看起来就在头像的“右侧”（起始点在左，向右对齐）
                // 同时也避免与左侧标题重叠，并利用右侧空间（如果是居中或者有余地）
                transformOrigin={{ horizontal: 'left', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1.5, // 稍微增加间距
                            minWidth: 200, // 稍微加宽
                            borderRadius: 2,
                            boxShadow: theme.palette.mode === 'dark'
                                ? '0 4px 20px rgba(0,0,0,0.4)'
                                : '0 4px 20px rgba(0,0,0,0.1)',
                        },
                    },
                }}
            >
                {/* 用户名展示区域 */}
                <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar
                        sx={{
                            width: 40,
                            height: 40,
                            bgcolor: avatarColor,
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                        }}
                    >
                        {avatarLetter}
                    </Avatar>
                    <Box>
                        <Typography variant='subtitle2' fontWeight='bold' noWrap sx={{ maxWidth: 140 }}>
                            {username}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                            已登录
                        </Typography>
                    </Box>
                </Box>
                <Divider />
                <MenuItem onClick={handleInfoOpen} sx={menuItemSx}>
                    <ListItemIcon>
                        <InfoOutlinedIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>账号信息</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleRecycleBinOpen} sx={menuItemSx}>
                    <ListItemIcon>
                        <DeleteSweepIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>书签回收站</ListItemText>
                </MenuItem>
                {onChangePassword && (
                    <MenuItem onClick={handleChangePwdOpen} sx={menuItemSx}>
                        <ListItemIcon>
                            <LockResetIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>修改密码</ListItemText>
                    </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onOpenAddGroup(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <CreateNewFolderIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>新增分组</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onStartGroupSort(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <SortIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>分组排序</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onStartCrossGroupDrag(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <SwapHorizIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>书签拖动</ListItemText>
                </MenuItem>
                {isAdmin && (
                    <MenuItem onClick={() => { handleMenuClose(); onOpenConfig(); }} sx={menuItemSx}>
                        <ListItemIcon>
                            <SettingsIcon fontSize='small' />
                        </ListItemIcon>
                        <ListItemText>网站设置</ListItemText>
                    </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onExportData(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <FileDownloadIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>导出数据</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onOpenImport(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <FileUploadIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>导入数据</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); onBatchUpdateIcons(); }} sx={menuItemSx}>
                    <ListItemIcon>
                        <AutoFixHighIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>批量更新图标</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onResetData(); }} sx={{ color: 'error.main', ...menuItemSx }}>
                    <ListItemIcon sx={{ color: 'error.main' }}>
                        <DeleteSweepIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>重置所有数据</ListItemText>
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogoutClick} sx={{ color: 'error.main', ...menuItemSx }}>
                    <ListItemIcon sx={{ color: 'error.main' }}>
                        <LogoutIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>退出登录</ListItemText>
                </MenuItem>
            </Menu>

            {/* 账号信息对话框 - 延迟加载 */}
            {infoOpen && (
                <Dialog
                    open={infoOpen}
                    onClose={handleInfoClose}
                    maxWidth='xs'
                    fullWidth
                    fullScreen={isMobile}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccountCircleIcon color='primary' />
                        账号信息
                    </DialogTitle>
                    <DialogContent>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                py: 2,
                                mb: 2,
                            }}
                        >
                            <Avatar
                                sx={{
                                    width: 72,
                                    height: 72,
                                    bgcolor: avatarColor,
                                    fontSize: '2rem',
                                    fontWeight: 'bold',
                                    mb: 1.5,
                                    flexShrink: 0,
                                }}
                            >
                                {infoLoading ? <CircularProgress size={40} /> : avatarLetter}
                            </Avatar>
                            <Typography variant='h6' fontWeight='bold'>
                                {username}
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        <List dense disablePadding>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <PersonIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='用户名'
                                    secondary={username}
                                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                    secondaryTypographyProps={{ variant: 'body1' }}
                                />
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <EmailIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                {isEditingEmail ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editEmail}
                                            onChange={(e) => setEditEmail(e.target.value)}
                                            placeholder="example@domain.com"
                                            disabled={updateLoading}
                                            autoFocus
                                        />
                                        <Button
                                            size="small"
                                            variant="contained"
                                            onClick={handleUpdateEmail}
                                            disabled={updateLoading || !editEmail.trim() || editEmail === userEmail}
                                        >
                                            保存
                                        </Button>
                                        <Button
                                            size="small"
                                            onClick={() => setIsEditingEmail(false)}
                                            disabled={updateLoading}
                                        >
                                            取消
                                        </Button>
                                    </Box>
                                ) : (
                                    <>
                                        <ListItemText
                                            primary='电子邮箱'
                                            secondary={userEmail || '未设置'}
                                            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                            secondaryTypographyProps={{ variant: 'body1' }}
                                        />
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setEditEmail(userEmail);
                                                setIsEditingEmail(true);
                                            }}
                                        >
                                            修改
                                        </Button>
                                    </>
                                )}
                            </ListItem>
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <InfoOutlinedIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <ListItemText
                                    primary='账号状态'
                                    primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
                                />
                                <Chip label='已登录' color='success' size='small' variant='outlined' />
                            </ListItem>
                            <Divider sx={{ my: 1 }} />
                            <ListItem disablePadding sx={{ py: 0.5 }}>
                                <ListItemIcon sx={{ minWidth: 36 }}>
                                    <DeleteSweepIcon fontSize='small' color='action' />
                                </ListItemIcon>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            size="small"
                                            checked={configs['site.autoCleanDeadLinks'] === 'true'}
                                            onChange={(e) => {
                                                onUpdateConfigs({
                                                    ...configs,
                                                    'site.autoCleanDeadLinks': e.target.checked ? 'true' : 'false'
                                                });
                                            }}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box>
                                            <Typography variant="body2">自动清理死链</Typography>
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                检测到网页无法访问时自动移动到回收站
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ ml: 0, width: '100%' }}
                                />
                            </ListItem>
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleInfoClose}>关闭</Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* 修改密码对话框 - 延迟加载 */}
            {changePwdOpen && (
                <Dialog
                    open={changePwdOpen}
                    onClose={handleChangePwdClose}
                    maxWidth='xs'
                    fullWidth
                    fullScreen={isMobile}
                >
                    <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LockResetIcon color='primary' />
                        修改密码
                    </DialogTitle>
                    <DialogContent>
                        {changePwdError && (
                            <Alert severity='error' sx={{ mb: 2, mt: 1 }}>
                                {changePwdError}
                            </Alert>
                        )}
                        {changePwdSuccess && (
                            <Alert severity='success' sx={{ mb: 2, mt: 1 }}>
                                {changePwdSuccess}
                            </Alert>
                        )}
                        <TextField
                            margin='dense'
                            label='当前密码'
                            type='password'
                            fullWidth
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            disabled={changePwdLoading}
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            margin='dense'
                            label='新密码'
                            type='password'
                            fullWidth
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={changePwdLoading}
                            helperText='至少6个字符'
                            sx={{ mb: 1 }}
                        />
                        <TextField
                            margin='dense'
                            label='确认新密码'
                            type='password'
                            fullWidth
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={changePwdLoading}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleChangePwdClose} disabled={changePwdLoading}>
                            取消
                        </Button>
                        <Button
                            onClick={handleChangePwdSubmit}
                            variant='contained'
                            disabled={changePwdLoading}
                        >
                            {changePwdLoading ? <CircularProgress size={20} /> : '确认修改'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* 回收站 - 延迟加载 */}
            {recycleBinOpen && (
                <Suspense fallback={null}>
                    <RecycleBin
                        open={recycleBinOpen}
                        onClose={handleRecycleBinClose}
                        onRestore={handleRestoreSite}
                        api={api}
                    />
                </Suspense>
            )}
        </>
    );
};

export default UserAvatar;
