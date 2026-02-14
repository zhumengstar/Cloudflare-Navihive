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
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    SmartToy as SmartToyIcon,
    Close as CloseIcon,
    Send as SendIcon,
    Person as PersonIcon,
    DeleteOutline as DeleteIcon,
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
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ api, username }) => {
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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Save to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(`chat_history_${username}`, JSON.stringify(messages));
        }
    }, [messages, username]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
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

    const isDark = theme.palette.mode === 'dark';

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
        <>
            {/* 悬浮按钮 */}
            <Zoom in={!open}>
                <Fab
                    color="primary"
                    size="large"
                    onClick={() => setOpen(true)}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        right: 16,
                        zIndex: 1200,
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
                        bottom: 24,
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
                                                a: ({ node, ...props }) => (
                                                    <a
                                                        {...props}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
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
                        <div ref={messagesEndRef} />
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
                </Paper>
            </Slide>
        </>
    );
};

export default AIChatPanel;
