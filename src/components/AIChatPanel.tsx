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
import {
    SmartToy as SmartToyIcon,
    Close as CloseIcon,
    Send as SendIcon,
    Person as PersonIcon,
} from '@mui/icons-material';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatPanelProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api: any;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ api }) => {
    const theme = useTheme();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: '你好！我是 NaviHive 智能助手 🤖\n我可以帮你搜索书签、推荐网站，或回答其他问题。',
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [open]);

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

            // 添加一个空的助理消息用于流显示
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: '' },
            ]);

            let fullReply = '';

            if (api.chatStream) {
                await api.chatStream(trimmed, history, (text: string) => {
                    fullReply += text;
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg && lastMsg.role === 'assistant') {
                            lastMsg.content = fullReply;
                        }
                        return newMessages;
                    });
                });
            } else {
                // 降级兼容
                const result = await api.chat(trimmed, history);
                if (result.success && result.reply) {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg) lastMsg.content = result.reply!;
                        return newMessages;
                    });
                } else {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMsg = newMessages[newMessages.length - 1];
                        if (lastMsg) lastMsg.content = result.message || '抱歉，我暂时无法回答。';
                        return newMessages;
                    });
                }
            }
        } catch {
            setMessages((prev) => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg) lastMsg.content = '网络错误，请检查连接后重试。';
                return newMessages;
            });
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

    return (
        <>
            {/* 悬浮按钮 */}
            <Zoom in={!open}>
                <Fab
                    color="primary"
                    onClick={() => setOpen(true)}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        zIndex: 1200,
                        width: 56,
                        height: 56,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                            transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease',
                    }}
                >
                    <SmartToyIcon sx={{ fontSize: 28 }} />
                </Fab>
            </Zoom>

            {/* 聊天面板 */}
            <Slide direction="up" in={open} mountOnEnter unmountOnExit>
                <Paper
                    elevation={12}
                    sx={{
                        position: 'fixed',
                        bottom: 24,
                        right: 24,
                        width: { xs: 'calc(100vw - 32px)', sm: 380 },
                        height: { xs: 'calc(100vh - 100px)', sm: 520 },
                        zIndex: 1300,
                        borderRadius: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    }}
                >
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
                        <IconButton
                            size="small"
                            onClick={() => setOpen(false)}
                            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
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
                                    }}
                                >
                                    <Box
                                        sx={{
                                            '& p': { m: 0, lineHeight: 1.6, fontSize: '0.85rem' },
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
                                        }}
                                    >
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                        {loading && (
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
