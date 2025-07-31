import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'umi'; 
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import knowledgeBaseService from '@/services/knowledge-base-service';
// ▼▼▼ 核心修复：引入一个用于生成ID的工具函数 ▼▼▼
import { getConversationId } from '@/utils/chat';

// 定义消息类型接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
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
        llm_id: 'fastchat-api_chatglm3-6b',
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

      // ▼▼▼ 核心修复：在调用API前，先生成一个新的对话ID ▼▼▼
      const newConversationId = getConversationId();

      // 步骤2: 为这个 Dialog 创建一个对话
      const conversationRes = await knowledgeBaseService.createConversation({
        conversation_id: newConversationId, // 将新生成的ID发送给后端
        dialog_id: tempDialogId,
        name: 'Initial Conversation',
        is_new: true,
      });

      console.log('[调试] 步骤2 API响应 (conversationRes):', conversationRes);
      
      // 直接返回我们自己生成的ID，不再依赖后端的返回
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

  const sendMessageMutation = useMutation({
    mutationFn: (params: { conversationId: string; query: string }) => {
      console.log('[调试] 7a. sendMessageMutation.mutate() 已被调用，参数:', params);
      return knowledgeBaseService.completeConversation({
        conversation_id: params.conversationId,
        dialog_id: dialogIdRef.current,
        messages: [{ role: 'user', content: params.query }],
      });
    },
    onSuccess: (response) => {
      console.log('[调试] 7b. ✅ 消息发送成功，收到回复。');
      const answer = response?.data?.data?.answer;
      if (answer) {
        const assistantMessage: Message = { role: 'assistant', content: answer };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        console.error('未能从发送消息的API响应中解析出 "answer"');
        message.error('收到回复，但无法解析内容。');
      }
    },
    onError: (error) => {
      console.error('[调试] 7c. ❌ 消息发送失败:', error);
      message.error('消息发送失败。');
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
