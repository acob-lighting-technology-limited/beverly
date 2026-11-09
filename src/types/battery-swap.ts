/**
 * Type definitions for Beverly Battery Swap Operations & Stations
 */

export type BatteryStatus = 'ready' | 'charging' | 'maintenance' | 'empty';

export interface StationBattery {
  sn: string;
  id: string;
  soc: number;
  v: number;
  temp: number;
  status: BatteryStatus;
}

export interface LockerSlot {
  doorNumber: number;
  status: BatteryStatus;
  battery: StationBattery | null;
}

export interface SwapStation {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  totalSlots: number;
  operatorName: string;
  operatorPhone: string;
  activeBatteries: StationBattery[];
}

export interface SwapTransaction {
  id: string;
  timestamp: string;
  bikeId: string;
  riderName: string;
  batteryInSn: string;
  batteryInSoc: number;
  batteryOutSn: string;
  batteryOutSoc: number;
  stationId: string;
  stationName: string;
  feeMinor: number;
  operatorName: string;
}

export interface FleetBike {
  id: string;
  plate: string;
  sn: string;
  model: string;
  status: 'active' | 'warning' | 'critical' | 'idle';
  soc: number;
  v: number;
  temp: number;
  current: number;
  lat: number;
  lng: number;
  speed: number;
  lastSeen: string;
  batterySn: string;
  customerId: string;
  customerName: string;
  powerLocked?: boolean;
}

export interface BikeCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  bikeId: string;
  plan: string;
  status: 'active' | 'overdue' | 'suspended';
  leaseExpiry: string;
  dailyRateMinor: number;
  walletBalanceMinor: number;
  totalSwaps: number;
}

export type StationFilterId = 'all' | 'ready' | 'lagos' | 'abuja';
export type StationViewMode = 'cabinet' | 'table';
