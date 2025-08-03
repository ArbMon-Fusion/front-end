"use client";
import { DCADataStructure, UserDCAData, DCAInvestment, SwapHistoryItem } from '../types/agent.types';

export class DataManager {
  private static instance: DataManager;
  private data: DCADataStructure;

  private constructor() {
    this.data = this.getDefaultData();
    // Load data from JSON file via API
    this.loadData();
  }

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  public async loadData(): Promise<void> {
    try {
      console.log('📁 Loading DCA data from JSON file...');
      const response = await fetch('/api/dca-data');
      if (response.ok) {
        this.data = await response.json();
        console.log('✅ DCA data loaded successfully');
      } else {
        console.warn('⚠️ Failed to load DCA data, using default');
      }
    } catch (error) {
      console.error('❌ Error loading DCA data from JSON file:', error);
    }
  }

  private getDefaultData(): DCADataStructure {
    return {
      users: {},
      lastBackup: Date.now(),
      version: "1.0.0"
    };
  }

  private async saveToFile(): Promise<void> {
    try {
      console.log('💾 Saving DCA data to JSON file...');
      this.data.lastBackup = Date.now();
      
      const response = await fetch('/api/dca-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.data, this.bigIntReplacer),
      });

      if (response.ok) {
        console.log('✅ DCA data saved successfully');
      } else {
        console.error('❌ Failed to save DCA data');
      }
    } catch (error) {
      console.error('❌ Error saving DCA data to JSON file:', error);
    }
  }

  // BigInt serializer for JSON.stringify
  private bigIntReplacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  // User data operations
  public getUserData(address: string): UserDCAData {
    if (!this.data.users[address]) {
      this.data.users[address] = {
        activeInvestments: [],
        history: [],
        totalInvested: "0",
        totalReceived: "0",
        lastUpdated: Date.now()
      };
      this.saveToFile();
    }
    return this.data.users[address];
  }

  public async updateUserData(address: string, userData: UserDCAData): Promise<void> {
    this.data.users[address] = {
      ...userData,
      lastUpdated: Date.now()
    };
    await this.saveToFile();
  }

  // Investment operations
  public async addInvestment(address: string, investment: DCAInvestment): Promise<void> {
    const userData = this.getUserData(address);
    userData.activeInvestments.push(investment);
    await this.updateUserData(address, userData);
  }

  public async updateInvestment(address: string, investmentId: string, updates: Partial<DCAInvestment>): Promise<void> {
    const userData = this.getUserData(address);
    const index = userData.activeInvestments.findIndex(inv => inv.id === investmentId);
    
    if (index !== -1) {
      userData.activeInvestments[index] = {
        ...userData.activeInvestments[index],
        ...updates
      };
      await this.updateUserData(address, userData);
    }
  }

  public async stopInvestment(address: string, investmentId: string): Promise<void> {
    const userData = this.getUserData(address);
    const index = userData.activeInvestments.findIndex(inv => inv.id === investmentId);
    
    if (index !== -1) {
      userData.activeInvestments[index].isActive = false;
      await this.updateUserData(address, userData);
    }
  }

  public async removeInvestment(address: string, investmentId: string): Promise<void> {
    const userData = this.getUserData(address);
    userData.activeInvestments = userData.activeInvestments.filter(inv => inv.id !== investmentId);
    await this.updateUserData(address, userData);
  }

  // History operations
  public async addHistoryItem(address: string, historyItem: SwapHistoryItem): Promise<void> {
    const userData = this.getUserData(address);
    userData.history.unshift(historyItem); // Add to beginning for latest first
    
    // Keep only last 100 history items to prevent file bloat
    if (userData.history.length > 100) {
      userData.history = userData.history.slice(0, 100);
    }
    
    // Update totals
    if (historyItem.status === 'success') {
      userData.totalInvested = (parseFloat(userData.totalInvested) + parseFloat(historyItem.wethAmount)).toString();
      userData.totalReceived = (parseFloat(userData.totalReceived) + parseFloat(historyItem.wmonReceived)).toString();
    }
    
    await this.updateUserData(address, userData);
  }

  public async updateHistoryItem(address: string, historyId: string, updates: Partial<SwapHistoryItem>): Promise<void> {
    const userData = this.getUserData(address);
    const index = userData.history.findIndex(item => item.id === historyId);
    
    if (index !== -1) {
      userData.history[index] = {
        ...userData.history[index],
        ...updates
      };
      await this.updateUserData(address, userData);
    }
  }

  // Get active investments that need execution
  public getInvestmentsDue(): Array<{ address: string; investment: DCAInvestment }> {
    const now = Date.now();
    const due: Array<{ address: string; investment: DCAInvestment }> = [];

    Object.entries(this.data.users).forEach(([address, userData]) => {
      userData.activeInvestments
        .filter(inv => inv.isActive && inv.nextSwapTime <= now)
        .forEach(investment => {
          due.push({ address, investment });
        });
    });

    return due;
  }

  // Statistics
  public getUserStats(address: string) {
    const userData = this.getUserData(address);
    const successfulSwaps = userData.history.filter(h => h.status === 'success').length;
    const failedSwaps = userData.history.filter(h => h.status === 'failed').length;
    const pendingSwaps = userData.history.filter(h => h.status === 'pending').length;

    return {
      totalInvestments: userData.activeInvestments.length,
      activeInvestments: userData.activeInvestments.filter(inv => inv.isActive).length,
      totalSwaps: userData.history.length,
      successfulSwaps,
      failedSwaps,
      pendingSwaps,
      totalInvested: userData.totalInvested,
      totalReceived: userData.totalReceived,
      averageReturn: successfulSwaps > 0 ? 
        (parseFloat(userData.totalReceived) / parseFloat(userData.totalInvested) * 100).toFixed(2) + '%' : 
        '0%'
    };
  }

  // Export data for backup
  public exportData(): DCADataStructure {
    return { ...this.data };
  }

  // Import data from backup
  public async importData(data: DCADataStructure): Promise<void> {
    this.data = data;
    await this.saveToFile();
  }

  // Clear all data (for testing)
  public async clearAllData(): Promise<void> {
    this.data = this.getDefaultData();
    await this.saveToFile();
  }
}