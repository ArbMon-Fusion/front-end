import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DCADataStructure } from '../../agent/types/agent.types';

const DATA_FILE_PATH = path.join(process.cwd(), 'src/app/agent/data/dcaData.json');

// GET - Read DCA data from JSON file
export async function GET() {
  try {
    // Check if file exists, create with default data if not
    if (!fs.existsSync(DATA_FILE_PATH)) {
      const defaultData: DCADataStructure = {
        users: {},
        lastBackup: Date.now(),
        version: "1.0.0"
      };
      
      // Ensure directory exists
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(defaultData, null, 2));
      return NextResponse.json(defaultData);
    }

    const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf8');
    const data = JSON.parse(fileContent);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading DCA data:', error);
    return NextResponse.json(
      { error: 'Failed to read DCA data' },
      { status: 500 }
    );
  }
}

// POST - Write DCA data to JSON file
export async function POST(request: NextRequest) {
  try {
    const data: DCADataStructure = await request.json();
    
    // Validate basic structure
    if (!data.users || typeof data.users !== 'object') {
      return NextResponse.json(
        { error: 'Invalid data structure' },
        { status: 400 }
      );
    }

    // Ensure directory exists
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Update timestamp and write to file
    data.lastBackup = Date.now();
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true, timestamp: data.lastBackup });
  } catch (error) {
    console.error('Error writing DCA data:', error);
    return NextResponse.json(
      { error: 'Failed to write DCA data' },
      { status: 500 }
    );
  }
}

// PUT - Update specific user data
export async function PUT(request: NextRequest) {
  try {
    const { address, userData } = await request.json();
    
    if (!address || !userData) {
      return NextResponse.json(
        { error: 'Address and userData are required' },
        { status: 400 }
      );
    }

    // Read current data
    let currentData: DCADataStructure;
    if (fs.existsSync(DATA_FILE_PATH)) {
      const fileContent = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      currentData = JSON.parse(fileContent);
    } else {
      currentData = {
        users: {},
        lastBackup: Date.now(),
        version: "1.0.0"
      };
    }

    // Update user data
    currentData.users[address] = {
      ...userData,
      lastUpdated: Date.now()
    };
    currentData.lastBackup = Date.now();

    // Write back to file
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(currentData, null, 2));
    
    return NextResponse.json({ success: true, timestamp: currentData.lastUpdated });
  } catch (error) {
    console.error('Error updating user DCA data:', error);
    return NextResponse.json(
      { error: 'Failed to update user DCA data' },
      { status: 500 }
    );
  }
}