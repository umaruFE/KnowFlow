import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'umi'; 
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import knowledgeBaseService from '@/services/knowledge-base-service';
import chatService from '@/services/chat-service';
import { getConversationId } from '@/utils/chat';
import api from '@/utils/api';

// 定义消息类型接口
interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  id?: string; // 为消息添加ID
}

// 定义存储在 sessionStorage 中的数据结构
interface SessionChatInfo {
  dialogId: string;
  conversationId: string;
}

export const useKnowledgeBaseChat = () => {
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
            dialogIdRef.current = sessionInfo.dialogId;
            conversationIdRef.current = sessionInfo.conversationId;
          }
        } catch (e) {
          sessionStorage.removeItem(sessionKey);
        }
      }
    }
  }, [kbId]);


  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

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

  const initializeSessionMutation = useMutation({
    mutationFn: async (knowledgeBaseId: string) => {
      const dialogPayload = {
        dialog_id: '',
        name: `Temp_Dialog_For_KB_${knowledgeBaseId}_${Date.now()}`,
        description: `Temporary chat for knowledge base: ${knowledgeBaseId}`,
        icon: "",
        kb_ids: [knowledgeBaseId],
        llm_id: 'DeepSeek-R1-Distill-Qwen-32B___OpenAI-API@OpenAI-API-Compatible',
        llm_setting: {
            frequency_penalty: 0.7,
            presence_penalty: 0.4,
            temperature: 0.1,
            top_p: 0.3
        },
        prompt_config: {
            empty_response: "",
            system: "你是一个智能助手，请总结知识库的内容来回答问题，请列举知识库中的数据详细回答。当所有知识库内容都与问题无关时，你的回答必须包括“知识库中未找到您要的答案！”这句话。回答需要考虑聊天历史。\n        以下是知识库：\n        {knowledge}\n        以上是知识库。",
            prologue: "你好！ 我是你的助理，有什么可以帮到你的吗？",
            parameters: [
                { key: "knowledge",optional: true }, 
            ],
            quote: true,
            reasoning: false,
            refine_multiturn: true,
            use_kg: false
        },
        rerank_id: "",
        similarity_threshold: 0.2,
        top_k: 1024,
        top_n: 8,
        vector_similarity_weight: 0.3
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
        message: [{
            role: 'assistant',
            content: dialogPayload.prompt_config.prologue
        }]
      });

      return { dialogId: tempDialogId, conversationId: newConversationId, prologue: dialogPayload.prompt_config.prologue };
    },
    onSuccess: (sessionInfo) => {
      dialogIdRef.current = sessionInfo.dialogId;
      conversationIdRef.current = sessionInfo.conversationId;

      if (kbId) {
        const sessionKey = `knowledge-chat-${kbId}`;
        sessionStorage.setItem(sessionKey, JSON.stringify({
            dialogId: sessionInfo.dialogId,
            conversationId: sessionInfo.conversationId
        }));
      }

      setMessages([{ role: 'assistant', content: sessionInfo.prologue, id: getConversationId() }]);
    },
    onError: (error: any) => {
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
    // ▼▼▼ 核心修复 1：让 mutationFn 接收完整的消息历史 ▼▼▼
    mutationFn: async (params: { conversationId: string; fullMessages: Message[] }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: '', thinking: '', id: getConversationId() }]);

      const payload = {
        conversation_id: params.conversationId,
        dialog_id: dialogIdRef.current,
        // ▼▼▼ 核心修复 2：使用完整的消息历史作为 payload ▼▼▼
        messages: params.fullMessages,
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
          const messageChunk = buffer.substring(0, boundaryIndex);
          buffer = buffer.substring(boundaryIndex + boundary.length);

          if (messageChunk.startsWith('data:')) {
            try {
              const jsonStr = messageChunk.substring(5);
              if (jsonStr) {
                const parsedData = JSON.parse(jsonStr);
                if (parsedData.data && parsedData.data.answer) {
                  const rawAnswer = parsedData.data.answer;
                  const { thinking, answer } = parseThinkingAndAnswer(rawAnswer);
                  
                  // 过滤掉[IDs 1, 2, 3]这种格式的内容
                  const filteredAnswer = answer.replace(/\[(?:IDs|ID:|\s*\d+D\s*:)(?:\s*\d+\s*,?|\s*vary\s*)+\]|\[\s*\d+D\s*:\d+\]/g, ''); 
                  
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    lastMessage.content = filteredAnswer; 
                    if (thinking) {
                      lastMessage.thinking = thinking.replace(/\[(?:IDs|ID:|\s*\d+D\s*:)(?:\s*\d+\s*,?|\s*vary\s*)+\]|\[\s*\d+D\s*:\d+\]/g, ''); 
                    }
                    if (parsedData.data.reference?.doc_aggs) {
                      lastMessage.reference = parsedData.data.reference;
                    }
                    return newMessages;
                  });
                }
              }
            } catch (e) {
              console.error('Error parsing stream chunk:', e, 'Chunk:', messageChunk);
            }
          }
          boundaryIndex = buffer.indexOf(boundary);
        }
      }
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
    
    // ▼▼▼ 核心修复 3：构建包含新消息的完整历史记录 ▼▼▼
    const newUserMessage: Message = {
        role: 'user',
        content: messageToSend,
        id: getConversationId(), // 添加唯一ID
    };
    const fullMessages = [...messages, newUserMessage];

    // 立即用完整历史更新UI
    setMessages(fullMessages);
    setInputValue('');
    
    // ▼▼▼ 核心修复 4：将完整历史传递给 mutation ▼▼▼
    sendMessageMutation.mutate({
      conversationId: currentConversationId,
      fullMessages: fullMessages,
    });
  }, [inputValue, isLoading, messages, sendMessageMutation]);
  
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
