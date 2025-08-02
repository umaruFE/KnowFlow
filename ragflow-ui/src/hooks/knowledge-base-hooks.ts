import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'umi'; 
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import knowledgeBaseService from '@/services/knowledge-base-service';
// ▼▼▼ 核心修复：引入 chatService 以便使用其删除功能 ▼▼▼
import chatService from '@/services/chat-service';
import { getConversationId } from '@/utils/chat';
import api from '@/utils/api';

// 定义消息类型接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
}

// 定义存储在 sessionStorage 中的数据结构
interface SessionChatInfo {
  dialogId: string;
  conversationId: string;
}

export const useKnowledgeBaseChat = () => {
  // --- 调试阶段 1: Hook 初始化 ---
  console.log('[调试] 1. useKnowledgeBaseChat hook 开始初始化...');

  const [searchParams] = useSearchParams();
  const kbId = searchParams.get('id');

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const dialogIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // 在组件加载时，尝试从 sessionStorage 恢复对话
  useEffect(() => {
    if (kbId) {
      const sessionKey = `knowledge-chat-${kbId}`;
      const storedSession = sessionStorage.getItem(sessionKey);
      if (storedSession) {
        try {
          const sessionInfo: SessionChatInfo = JSON.parse(storedSession);
          if (sessionInfo.dialogId && sessionInfo.conversationId) {
            console.log(`[调试] 从 sessionStorage 成功恢复对话，ID: ${sessionInfo.conversationId}`);
            dialogIdRef.current = sessionInfo.dialogId;
            conversationIdRef.current = sessionInfo.conversationId;
          }
        } catch (e) {
          console.error("解析 sessionStorage 失败:", e);
          sessionStorage.removeItem(sessionKey);
        }
      }
    }
  }, [kbId]);

  // 在组件卸载时，自动清理临时对话
  useEffect(() => {
    return () => {
      const sessionKey = `knowledge-chat-${kbId}`;
      const storedSession = sessionStorage.getItem(sessionKey);

      if (storedSession) {
        try {
          const sessionInfo: SessionChatInfo = JSON.parse(storedSession);
          const { dialogId, conversationId } = sessionInfo;

          if (dialogId && conversationId) {
            console.log(`[调试] 页面卸载，准备清理临时对话... Dialog ID: ${dialogId}`);
            
            // ▼▼▼ 核心修复：使用 chatService 中已有的删除方法 ▼▼▼
            chatService.removeConversation({
              conversationIds: [conversationId],
              dialogId: dialogId,
            }).catch(err => console.error("清理 conversation 失败:", err));

            chatService.removeDialog({
              dialogIds: [dialogId],
            }).catch(err => console.error("清理 dialog 失败:", err));
            // ▲▲▲ 核心修复：使用 chatService 中已有的删除方法 ▲▲▲

            sessionStorage.removeItem(sessionKey);
            console.log(`[调试] 清理 sessionStorage key: ${sessionKey}`);
          }
        } catch (e) {
          console.error("解析或清理 sessionStorage 失败:", e);
        }
      }
    };
  }, [kbId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const initializeSessionMutation = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      const dialogPayload = {
        dialog_id: '',
        name: `Temp_Dialog_For_KB_${knowledgeBaseId}_${Date.now()}`,
        description: `Temporary chat for knowledge base: ${knowledgeBaseId}`,
        icon: "",
        kb_ids: [knowledgeBaseId],
        llm_id: 'DeepSeek-R1-Distill-Qwen-32B___OpenAI-API@OpenAI-API-Compatible',
        prompt_config: {
          system: "You are a helpful AI assistant. You will answer user's questions based on the context provided. If you don't know the answer, just say you don't know. Don't make up an answer.",
          prologue: "Hi, how can I help you?",
          parameters: [
            { key: "temperature", value: 0.9, optional: true }, 
            { key: "top_p", value: 0.9, optional: true }, 
            { key: "max_tokens", value: 2048, optional: true }
          ]
        },
      };

      const dialogRes = await knowledgeBaseService.createTemporaryDialog(dialogPayload);
      const tempDialogId = dialogRes?.data?.data?.id; 
      
      if (!tempDialogId) throw new Error("未能从创建Dialog的API响应中获取ID。");
      
      const newConversationId = getConversationId();
      await knowledgeBaseService.createConversation({
        conversation_id: newConversationId,
        dialog_id: tempDialogId,
        name: 'Initial Conversation',
        is_new: true,
      });

      return { dialogId: tempDialogId, conversationId: newConversationId };
    },
    onSuccess: (sessionInfo) => {
      console.log('✅ 新对话初始化成功，ID:', sessionInfo.conversationId);
      dialogIdRef.current = sessionInfo.dialogId;
      conversationIdRef.current = sessionInfo.conversationId;

      if (kbId) {
        const sessionKey = `knowledge-chat-${kbId}`;
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionInfo));
      }

      setMessages([{ role: 'assistant', content: `你好！关于此知识库的问题，随时可以问我。` }]);
    },
    onError: (error: any) => {
      console.error('❌ 对话初始化失败:', error);
      message.error(`对话创建失败: ${error.message || "未知错误"}`);
    },
  });

  const parseThinkingAndAnswer = (rawText: string): { thinking: string | null; answer: string } => {
    const thinkTagStart = '<think>';
    const thinkTagEnd = '</think>';
    const startIndex = rawText.indexOf(thinkTagStart);
    const endIndex = rawText.lastIndexOf(thinkTagEnd);

    if (startIndex !== -1 && endIndex > startIndex) {
      const thinking = rawText.substring(startIndex + thinkTagStart.length, endIndex).trim();
      const answer = rawText.substring(endIndex + thinkTagEnd.length).trim();
      return { thinking, answer };
    }
    
    return { thinking: null, answer: rawText };
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { conversationId: string; query: string }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: '', thinking: '' }]);

      const payload = {
        conversation_id: params.conversationId,
        dialog_id: dialogIdRef.current,
        messages: [{ role: 'user', content: params.query }],
      };

      const token = localStorage.getItem('Authorization');
      
      const response = await fetch(api.completeConversation, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('Response body is null');

      // ▼▼▼ 核心修复：使用缓冲区来处理不完整的流数据块 ▼▼▼
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const boundary = '\n\n';
        let boundaryIndex = buffer.indexOf(boundary);

        while (boundaryIndex !== -1) {
          const message = buffer.substring(0, boundaryIndex);
          buffer = buffer.substring(boundaryIndex + boundary.length);

          if (message.startsWith('data:')) {
            try {
              const jsonStr = message.substring(5);
              if (jsonStr) {
                const parsedData = JSON.parse(jsonStr);
                if (parsedData.data && parsedData.data.answer) {
                  const rawAnswer = parsedData.data.answer;
                  const { thinking, answer } = parseThinkingAndAnswer(rawAnswer);
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    lastMessage.content = answer; 
                    if (thinking) {
                      lastMessage.thinking = thinking; 
                    }
                    return newMessages;
                  });
                }
              }
            } catch (e) {
              console.error('Error parsing stream chunk:', e, 'Chunk:', message);
            }
          }
          boundaryIndex = buffer.indexOf(boundary);
        }
      }
      // ▲▲▲ 核心修复：使用缓冲区来处理不完整的流数据块 ▲▲▲
    },
    onSuccess: () => {
      console.log('✅ 消息流接收完毕。');
    },
    onError: (error) => {
      console.error('❌ 消息发送/流处理失败:', error);
      message.error('消息发送失败。');
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const isLoading = initializeSessionMutation.isPending || sendMessageMutation.isPending;

  const handleOpen = useCallback(() => {
    if (!kbId) {
      message.error('无法初始化对话：未在URL中找到知识库ID。');
      return;
    }

    if (!isOpen) {
      setIsOpen(true);
      if (!conversationIdRef.current) {
        initializeSessionMutation.mutate(kbId);
      }
    }
  }, [isOpen, kbId, initializeSessionMutation]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleSendMessage = useCallback(() => {
    const currentConversationId = conversationIdRef.current;
    if (!inputValue.trim() || !currentConversationId || isLoading) return;
    
    const messageToSend = inputValue;
    setMessages((prev) => [...prev, { role: 'user', content: messageToSend }]);
    setInputValue('');
    
    sendMessageMutation.mutate({
      conversationId: currentConversationId,
      query: messageToSend,
    });
  }, [inputValue, isLoading, sendMessageMutation]);
  
  return {
    isOpen,
    messages,
    inputValue,
    isLoading,
    inputRef,
    messagesEndRef,
    handleOpen,
    handleClose,
    handleSendMessage,
    setInputValue,
  };
};