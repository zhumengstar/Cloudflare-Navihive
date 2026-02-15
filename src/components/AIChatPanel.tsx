import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Fab,
    Paper,
    Typography,
    TextField,
    IconButton,
    Avatar,
    Zoom,
    Slide,
    useTheme,
    CircularProgress,
    ClickAwayListener,
    MenuItem,
    Popover,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    SmartToy as SmartToyIcon,
    Close as CloseIcon,
    Send as SendIcon,
    Person as PersonIcon,
    DeleteOutline as DeleteIcon,
    KeyboardArrowUp as UpIcon,
    KeyboardArrowDown as DownIcon,
    BookmarkAdd as BookmarkAddIcon,
} from '@mui/icons-material';

const DEFAULT_MESSAGES: ChatMessage[] = [
    {
        role: 'assistant',
        content: '你好！我是 NaviHive 智能助手 🤖\n我可以帮你搜索书签、推荐网站，或回答其他问题。',
    },
];

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatPanelProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
    username: string;
    groups: any[];
    onAddSite: (site: any) => Promise<boolean>;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ api, username, groups, onAddSite }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);

    // Lazy initialization from localStorage
    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        try {
            const saved = localStorage.getItem(`chat_history_${username}`);
            return saved ? JSON.parse(saved) : DEFAULT_MESSAGES;
        } catch (e) {
            console.error('Failed to load chat history:', e);
            return DEFAULT_MESSAGES;
        }
    });

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const isDark = theme.palette.mode === 'dark';
    const inputRef = useRef<HTMLInputElement>(null);

    // Bookmark adding state
    const [pendingSite, setPendingSite] = useState<{ name: string, url: string } | null>(null);
    const [anchorPosition, setAnchorPosition] = useState<{ top: number, left: number } | null>(null);

    const handleLinkAddClick = (event: React.MouseEvent<HTMLElement>, title: string, url: string) => {
        event.stopPropagation();
        event.preventDefault();
        setPendingSite({ name: title, url });
        setAnchorPosition({
            top: event.clientY,
            left: event.clientX,
        });
    };

    const handleGroupSelect = (groupId: number) => {
        if (pendingSite && onAddSite) {
            // 立即清理状态并关闭菜单，实现无感交互
            const siteToAdd = { ...pendingSite, groupId };
            setAnchorPosition(null);
            setPendingSite(null);

            // 在后台执行异步添加操作
            onAddSite(siteToAdd).then(success => {
                if (success) {
                    // 成功反馈已在 App.tsx 中通过 snackbar 处理
                }
            }).catch(error => {
                console.error('Background bookmark addition failed:', error);
            });
        } else {
            setAnchorPosition(null);
            setPendingSite(null);
        }
    };

    // Save to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`chat_history_${username}`, JSON.stringify(messages));
        }
    }, [messages, username]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        scrollRef.current?.scrollIntoView({ behavior });
    };

    const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
        topRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (open) {
            if (inputRef.current) {
                setTimeout(() => inputRef.current?.focus(), 300);
            }
            // Use 'auto' (instant) for initial open scroll
            scrollToBottom('auto');
        }
    }, [open]);

    const handleClearHistory = () => {
        setMessages(DEFAULT_MESSAGES);
        localStorage.removeItem(`chat_history_${username}`);
    };

    const handleSend = async () => {
        const trimmed = input.trim();
        if (!trimmed || loading) return;

        const userMessage: ChatMessage = { role: 'user', content: trimmed };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const history = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            let fullReply = '';

            if (api.chatStream) {
                await api.chatStream(trimmed, history, (text: string) => {
                    fullReply += text;
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];

                        // Check if we already have an assistant placeholder
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = fullReply;
                            return newMessages;
                        } else {
                            // First chunk: add the assistant message
                            return [...prev, { role: 'assistant', content: fullReply }];
                        }
                    });
                });
            } else {
                // 降级兼容
                const result = await api.chat(trimmed, history);
                if (result.success && result.reply) {
                    setMessages((prev) => [
                        ...prev,
                        { role: 'assistant', content: result.reply! },
                    ]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: 'assistant',
                            content: result.message || '抱歉，我暂时无法回答。',
                        },
                    ]);
                }
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: '网络错误，请检查连接后重试。',
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 宽度调整逻辑
    const [chatWidth, setChatWidth] = useState(() => {
        const saved = localStorage.getItem(`chat_width_${username}`);
        return saved ? parseInt(saved) : 380;
    });
    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef<number>(0);
    const startWidthRef = useRef<number>(chatWidth);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        startXRef.current = e.clientX;
        startWidthRef.current = chatWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const delta = startXRef.current - e.clientX;
            const newWidth = Math.min(Math.max(300, startWidthRef.current + delta), 800);
            setChatWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem(`chat_width_${username}`, chatWidth.toString());
            }
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, chatWidth, username]);

    return (
        <ClickAwayListener onClickAway={() => open && setOpen(false)}>
            <Box>
                {/* 悬浮按钮 */}
                <Zoom in={!open}>
                    <Fab
                        color="primary"
                        size="large"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(true);
                        }}
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            zIndex: 1200,
                            width: { xs: 48, sm: 56 },
                            height: { xs: 48, sm: 56 },
                            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                            '&:hover': {
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                                transform: 'scale(1.05)',
                            },
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <SmartToyIcon fontSize="large" />
                    </Fab>
                </Zoom>

                {/* 聊天面板 */}
                <Slide direction="up" in={open} mountOnEnter unmountOnExit>
                    <Paper
                        elevation={12}
                        sx={{
                            position: 'fixed',
                            bottom: 16,
                            right: 16,
                            width: { xs: 'calc(100vw - 32px)', sm: chatWidth },
                            height: { xs: 'calc(100vh - 100px)', sm: 520 },
                            zIndex: 1300,
                            borderRadius: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            transition: isResizing ? 'none' : 'width 0.2s ease-out, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                    >
                        {/* 调整宽度手柄 (左侧) */}
                        <Box
                            onMouseDown={handleMouseDown}
                            sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: 'ew-resize',
                                zIndex: 10,
                                '&:hover': {
                                    bgcolor: 'rgba(25, 118, 210, 0.1)',
                                },
                            }}
                        />
                        {/* 头部 */}
                        <Box
                            sx={{
                                px: 2,
                                py: 1.5,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                                color: '#fff',
                                flexShrink: 0,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SmartToyIcon sx={{ fontSize: 22 }} />
                                <Typography variant="subtitle1" fontWeight="bold">
                                    智能助手
                                </Typography>
                            </Box>
                            <Box>
                                <IconButton
                                    size="small"
                                    onClick={handleClearHistory}
                                    title="清空记录"
                                    sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' }, mr: 0.5 }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => setOpen(false)}
                                    sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* 消息列表 */}
                        <Box
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                px: 2,
                                py: 1.5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1.5,
                                bgcolor: isDark ? '#1a1a2e' : '#f8f9fc',
                                '&::-webkit-scrollbar': { width: 5 },
                                '&::-webkit-scrollbar-thumb': {
                                    bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    borderRadius: 3,
                                },
                            }}
                        >
                            <div ref={topRef} />
                            {messages.map((msg, idx) => (
                                <Box
                                    key={idx}
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <Avatar
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            bgcolor:
                                                msg.role === 'user'
                                                    ? theme.palette.primary.main
                                                    : theme.palette.secondary.main,
                                            fontSize: 16,
                                            flexShrink: 0,
                                            mt: 0.5,
                                        }}
                                    >
                                        {msg.role === 'user' ? (
                                            <PersonIcon sx={{ fontSize: 18 }} />
                                        ) : (
                                            <SmartToyIcon sx={{ fontSize: 18 }} />
                                        )}
                                    </Avatar>
                                    <Box
                                        sx={{
                                            maxWidth: '80%',
                                            px: 1.5,
                                            py: 1,
                                            borderRadius: 2,
                                            bgcolor:
                                                msg.role === 'user'
                                                    ? theme.palette.primary.main
                                                    : isDark
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : '#fff',
                                            color:
                                                msg.role === 'user'
                                                    ? '#fff'
                                                    : theme.palette.text.primary,
                                            boxShadow: msg.role === 'user'
                                                ? 'none'
                                                : `0 1px 3px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                                            overflowWrap: 'break-word',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                '& p': { m: 0, lineHeight: 1.6, fontSize: '0.85rem', overflowWrap: 'break-word', wordBreak: 'break-word' },
                                                '& p + p': { mt: 1 },
                                                '& ul, & ol': { m: 0, pl: 2.5, mt: 0.5 },
                                                '& li': { mb: 0.5 },
                                                '& code': {
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                                    px: 0.6,
                                                    py: 0.2,
                                                    borderRadius: 1,
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.8em',
                                                },
                                                '& strong': {
                                                    fontWeight: 700,
                                                    color: isDark ? '#fff' : '#000',
                                                },
                                                '& em': {
                                                    fontStyle: 'italic',
                                                },
                                                '& pre': {
                                                    bgcolor: isDark ? 'rgba(0,0,0,0.3)' : '#f5f5f5',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    overflowX: 'auto',
                                                    my: 1,
                                                    '& code': {
                                                        bgcolor: 'transparent',
                                                        p: 0,
                                                        color: isDark ? '#e0e0e0' : '#333',
                                                    },
                                                },
                                                '& a': {
                                                    color: msg.role === 'user'
                                                        ? '#fff'
                                                        : theme.palette.primary.main,
                                                    textDecoration: 'underline',
                                                },
                                                '& table': {
                                                    borderCollapse: 'collapse',
                                                    width: '100%',
                                                    my: 1,
                                                },
                                                '& th, & td': {
                                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                                                    px: 1,
                                                    py: 0.5,
                                                    fontSize: '0.85rem',
                                                },
                                                '& th': {
                                                    bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                                    fontWeight: 600,
                                                },
                                            }}
                                        >
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    a: ({ node, children, ...props }) => (
                                                        <Box
                                                            component="span"
                                                            sx={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 0.5,
                                                                verticalAlign: 'middle',
                                                                '&:hover .add-link-btn': {
                                                                    opacity: 1,
                                                                    visibility: 'visible',
                                                                },
                                                            }}
                                                        >
                                                            <a
                                                                {...props}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    color: msg.role === 'user' ? '#fff' : theme.palette.primary.main,
                                                                    textDecoration: 'underline'
                                                                }}
                                                            >
                                                                {children}
                                                            </a>
                                                            <IconButton
                                                                className="add-link-btn"
                                                                size="small"
                                                                onClick={(e) => handleLinkAddClick(e, String(children), props.href || '')}
                                                                title="添加到书签"
                                                                sx={{
                                                                    width: 20,
                                                                    height: 20,
                                                                    p: 0,
                                                                    opacity: 0,
                                                                    visibility: 'hidden',
                                                                    transition: 'all 0.2s ease',
                                                                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                                                    '&:hover': {
                                                                        color: msg.role === 'user' ? '#fff' : 'primary.main',
                                                                        transform: 'scale(1.2)',
                                                                    },
                                                                }}
                                                            >
                                                                <BookmarkAddIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Box>
                                                    )
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </Box>
                                    </Box>
                                </Box>
                            ))}
                            {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <Avatar
                                        sx={{
                                            width: 30,
                                            height: 30,
                                            bgcolor: theme.palette.secondary.main,
                                            fontSize: 16,
                                            flexShrink: 0,
                                            mt: 0.5,
                                        }}
                                    >
                                        <SmartToyIcon sx={{ fontSize: 18 }} />
                                    </Avatar>
                                    <Box
                                        sx={{
                                            px: 2,
                                            py: 1.5,
                                            borderRadius: 2,
                                            bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                                            boxShadow: `0 1px 3px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <CircularProgress size={16} />
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                            思考中...
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            <div ref={scrollRef} />

                            {/* 滚动控制按钮 */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 80,
                                    right: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    zIndex: 10,
                                }}
                            >
                                <IconButton
                                    onClick={() => scrollToTop()}
                                    title="回到顶部"
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        backdropFilter: 'blur(8px)',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,1)' },
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    }}
                                >
                                    <UpIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                                <IconButton
                                    onClick={() => scrollToBottom()}
                                    title="回到底部"
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        backdropFilter: 'blur(8px)',
                                        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,1)' },
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    }}
                                >
                                    <DownIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* 输入区域 */}
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.5,
                                display: 'flex',
                                gap: 1,
                                alignItems: 'flex-end',
                                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                bgcolor: isDark ? '#16213e' : '#fff',
                                flexShrink: 0,
                            }}
                        >
                            <TextField
                                inputRef={inputRef}
                                fullWidth
                                size="small"
                                multiline
                                maxRows={3}
                                placeholder="输入你的问题..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        fontSize: '0.875rem',
                                    },
                                }}
                            />
                            <IconButton
                                color="primary"
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                sx={{
                                    bgcolor: theme.palette.primary.main,
                                    color: '#fff',
                                    width: 36,
                                    height: 36,
                                    '&:hover': {
                                        bgcolor: theme.palette.primary.dark,
                                    },
                                    '&.Mui-disabled': {
                                        bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                        color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                                    },
                                }}
                            >
                                <SendIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Box>

                        {/* 分组选择菜单 */}
                        <Popover
                            open={Boolean(anchorPosition)}
                            anchorReference="anchorPosition"
                            anchorPosition={anchorPosition || undefined}
                            onClose={() => {
                                setAnchorPosition(null);
                            }}
                            disableScrollLock
                            slotProps={{
                                paper: {
                                    sx: {
                                        maxHeight: 300,
                                        width: '20ch',
                                        borderRadius: 2,
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                        bgcolor: theme.palette.background.paper,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    },
                                }
                            }}
                        >
                            <Box
                                sx={{
                                    p: 0,
                                    position: 'sticky',
                                    top: 0,
                                    bgcolor: theme.palette.background.paper,
                                    zIndex: 1,
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                }}
                            >
                                <Box sx={{ px: 2, py: 1.2 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                        选择存入分组
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ py: 0.5, overflowY: 'auto' }}>
                                {groups.map((group) => (
                                    <MenuItem
                                        key={group.id}
                                        onClick={() => handleGroupSelect(group.id)}
                                        sx={{
                                            fontSize: '0.85rem',
                                            py: 1,
                                            px: 2,
                                        }}
                                    >
                                        {group.name}
                                    </MenuItem>
                                ))}
                            </Box>
                        </Popover>
                    </Paper>
                </Slide>
            </Box>
        </ClickAwayListener>
    );
};

export default AIChatPanel;
