import { expect, it, vi } from 'vitest';
import { TextField } from '../components/ui/TextField';

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T,>(initial: T) => [initial, vi.fn()],
  useEffect: vi.fn(),
}));
vi.mock('react-native', () => ({ Text: 'Text', TextInput: 'TextInput', View: 'View' }));
vi.mock('@/constants/theme', () => ({ colors: {} }));

it('exposes a visible name and announces a validation error', () => {
  const [label, input, error] = TextField({ label: '建筑物详细位置', error: '请选择建筑物' }).props.children;
  expect(label.props.numberOfLines).toBeUndefined();
  expect(input.props.accessibilityLabel).toBe('建筑物详细位置');
  expect(input.props.accessibilityHint).toBe('请选择建筑物');
  expect(error.props.accessibilityLiveRegion).toBe('polite');
});

it('preserves an explicit accessible name and a non-error hint', () => {
  const [, input] = TextField({
    label: 'Name', accessibilityLabel: 'Building name', accessibilityHint: 'Use the official name',
  }).props.children;
  expect(input.props.accessibilityLabel).toBe('Building name');
  expect(input.props.accessibilityHint).toBe('Use the official name');
});
