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

  useEffect(() => {
    setLoading(true);
    console.log("=======================================1")
    const observer = new MutationObserver((mutations) => {
      const currentPath = location.pathname;
       let targetElement = null;
       
       // 根据当前路由路径检测对应的元素
       if (currentPath.startsWith('/chat')) {
         targetElement = document.querySelector('[class^="chatWrapper"]');
       } else if (currentPath.startsWith('/knowledge')) {
         targetElement = document.querySelector('[class^="knowledge"]');
       } else if (currentPath.startsWith('/write')) {
         targetElement = document.querySelector('[class^="write"]');
       }
       
       if (targetElement) {
         setLoading(false);
         console.log("=======================================2")
         observer.disconnect();
       }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    const timeoutTimer = setTimeout(() => {
    console.log("=======================================3")
      setLoading(false);
      observer.disconnect();
    }, 2000);
    
    return () => {
      observer.disconnect();
      clearTimeout(timeoutTimer);
    };
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
