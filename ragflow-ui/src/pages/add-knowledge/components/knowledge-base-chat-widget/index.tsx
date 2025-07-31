import { Input, Button, List, Avatar, Spin, Divider } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useKnowledgeBaseChat } from '@/hooks/knowledge-base-hooks';
import styles from './index.less';
import classNames from 'classnames';

const KnowledgeBaseChatWidget = () => {
  const {
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
  } = useKnowledgeBaseChat();

  // 为发送按钮创建一个更健壮的点击处理器
  const handleSendClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡到父级的 onClick，防止冲突
    handleSendMessage();
  };

  return (
    <div
      className={classNames(styles.chatWidgetContainer, {
        [styles.isOpen]: isOpen,
      })}
    >
      <div className={styles.chatPanel}>
        <div className={styles.drawerHeader}>
          <span>与知识库对话</span>
          <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
        </div>
        <Divider style={{ margin: 0 }} />
        <List
          className={styles.messageList}
          dataSource={messages}
          renderItem={(item) => (
            <List.Item
              className={
                item.role === 'user'
                  ? styles.userMessage
                  : styles.assistantMessage
              }
            >
              <Avatar
                icon={item.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              />
              <div className={styles.messageContent}>{item.content}</div>
            </List.Item>
          )}
        >
          {isLoading && messages.length > 0 && (
            <div className={styles.loadingSpinner}>
              <Spin />
            </div>
          )}
          <div ref={messagesEndRef} />
        </List>
      </div>

      <div
        className={styles.inputArea}
        onClick={!isOpen ? handleOpen : undefined}
      >
        <Input.TextArea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={(e) =>
            !e.shiftKey && (e.preventDefault(), handleSendMessage())
          }
          placeholder={isOpen ? '输入你的问题...' : '基于本知识库进行对话...'}
          readOnly={!isOpen}
          autoSize={{ minRows: 1, maxRows: 5 }}
          className={styles.chatInput}
        />
        <Button
          type="primary"
          // ▼▼▼ 核心修复：使用新的点击处理器 ▼▼▼
          onClick={handleSendClick}
          // ▲▲▲ 核心修复：使用新的点击处理器 ▲▲▲
          loading={isLoading}
          disabled={!inputValue.trim()}
          className={
            isOpen ? styles.sendButtonVisible : styles.sendButtonHidden
          }
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default KnowledgeBaseChatWidget;
