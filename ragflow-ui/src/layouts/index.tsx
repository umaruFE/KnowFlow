import { Layout, theme } from 'antd';
import React, {useEffect} from 'react';
import { Outlet } from 'umi';
import '../locales/config';
import Header from './components/header';

import styles from './index.less';
import { Spin } from 'antd';
import { useState } from 'react';
import { useLocation } from 'umi';

const { Content, Sider } = Layout;


const App: React.FC = () => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  // 监听路由变化
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [location.pathname]);
      
  return (
     <Spin spinning={loading} style={{height: '100%'}}>
    <Layout className={styles.layout}>
      <Sider width="60px" className={styles.siderStyle}>
        <Header></Header>
      </Sider>
      
     
        <Layout>
            <Content
              style={{
                minHeight: 280,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                overflow: 'auto',
                display: 'flex',
              }}
            >
              <Outlet />
            </Content>
          
        </Layout>
    </Layout>
      </Spin>
  );
};

export default App;
