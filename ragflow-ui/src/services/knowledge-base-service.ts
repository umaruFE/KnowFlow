import api from '@/utils/api';
import registerServer from '@/utils/register-server';
import request from '@/utils/request';

// 1. 定义我们服务所包含的方法，并确保 url 指向正确的 api 端点
const methods = {
  /**
   * 创建一个临时的“对话应用/助理”。
   * 在您的项目中，这对应于 "Dialog"。
   */
  createTemporaryDialog: {
    url: api.setDialog, // 修正：使用 setDialog 来创建助理/应用
    method: 'post',
  },
  /**
   * 创建一个对话。
   * 在您的项目中，这对应于 "Conversation"。
   */
  createConversation: {
    url: api.setConversation, // 修正：使用 setConversation 来创建新对话
    method: 'post',
  },
  /**
   * 对话补全/发送消息
   */
  completeConversation: {
    url: api.completeConversation, // 修正：使用 completeConversation 来发送消息
    method: 'post',
  },
} as const; // 使用 as const 保证类型安全

// 2. 使用 registerServer 工具动态创建服务
const knowledgeBaseService = registerServer<keyof typeof methods>(
  methods,
  request,
);

export default knowledgeBaseService;
