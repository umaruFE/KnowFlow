import { useState } from 'react';
import { Input, Button, List, Avatar, Spin, Divider } from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import classNames from 'classnames';
import { useKnowledgeBaseChat } from '@/hooks/knowledge-base-hooks';
import styles from './index.less';

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

  // New state to manage which message's thinking process is expanded
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  // New function to toggle the visibility of the thinking process for a specific message
  const toggleThinking = (index: number) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSendClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
          renderItem={(item, index) => (
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
              <div className={styles.messageBubble}>
                <div className={styles.messageContent}>{item.content}</div>
                {/* Conditionally render the "Show thought process" button */}
                {item.role === 'assistant' && item.thinking && (
                  <div className={styles.thinkingToggleContainer}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ExperimentOutlined />}
                      onClick={() => toggleThinking(index)}
                      className={styles.thinkingToggleButton}
                    >
                      显示思路
                    </Button>
                  </div>
                )}
                {/* Conditionally render the thinking process content */}
                {expandedThinking[index] && (
                  <div className={styles.thinkingProcess}>
                    {item.thinking}
                  </div>
                )}
              </div>
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
          onClick={handleSendClick}
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
