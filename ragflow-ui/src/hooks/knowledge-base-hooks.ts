import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'umi'; 
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import knowledgeBaseService from '@/services/knowledge-base-service';
import { getConversationId } from '@/utils/chat';
import api from '@/utils/api'; // 引入api配置文件以获取URL

// 定义消息类型接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string; // 新增：用于存放思考过程
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

  useEffect(() => {
    if (!kbId) {
      console.error('[调试] 严重错误: 未能从URL中获取到知识库ID (kbId)。');
    }
  }, [kbId]);

  console.log(`[调试] 2. Hook 初始状态: kbId=${kbId}, isOpen=${isOpen}`);

  useEffect(() => {
    if (isOpen) {
      console.log('[调试] useEffect 触发: 面板已打开，准备滚动和聚焦。');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // --- 调试阶段 2: Mutation 定义 ---
  const initializeSessionMutation = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      console.log('[调试] 5a. initializeSessionMutation.mutate() 已被调用，参数 kbId:', knowledgeBaseId);
      
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

      console.log('[调试] 准备发送创建Dialog的请求，Payload:', dialogPayload);

      // 步骤1: 调用 createTemporaryDialog
      const dialogRes = await knowledgeBaseService.createTemporaryDialog(dialogPayload);
      
      console.log('[调试] 步骤1 API响应 (dialogRes):', dialogRes);
      
      const tempDialogId = dialogRes?.data?.data?.id; 
      
      if (!tempDialogId) {
        throw new Error("未能从创建Dialog的API响应中获取ID。");
      }
      dialogIdRef.current = tempDialogId;

      const newConversationId = getConversationId();

      // 步骤2: 为这个 Dialog 创建一个对话
      const conversationRes = await knowledgeBaseService.createConversation({
        conversation_id: newConversationId,
        dialog_id: tempDialogId,
        name: 'Initial Conversation',
        is_new: true,
      });

      console.log('[调试] 步骤2 API响应 (conversationRes):', conversationRes);
      
      return newConversationId;
    },
    onSuccess: (newConversationId) => {
      console.log('✅ 对话初始化成功，ID:', newConversationId);
      conversationIdRef.current = newConversationId;
      setMessages([{ role: 'assistant', content: `你好！关于此知识库的问题，随时可以问我。` }]);
    },
    onError: (error: any) => {
      console.error('❌ 对话初始化失败:', error);
      const errorMessage = error.message || "未知错误，请检查API配置。";
      message.error(`对话创建失败: ${errorMessage}`);
    },
  });

  // 新增：用于解析思考过程和最终答案的辅助函数
  const parseThinkingAndAnswer = (rawText: string): { thinking: string | null; answer: string } => {
    const thinkTagStart = '<think>';
    const thinkTagEnd = '</think>';
    const startIndex = rawText.indexOf(thinkTagStart);
    const endIndex = rawText.lastIndexOf(thinkTagEnd);

    if (startIndex !== -1 && endIndex !== -1) {
      const thinking = rawText.substring(startIndex + thinkTagStart.length, endIndex).trim();
      const answer = rawText.substring(endIndex + thinkTagEnd.length).trim();
      return { thinking, answer };
    }
    
    return { thinking: null, answer: rawText };
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { conversationId: string; query: string }) => {
      // 在UI上添加一个空的助手消息占位符，包含 thinking 字段
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const jsonStr = line.substring(5);
              if (jsonStr) {
                const parsedData = JSON.parse(jsonStr);
                if (parsedData.data && parsedData.data.answer) {
                  const rawAnswer = parsedData.data.answer;
                  // ▼▼▼ 核心修复：使用新函数解析思考过程和答案 ▼▼▼
                  const { thinking, answer } = parseThinkingAndAnswer(rawAnswer);
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    lastMessage.content = answer; // 更新最终答案
                    if (thinking) {
                      lastMessage.thinking = thinking; // 更新思考过程
                    }
                    return newMessages;
                  });
                  // ▲▲▲ 核心修复：使用新函数解析思考过程和答案 ▲▲▲
                }
              }
            } catch (e) {
              console.error('Error parsing stream chunk:', e, 'Chunk:', line);
            }
          }
        }
      }
    },
    onSuccess: () => {
      console.log('[调试] 7b. ✅ 消息流接收完毕。');
    },
    onError: (error) => {
      console.error('[调试] 7c. ❌ 消息发送/流处理失败:', error);
      message.error('消息发送失败。');
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const isLoading = initializeSessionMutation.isPending || sendMessageMutation.isPending;

  // --- 调试阶段 3: 事件处理器定义 ---
  const handleOpen = useCallback(() => {
    console.log('[调试] 4. handleOpen 函数被调用。');
    
    if (!kbId) {
      message.error('无法初始化对话：未在URL中找到知识库ID。');
      return;
    }

    if (!isOpen) {
      setIsOpen(true);
      if (!conversationIdRef.current) {
        console.log('[调试] 5. 条件满足，准备调用 initializeSessionMutation...');
        initializeSessionMutation.mutate(kbId);
      }
    }
  }, [isOpen, kbId, initializeSessionMutation]);

  const handleClose = useCallback(() => setIsOpen(false), []);

  const handleSendMessage = useCallback(() => {
    console.log('[调试] 6. handleSendMessage 函数被调用。');
    const currentConversationId = conversationIdRef.current;
    if (!inputValue.trim() || !currentConversationId || isLoading) {
      console.log(`[调试] 发送被阻止: 输入="${inputValue}", 对话ID=${currentConversationId}, 加载中=${isLoading}`);
      return;
    }
    const messageToSend = inputValue;
    setMessages((prev) => [...prev, { role: 'user', content: messageToSend }]);
    setInputValue('');
    
    console.log('[调试] 7. 条件满足，准备调用 sendMessageMutation...');
    sendMessageMutation.mutate({
      conversationId: currentConversationId,
      query: messageToSend,
    });
  }, [inputValue, isLoading, sendMessageMutation]);
  
  console.log('[调试] 3. Hook 准备返回所有状态和函数。');
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
