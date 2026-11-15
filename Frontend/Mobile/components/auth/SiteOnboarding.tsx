import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, KeyRound } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authColors, fontFamilies } from '@/constants/theme';
import * as service from '@/services/onboarding';
import { AuthShell } from './AuthShell';
import { AuthField } from './AuthField';
import { AuthButton } from './AuthButton';

const fields = [
  ['organization', 'Organization', '机构'],
  ['siteName', 'Site name', '场所名称'],
  ['address', 'Address', '地址'],
  ['contactEmail', 'Requester email', '申请人邮箱'],
  ['contactPhone', 'Requester phone', '申请人电话'],
  ['relationship', 'Requester relationship and authority', '申请人与场所的关系及权限'],
  ['adminFirstName', 'Intended administrator first name', '拟任管理员名字'],
  ['adminLastName', 'Intended administrator last name', '拟任管理员姓氏'],
  ['adminEmail', 'Intended administrator email', '拟任管理员邮箱'],
  ['adminPhone', 'Intended administrator phone', '拟任管理员电话'],
] as const;

const initial: service.SiteRequest = {
  organization: '',
  siteName: '',
  siteType: 'school',
  address: '',
  contactEmail: '',
  contactPhone: '',
  relationship: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPhone: '',
};

const STATUS_COPY: Record<string, { en: string; zh: string; tone: 'pending' | 'ok' | 'warn' | 'bad' }> = {
  pending: { en: 'Pending review', zh: '审核中', tone: 'pending' },
  approved: { en: 'Approved', zh: '已批准', tone: 'ok' },
  rejected: { en: 'Rejected', zh: '已拒绝', tone: 'bad' },
  information_requested: { en: 'Information requested', zh: '需补充信息', tone: 'warn' },
};

const TONE = {
  pending: { bg: 'rgb(250, 228, 229)', ink: 'rgb(147, 75, 75)' },
  ok: { bg: 'rgb(220, 236, 228)', ink: 'rgb(45, 106, 79)' },
  warn: { bg: 'rgb(250, 236, 210)', ink: 'rgb(146, 98, 24)' },
  bad: { bg: 'rgb(250, 228, 229)', ink: 'rgb(167, 52, 52)' },
} as const;

type NavItem = { href: '/(auth)/track-site' | '/(auth)/register-admin-apply' | '/(auth)/setup-site-admin' | '/(auth)/login'; en: string; zh: string };

const NAV: NavItem[] = [
  { href: '/(auth)/track-site', en: 'Track application', zh: '查询申请' },
  { href: '/(auth)/register-admin-apply', en: 'Request a site', zh: '申请场所' },
  { href: '/(auth)/setup-site-admin', en: 'Have a setup token?', zh: '已有设置令牌？' },
  { href: '/(auth)/login', en: 'Back to sign in', zh: '返回登录' },
];

export function SiteOnboarding({ mode }: { mode: 'request' | 'track' | 'setup' }) {
  const { i18n } = useTranslation('common');
  const tr = (en: string, zh: string) => (i18n.language.startsWith('zh') ? zh : en);
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [form, setForm] = useState(initial);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<service.ApplicationStatus>();
  const [receipt, setReceipt] = useState('');
  const [message, setMessage] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const correction = mode === 'track' && status?.status === 'information_requested';
  const needsSetup = status?.status === 'approved' && !status.setupComplete;
  const statusMeta = status ? STATUS_COPY[status.status] ?? {
    en: status.status,
    zh: status.status,
    tone: 'pending' as const,
  } : null;

  useEffect(() => {
    if (mode !== 'track') return;
    const incoming = typeof params.token === 'string' ? params.token.trim() : '';
    if (incoming) setToken(incoming);
  }, [mode, params.token]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch {
      setMessage(
        tr(
          'Unable to complete this action. Check details and connection, then retry.',
          '无法完成操作。请检查信息和网络后重试。',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (fields.some(([key]) => !form[key].trim()) || !['school', 'hostel', 'hotel'].includes(form.siteType)) {
      setMessage(
        tr(
          'Complete all fields and choose school, hostel or hotel.',
          '请填写所有字段，并选择 school、hostel 或 hotel。',
        ),
      );
      return;
    }
    await run(async () => {
      if (correction) {
        setStatus(await service.correctSite(token, form));
        setMessage(tr('Corrected information submitted.', '更正信息已提交。'));
      } else {
        const result = await service.submitSite(form);
        setReceipt(result.trackingToken);
        setForm(initial);
      }
    });
  }

  return (
    <AuthShell>
      <Text
        className="mb-4 text-[26px] text-auth-ink"
        style={{ fontFamily: fontFamilies.headExtraBold, letterSpacing: -0.8 }}
      >
        {mode === 'request'
          ? tr('Request a site', '申请场所')
          : mode === 'track'
            ? tr('Track your application', '查询申请')
            : tr('Set administrator password', '设置管理员密码')}
      </Text>
      <Text className="mb-6 text-[14px] leading-6 text-auth-body">
        {mode === 'request'
          ? tr(
              'No account needed. Provide organization details and nominate the administrator separately. After you submit, save the tracking token so you can check status any time.',
              '无需账户。请提供机构信息，并单独指定拟任管理员。提交后请保存查询令牌，以便随时查看进度。',
            )
          : mode === 'setup'
            ? tr(
                'Paste the setup token the super admin shared with you, then choose your sign-in password. Your login email is the intended administrator email from the site application.',
                '粘贴超级管理员发给您的设置令牌，然后设置登录密码。登录邮箱为场所申请中填写的拟任管理员邮箱。',
              )
            : tr(
                'Enter your private tracking token. Keep it secure; never share it publicly.',
                '请输入私人查询令牌，妥善保管，勿公开分享。',
              )}
      </Text>

      {receipt ? (
        <>
          <View className="mb-4 rounded-[12px] border border-coral-link/30 bg-coral-bg px-3.5 py-3">
            <Text className="text-[12px] leading-5 text-auth-ink">
              {tr(
                'Save this tracking token now. Select and copy it; it is shown once:',
                '请立即选择并复制此查询令牌，仅显示一次：',
              )}
            </Text>
            <Text selectable className="mt-2 text-[13px] font-semibold text-auth-ink">
              {receipt}
            </Text>
          </View>
          <AuthButton
            label={tr('I saved my token — check status', '已保存令牌 — 查询状态')}
            onPress={() => {
              const saved = receipt;
              setReceipt('');
              router.push({ pathname: '/(auth)/track-site', params: { token: saved } });
            }}
          />
        </>
      ) : null}

      {mode !== 'request' ? (
        <AuthField
          label={
            mode === 'setup'
              ? tr('Setup token', '设置令牌')
              : tr('Private tracking token', '私人查询令牌')
          }
          value={token}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(value) => {
            setToken(value);
            setStatus(undefined);
          }}
        />
      ) : null}

      {mode === 'track' ? (
        <AuthButton
          label={tr('Check status', '查询状态')}
          loading={busy}
          disabled={!token.trim()}
          onPress={() =>
            run(async () => {
              setStatus(await service.trackSite(token));
            })
          }
        />
      ) : null}

      {status && statusMeta ? (
        <View className="my-5 rounded-[14px] border border-auth-ink/10 bg-auth-panel px-4 py-3.5">
          <Text
            className="mb-2 text-[10px] uppercase text-auth-body"
            style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.1 }}
          >
            {tr('Application status', '申请状态')}
          </Text>
          <View
            className="self-start rounded-full px-3 py-1.5"
            style={{ backgroundColor: TONE[statusMeta.tone].bg }}
          >
            <Text
              className="text-[12px] font-semibold"
              style={{ color: TONE[statusMeta.tone].ink }}
            >
              {tr(statusMeta.en, statusMeta.zh)}
            </Text>
          </View>
          {status.message ? (
            <Text className="mt-3 text-[13px] leading-5 text-auth-body">{status.message}</Text>
          ) : null}
          {status.setupComplete ? (
            <Text className="mt-3 text-[13px] leading-5 text-auth-ink">
              {tr(
                'Setup complete. Sign in with the administrator email and the password you chose, then add labelled buildings.',
                '设置完成。请使用管理员邮箱和您设置的密码登录，然后添加有名称的楼宇。',
              )}
            </Text>
          ) : null}
          {needsSetup ? (
            <View className="mt-3">
              <Text className="mb-3 text-[13px] leading-5 text-auth-body">
                {tr(
                  'The site was approved. Ask the super admin for the setup token, then set the administrator password before signing in.',
                  '场所已获批准。请向超级管理员索取设置令牌，先设置管理员密码再登录。',
                )}
              </Text>
              <AuthButton
                label={tr('Enter setup token', '输入设置令牌')}
                onPress={() => router.push('/(auth)/setup-site-admin')}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {correction ? (
        <Text className="my-4 text-auth-body">
          {tr(
            'For privacy, earlier details are not retrieved. Enter the complete corrected application.',
            '为保护隐私，不读取之前的个人信息。请填写完整的更正申请。',
          )}
        </Text>
      ) : null}

      {((mode === 'request' && !receipt) || correction) ? (
        <>
          {fields.map(([key, en, zh]) => (
            <AuthField
              key={key}
              label={tr(en, zh)}
              value={form[key]}
              maxLength={
                key === 'relationship' ? 1000 : key === 'address' ? 512 : key.includes('Phone') ? 64 : key.includes('Name') ? 128 : 255
              }
              autoCapitalize={key.toLowerCase().includes('email') ? 'none' : 'sentences'}
              keyboardType={key.toLowerCase().includes('email') ? 'email-address' : 'default'}
              onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
            />
          ))}
          <AuthField
            label={tr('Site type: school / hostel / hotel', '场所类型：school / hostel / hotel')}
            value={form.siteType}
            autoCapitalize="none"
            onChangeText={(siteType) => setForm((prev) => ({ ...prev, siteType }))}
          />
          <AuthButton
            label={
              correction
                ? tr('Submit corrected information', '提交更正信息')
                : tr('Submit site request', '提交场所申请')
            }
            loading={busy}
            onPress={submit}
          />
        </>
      ) : null}

      {mode === 'setup' ? (
        <>
          <AuthField
            label={tr('New password (at least 15 characters)', '新密码（至少15个字符）')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            maxLength={100}
          />
          <AuthField
            label={tr('Confirm password', '确认密码')}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            maxLength={100}
          />
          <AuthButton
            label={tr('Set password', '设置密码')}
            loading={busy}
            disabled={!token.trim() || password.length < 15 || password !== confirm}
            onPress={() =>
              run(async () => {
                await service.setupAdmin(token, password);
                setToken('');
                setPassword('');
                setConfirm('');
                setSetupDone(true);
                setMessage(
                  tr(
                    'Password set. Sign in with the administrator email and this password, then add labelled buildings.',
                    '密码已设置。请使用管理员邮箱和此密码登录，然后添加有名称的楼宇。',
                  ),
                );
              })
            }
          />
        </>
      ) : null}

      {!!message ? (
        <View className="my-4 rounded-[12px] border border-auth-ink/10 bg-auth-panel px-3.5 py-3">
          <Text accessibilityRole="alert" className="text-[13px] leading-5 text-auth-ink">
            {message}
          </Text>
          {setupDone ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(auth)/login')}
              className="mt-3 min-h-[44px] items-center justify-center rounded-[10px] bg-coral active:opacity-80"
            >
              <Text
                className="text-[13px] text-auth-ink"
                style={{ fontFamily: fontFamilies.bodySemiBold }}
              >
                {tr('Go to sign in', '前往登录')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="mt-6 overflow-hidden rounded-[14px] border border-auth-ink/10">
        <Text
          className="border-b border-auth-ink/10 px-4 py-2.5 text-[10px] uppercase text-auth-body"
          style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.1 }}
        >
          {tr('Other options', '其他选项')}
        </Text>
        {NAV.map((item, index) => (
          <Pressable
            key={item.href}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            className={`min-h-[52px] flex-row items-center gap-3 bg-auth-panel px-4 active:opacity-70 ${
              index < NAV.length - 1 ? 'border-b border-auth-ink/10' : ''
            }`}
          >
            <View
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: authColors.roseSoft }}
            >
              <KeyRound color={authColors.coralLink} size={14} />
            </View>
            <Text
              className="flex-1 text-[14px] text-auth-ink"
              style={{ fontFamily: fontFamilies.bodySemiBold }}
            >
              {tr(item.en, item.zh)}
            </Text>
            <ChevronRight color={authColors.coralLink} size={16} />
          </Pressable>
        ))}
      </View>
    </AuthShell>
  );
}
