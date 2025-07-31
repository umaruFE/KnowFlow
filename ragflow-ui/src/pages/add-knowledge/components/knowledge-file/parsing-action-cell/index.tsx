import { useShowDeleteConfirm, useTranslate } from '@/hooks/common-hooks';
import { useRemoveNextDocument } from '@/hooks/document-hooks';
import { IDocumentInfo } from '@/interfaces/database/document';
import { downloadDocument } from '@/utils/file-util';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ToolOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, Space, Tooltip } from 'antd';
import { isParserRunning } from '../utils';

import { useCallback } from 'react';
import { DocumentType } from '../constant';
import styles from './index.less';

interface IProps {
  record: IDocumentInfo;
  setCurrentRecord: (record: IDocumentInfo) => void;
  showRenameModal: () => void;
  showChangeParserModal: () => void;
  showSetMetaModal: () => void;
}

const ParsingActionCell = ({
  record,
  setCurrentRecord,
  showRenameModal,
  showChangeParserModal,
  showSetMetaModal,
}: IProps) => {
  const documentId = record.id;
  const isRunning = isParserRunning(record.run);
  const { t } = useTranslate('knowledgeDetails');
  const { removeDocument } = useRemoveNextDocument();
  const showDeleteConfirm = useShowDeleteConfirm();
  const isVirtualDocument = record.type === DocumentType.Virtual;

  const onRmDocument = () => {
    if (!isRunning) {
      showDeleteConfirm({
        onOk: () => removeDocument([documentId]),
        content: record?.parser_config?.graphrag?.use_graphrag
          ? t('deleteDocumentConfirmContent')
          : '',
      });
    }
  };

  const onDownloadDocument = () => {
    downloadDocument({
      id: documentId,
      filename: record.name,
    });
  };

  const setRecord = useCallback(() => {
    setCurrentRecord(record);
  }, [record, setCurrentRecord]);

  const onShowRenameModal = () => {
    setRecord();
    showRenameModal();
  };
  const onShowChangeParserModal = () => {
    setRecord();
    showChangeParserModal();
  };

  const onShowSetMetaModal = useCallback(() => {
    setRecord();
    showSetMetaModal();
  }, [setRecord, showSetMetaModal]);

  const chunkItems: MenuProps['items'] = [
    {
      key: '1',
      label: (
        <div className="flex flex-col">
          <Button type="link" onClick={onShowChangeParserModal}>
            {t('chunkMethod')}
          </Button>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: '2',
      label: (
        <div className="flex flex-col">
          <Button type="link" onClick={onShowSetMetaModal}>
            {t('setMetaData')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'rename',
            label: t('rename', { keyPrefix: 'common' }),
            onClick: onShowRenameModal,
            disabled: isRunning
          },
          {
            key: 'delete',
            label: t('delete', { keyPrefix: 'common' }),
            onClick: onRmDocument,
            disabled: isRunning
          },
          !isVirtualDocument && {
            key: 'download',
            label: t('download', { keyPrefix: 'common' }),
            onClick: onDownloadDocument,
            disabled: isRunning
          }
        ].filter(Boolean)
      }}
      trigger={['click']}
    >
      <EllipsisOutlined style={{ fontSize: 18 }} />
    </Dropdown>
  );
};

export default ParsingActionCell;
