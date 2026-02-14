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
    ListItemSecondaryAction,
    IconButton,
    Typography,
    Box,
    CircularProgress,
    Tooltip
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import { Site } from '../API/http';
import { NavigationClient } from '../API/client';
import { MockNavigationClient } from '../API/mock';

interface RecycleBinProps {
    open: boolean;
    onClose: () => void;
    onRestore: (site: Site) => void; // Callback to refresh main list
    api: NavigationClient | MockNavigationClient;
}

const RecycleBin: React.FC<RecycleBinProps> = ({ open, onClose, onRestore, api }) => {
    const [deletedSites, setDeletedSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

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
        }
    }, [open]);

    const handleRestore = async (site: Site) => {
        if (!site.id) return;
        setActionLoading(site.id);
        try {
            const restoredSite = await api.restoreSite(site.id);
            if (restoredSite) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
                onRestore(restoredSite); // Trigger refresh of main list
            }
        } catch (error) {
            console.error("Failed to restore site:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeletePermanently = async (site: Site) => {
        if (!site.id) return;
        if (!confirm(`Are you sure you want to permanently delete "${site.name}"? This action cannot be undone.`)) return;

        setActionLoading(site.id);
        try {
            const success = await api.deleteSitePermanently(site.id);
            if (success) {
                setDeletedSites(prev => prev.filter(s => s.id !== site.id));
            }
        } catch (error) {
            console.error("Failed to delete site permanently:", error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>书签回收站</DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : deletedSites.length === 0 ? (
                    <Typography align="center" color="text.secondary" sx={{ py: 3 }}>
                        回收站是空的
                    </Typography>
                ) : (
                    <List>
                        {deletedSites.map((site) => (
                            <ListItem key={site.id} divider>
                                <ListItemText
                                    primary={site.name}
                                    secondary={site.url}
                                    primaryTypographyProps={{ noWrap: true }}
                                    secondaryTypographyProps={{ noWrap: true }}
                                />
                                <ListItemSecondaryAction>
                                    <Tooltip title="恢复">
                                        <IconButton
                                            edge="end"
                                            aria-label="restore"
                                            onClick={() => handleRestore(site)}
                                            disabled={actionLoading === site.id}
                                            color="primary"
                                            sx={{ mr: 1 }}
                                        >
                                            <RestoreFromTrashIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="彻底删除">
                                        <IconButton
                                            edge="end"
                                            aria-label="delete"
                                            onClick={() => handleDeletePermanently(site)}
                                            disabled={actionLoading === site.id}
                                            color="error"
                                        >
                                            <DeleteForeverIcon />
                                        </IconButton>
                                    </Tooltip>
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>关闭</Button>
            </DialogActions>
        </Dialog>
    );
};

export default RecycleBin;
