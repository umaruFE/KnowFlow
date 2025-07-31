import { rsaPsw } from '@/utils';
import { Button, Form, Input } from 'antd';
import { useEffect, useState } from 'react';
import { Icon, useNavigate } from 'umi';
// import RightPanel from './right-panel';
import {
  useLogin,
  useLoginChannels,
  useLoginWithChannel,
  useRegister,
} from '@/hooks/login-hooks';
import { Domain } from '@/constants/common';
import styles from './index.less';
import { appName } from '@/conf.json';

const Login = () => {
  const [title, setTitle] = useState('login');
  const navigate = useNavigate();
  const { login, loading: signLoading } = useLogin();
  const { register, loading: registerLoading } = useRegister();
  
  const { channels, loading: channelsLoading } = useLoginChannels();
    const { login: loginWithChannel, loading: loginWithChannelLoading } =
    useLoginWithChannel();
  // const { t } = useTranslation('translation', { keyPrefix: 'login' });
  const loading = signLoading || registerLoading || channelsLoading||loginWithChannelLoading;

  const changeTitle = () => {
    setTitle((title) => (title === 'login' ? 'register' : 'login'));
  };
  const [form] = Form.useForm();

  useEffect(() => {
    form.validateFields(['nickname']);
  }, [form]);

  const handleLoginWithChannel = async (channel: string) => {
    await loginWithChannel(channel);
  };

  const onCheck = async () => {
    try {
      const params = await form.validateFields();

      const rsaPassWord = rsaPsw(params.password) as string;

      if (title === 'login') {
        const code = await login({
          email: `${params.email}`.trim(),
          password: rsaPassWord,
        });
        if (code === 0) {
          navigate('/knowledge');
        }
      } else {
        const code = await register({
          nickname: params.nickname,
          email: params.email,
          password: rsaPassWord,
        });
        if (code === 0) {
          setTitle('login');
        }
      }
    } catch (errorInfo) {
      console.log('Failed:', errorInfo);
    }
  };
  const formItemLayout = {
    labelCol: { span: 6 },
    // wrapperCol: { span: 8 },
  };

  const toGoogle = () => {
    window.location.href =
      'https://github.com/login/oauth/authorize?scope=user:email&client_id=302129228f0d96055bee';
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginLeft}>
        <div className={styles.leftContainer}>
          <div className={styles.loginTitle}>
            <div className={styles.loginLogo}>
              <div className={styles.logo}></div>
              <div className={styles.name}>{appName}</div>
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            name="dynamic_rule"
            style={{ maxWidth: 600 }}
          >
            <Form.Item
              {...formItemLayout}
              name="email"
              rules={[{ required: true, message: '请输入邮箱地址' }]}
            >
              <Input size="large" placeholder="请输入邮箱地址" />
            </Form.Item>
            {title === 'register' && (
              <Form.Item
                {...formItemLayout}
                name="nickname"
                rules={[{ required: true, message: '请输入昵称' }]}
              >
                <Input size="large" placeholder="请输入昵称" />
              </Form.Item>
            )}
            <Form.Item
              {...formItemLayout}
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                size="large"
                placeholder="请输入密码"
                onPressEnter={onCheck}
              />
            </Form.Item>
            <Button
              type="primary"
              block
              size="large"
              onClick={onCheck}
              loading={loading}
            >
              {title === 'login' ? '登录' : '注册'}
            </Button>
          </Form>
          <div style={{marginTop: 10, textAlign: 'center', color: '#999'}}>您也可以通过以下方式登录</div>
          { channels && channels.length > 0 && (
              <div>
                {channels.map((item) => (
                  <Button
                    key={item.channel}
                    block
                    size="large"
                    onClick={() => handleLoginWithChannel(item.channel)}
                    style={{ marginTop: 10}}
                  >
                    <div className="flex items-center"style={{justifyContent: 'center'}}>
                      {item.display_name}
                    </div>
                  </Button>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Login;
