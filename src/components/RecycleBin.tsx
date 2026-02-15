import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Tooltip,
    Checkbox,
    ListItemIcon,
    ListItemButton,
    Stack,
    TextField,
    InputAdornment
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { Site } from '../API/http';
import { NavigationClient } from '../API/client';
import { MockNavigationClient } from '../API/mock';

interface RecycleBinProps {
    open: boolean;
    onClose: () => void;
    onRestore: (site: Site | Site[]) => void; // Updated to handle multiple sites
    api: NavigationClient | MockNavigationClient;
}

const HighlightText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <Box component="span" key={i} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: '2px', px: '2px' }}>
                        {part}
                    </Box>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const RecycleBin: React.FC<RecycleBinProps> = ({ open, onClose, onRestore, api }) => {
    const [deletedSites, setDeletedSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | 'batch' | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const fetchDeletedSites = async () => {
        setLoading(true);
        try {
            const sites = await api.getTrashSites();
            setDeletedSites(sites);
        } catch (error) {
            console.error("Failed to fetch trash sites:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchDeletedSites();
            setSelectedIds(new Set());
            setSearchQuery('');
        }
    }, [open]);

    const filteredSites = deletedSites.filter(site =>
        site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        site.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        const currentFilteredIds = filteredSites.map(s => s.id as number);
        const allFilteredSelected = currentFilteredIds.every(id => selectedIds.has(id));

        const newSelected = new Set(selectedIds);
        if (allFilteredSelected) {
            // Unselect all in current filter
            currentFilteredIds.forEach(id => newSelected.delete(id));
        } else {
            // Select all in current filter
            currentFilteredIds.forEach(id => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    };

    const handleRestore = async (site: Site) => {
        if (!site.id) return;
        setActionLoading(site.id);
        try {
            const restoredSite = await api.restoreSite(site.id);
            if (restoredSite) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(site.id as number);
                    return next;
                });
                onRestore(restoredSite);
            }
        } catch (error) {
            console.error("Failed to restore site:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleBatchRestore = async () => {
        if (selectedIds.size === 0) return;
        setActionLoading('batch');
        const ids = Array.from(selectedIds);
        try {
            const success = await api.restoreSites(ids);
            if (success) {
                const restoredSites = deletedSites.filter(s => selectedIds.has(s.id as number));
                setDeletedSites(prev => prev.filter(s => !selectedIds.has(s.id as number)));
                setSelectedIds(new Set());
                onRestore(restoredSites);
            }
        } catch (error) {
            console.error("Failed to restore sites:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeletePermanently = async (site: Site) => {
        if (!site.id) return;

        setActionLoading(site.id);
        try {
            const success = await api.deleteSitePermanently(site.id);
            if (success) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    next.delete(site.id as number);
                    return next;
                });
            }
        } catch (error) {
            console.error("Failed to delete site permanently:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleBatchDeletePermanently = async () => {
        if (selectedIds.size === 0) return;

        setActionLoading('batch');
        const ids = Array.from(selectedIds);
        try {
            const success = await api.deleteSitesPermanently(ids);
            if (success) {
                setDeletedSites(prev => prev.filter(s => !selectedIds.has(s.id as number)));
                setSelectedIds(new Set());
            }
        } catch (error) {
            console.error("Failed to delete sites permanently:", error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    书签回收站
                    {selectedIds.size > 0 && (
                        <Typography variant="body1" color="primary" sx={{ ml: 2, fontWeight: 'bold' }}>
                            已选中 {selectedIds.size} 项
                        </Typography>
                    )}
                </Box>
                {deletedSites.length > 0 && !loading && (
                    <Button
                        size="small"
                        startIcon={
                            filteredSites.length > 0 && filteredSites.every(s => selectedIds.has(s.id as number))
                                ? <DeselectIcon />
                                : <SelectAllIcon />
                        }
                        onClick={handleSelectAll}
                        disabled={filteredSites.length === 0}
                    >
                        {filteredSites.length > 0 && filteredSites.every(s => selectedIds.has(s.id as number))
                            ? '取消全选'
                            : '全选'}
                    </Button>
                )}
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="搜索已删除的书签名称或链接..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                    />
                </Box>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                        <CircularProgress />
                    </Box>
                ) : deletedSites.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="h6" color="text.secondary">
                            回收站是空的
                        </Typography>
                    </Box>
                ) : filteredSites.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography variant="h6" color="text.secondary">
                            未找到匹配的书签
                        </Typography>
                    </Box>
                ) : (
                    <List sx={{ pt: 0, overflowY: 'auto', flex: 1 }}>
                        {filteredSites.map((site) => (
                            <ListItem
                                key={site.id}
                                divider
                                disablePadding
                                sx={{
                                    transition: 'background-color 0.2s',
                                    '&:hover': { bgcolor: 'action.hover' }
                                }}
                                secondaryAction={
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Tooltip title="恢复">
                                            <IconButton
                                                edge="end"
                                                aria-label="restore"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRestore(site);
                                                }}
                                                disabled={actionLoading !== null}
                                                color="primary"
                                                size="medium"
                                            >
                                                <RestoreFromTrashIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="彻底删除">
                                            <IconButton
                                                edge="end"
                                                aria-label="delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeletePermanently(site);
                                                }}
                                                disabled={actionLoading !== null}
                                                color="error"
                                                size="medium"
                                            >
                                                <DeleteForeverIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                }
                            >
                                <ListItemButton
                                    onClick={() => handleToggleSelect(site.id as number)}
                                    sx={{ py: 1.5 }}
                                >
                                    <ListItemIcon sx={{ minWidth: 48 }}>
                                        <Checkbox
                                            edge="start"
                                            checked={selectedIds.has(site.id as number)}
                                            tabIndex={-1}
                                            disableRipple
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelect(site.id as number);
                                            }}
                                            size="medium"
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Tooltip
                                                title={`点击访问: ${site.name}`}
                                                placement="top-start"
                                                enterDelay={500}
                                                slotProps={{
                                                    tooltip: {
                                                        sx: {
                                                            fontSize: '1rem',
                                                            maxWidth: 'none',
                                                            whiteSpace: 'nowrap',
                                                        }
                                                    }
                                                }}
                                            >
                                                <Box
                                                    component="span"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(site.url, '_blank');
                                                    }}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                                    }}
                                                >
                                                    <HighlightText text={site.name} highlight={searchQuery} />
                                                </Box>
                                            </Tooltip>
                                        }
                                        secondary={
                                            <Tooltip
                                                title={`点击访问: ${site.url}`}
                                                placement="top-start"
                                                enterDelay={500}
                                                slotProps={{
                                                    tooltip: {
                                                        sx: {
                                                            fontSize: '1rem',
                                                            maxWidth: 'none',
                                                            whiteSpace: 'nowrap',
                                                        }
                                                    }
                                                }}
                                            >
                                                <Box
                                                    component="span"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        window.open(site.url, '_blank');
                                                    }}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        fontSize: '0.85rem',
                                                        display: 'inline-block',
                                                        maxWidth: '100%',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                                    }}
                                                >
                                                    <HighlightText text={site.url} highlight={searchQuery} />
                                                </Box>
                                            </Tooltip>
                                        }
                                        primaryTypographyProps={{
                                            noWrap: true,
                                            sx: {
                                                fontSize: '1.1rem',
                                                fontWeight: selectedIds.has(site.id as number) ? 700 : 500,
                                                color: 'text.primary'
                                            }
                                        }}
                                        secondaryTypographyProps={{
                                            noWrap: true,
                                            sx: {
                                                fontSize: '0.95rem',
                                                mt: 0.5
                                            }
                                        }}
                                        sx={{ mr: 10 }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 2, py: 1.5, justifyContent: 'space-between' }}>
                <Box>
                    {selectedIds.size > 0 && (
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                startIcon={<RestoreFromTrashIcon />}
                                onClick={handleBatchRestore}
                                disabled={actionLoading !== null}
                            >
                                批量恢复
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteSweepIcon />}
                                onClick={handleBatchDeletePermanently}
                                disabled={actionLoading !== null}
                            >
                                批量彻底删除
                            </Button>
                        </Stack>
                    )}
                </Box>
                <Button onClick={onClose} variant="outlined" color="inherit" size="small">
                    关闭
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default RecycleBin;
