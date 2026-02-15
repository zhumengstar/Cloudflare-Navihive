import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    TextField,
    IconButton,
    FormControlLabel,
    Switch,
    Box,
    Typography,
    CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface AddGroupDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string, isPublic: number) => Promise<boolean>;
}

const AddGroupDialog: React.FC<AddGroupDialogProps> = ({
    open,
    onClose,
    onSubmit
}) => {
    const [name, setName] = useState('');
    const [isPublic, setIsPublic] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 每次打开时重置状态
    useEffect(() => {
        if (open) {
            setName('');
            setIsPublic(1);
            setError(null);
            setLoading(false);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (!name.trim()) {
            setError('分组名称不能为空');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const success = await onSubmit(name.trim(), isPublic);
            if (success) {
                // 成功后由父组件关闭
            } else {
                // 失败通常由父组件 toast 处理，但这里也可以 set error
                setLoading(false);
            }
        } catch (err) {
            console.error(err);
            setLoading(false);
            setError('创建失败，请重试');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
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
                {!loading && (
                    <IconButton
                        aria-label='close'
                        onClick={onClose}
                        sx={{
                            position: 'absolute',
                            right: 8,
                            top: 8,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>请输入新分组的信息</DialogContentText>
                <TextField
                    autoFocus
                    margin='dense'
                    id='group-name'
                    label='分组名称'
                    type='text'
                    fullWidth
                    variant='outlined'
                    value={name}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    error={!!error}
                    helperText={error}
                    disabled={loading}
                    sx={{ mb: 2 }}
                />

                {/* 公开/私密开关 */}
                <FormControlLabel
                    control={
                        <Switch
                            checked={isPublic !== 0}
                            onChange={(e) => setIsPublic(e.target.checked ? 1 : 0)}
                            color='primary'
                            disabled={loading}
                        />
                    }
                    label={
                        <Box>
                            <Typography variant='body1'>
                                {isPublic !== 0 ? '公开分组' : '私密分组'}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                                {isPublic !== 0
                                    ? '所有访客都可以看到此分组'
                                    : '只有管理员登录后才能看到此分组'}
                            </Typography>
                        </Box>
                    }
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} variant='outlined' disabled={loading}>
                    取消
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    color='primary'
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {loading ? '创建中...' : '创建'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default React.memo(AddGroupDialog);
