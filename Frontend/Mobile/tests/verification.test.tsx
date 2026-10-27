import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import { listReports, assignTechnician } from '@/services/reports';
import { listTechnicians } from '@/services/technicians';
import { ApiError } from '@/lib/apiClient';
import TechnicianDashboardScreen from '@/app/(tabs)/technician-dashboard';
import StaffDashboardScreen from '@/app/(tabs)/staff-dashboard';

// Mock the hooks and services
jest.mock('@/hooks/useAuth');
jest.mock('@/stores/site');
jest.mock('@/services/reports');
jest.mock('@/services/technicians');

// Mock translations
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock navigation
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock theme colors
jest.mock('@/constants/theme', () => ({
  themeColors: () => ({
    ink: '#000000',
    subtitle: '#666666',
    card: '#FFFFFF',
    tabIconSelected: '#008d80',
    statMintDeep: '#008d80',
  }),
}));

// Mock data
const mockUser = {
  id: 1,
  role: 'technician',
  capabilities: {
    createReport: false,
    manageShop: false,
  },
};

const mockSite = {
  id: 1,
  name: 'Test Site',
};

const mockReports = [
  {
    id: 1,
    title: 'Test Report 1',
    siteName: 'Test Site',
    status: 'open',
    subsiteName: 'Building A',
  },
  {
    id: 2,
    title: 'Test Report 2',
    siteName: 'Test Site',
    status: 'assigned',
    subsiteName: 'Building B',
  },
];

const mockTechnicians = [
  {
    id: 1,
    name: 'John Doe',
    trade: 'Electrician',
    contractStatus: 'active',
  },
  {
    id: 2,
    name: 'Jane Smith',
    trade: 'Plumber',
    contractStatus: 'inactive',
  },
];

const mockInvitations = [
  {
    id: 1,
    reportId: 1,
    reportTitle: 'Test Report 1',
    siteName: 'Test Site',
  },
];

const mockContracts = [
  {
    id: 1,
    siteName: 'Test Site',
    status: 'active',
  },
];

// Test suite for Technician Dashboard
describe('Technician Dashboard', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (useCurrentSite as jest.Mock).mockReturnValue({ site: mockSite });
    (listTechnicianInvitations as jest.Mock).mockResolvedValue(mockInvitations);
    (listTechnicianContracts as jest.Mock).mockResolvedValue(mockContracts);
    (listReports as jest.Mock).mockResolvedValue(mockReports.filter(r => r.status === 'assigned'));
  });

  it('should display technician dashboard with correct data', async () => {
    const { getByText } = render(<TechnicianDashboardScreen />);

    // Check if invitations are displayed
    await waitFor(() => {
      expect(getByText('Test Report 1')).toBeTruthy();
      expect(getByText('Test Site')).toBeTruthy();
    });

    // Check if contracts are displayed
    await waitFor(() => {
      expect(getByText('Test Site')).toBeTruthy();
      expect(getByText('technicianDashboard.contractStatus')).toBeTruthy();
    });

    // Check if active work is displayed
    await waitFor(() => {
      expect(getByText('Test Report 2')).toBeTruthy();
      expect(getByText('Test Site')).toBeTruthy();
    });
  });

  it('should handle errors when loading data', async () => {
    (listTechnicianInvitations as jest.Mock).mockRejectedValue(new ApiError('Failed to load invitations', 500));
    const { getByText } = render(<TechnicianDashboardScreen />);

    await waitFor(() => {
      expect(getByText('technicianDashboard.errorTitle')).toBeTruthy();
      expect(getByText('Failed to load invitations')).toBeTruthy();
    });
  });
});

// Test suite for Staff Dashboard
describe('Staff Dashboard', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ user: { ...mockUser, role: 'staff' } });
    (useCurrentSite as jest.Mock).mockReturnValue({ site: mockSite });
    (listReports as jest.Mock).mockResolvedValue(mockReports.filter(r => r.status === 'open'));
    (listTechnicians as jest.Mock).mockResolvedValue(mockTechnicians);
  });

  it('should display staff dashboard with correct data', async () => {
    const { getByText } = render(<StaffDashboardScreen />);

    // Check if reports are displayed
    await waitFor(() => {
      expect(getByText('Test Report 1')).toBeTruthy();
      expect(getByText('Building A')).toBeTruthy();
    });

    // Check if technicians are displayed
    await waitFor(() => {
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText('Electrician')).toBeTruthy();
    });
  });

  it('should handle errors when loading data', async () => {
    (listReports as jest.Mock).mockRejectedValue(new ApiError('Failed to load reports', 500));
    const { getByText } = render(<StaffDashboardScreen />);

    await waitFor(() => {
      expect(getByText('staffDashboard.errorTitle')).toBeTruthy();
      expect(getByText('Failed to load reports')).toBeTruthy();
    });
  });
});
