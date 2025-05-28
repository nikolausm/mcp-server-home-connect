import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Home Connect API configuration
const API_BASE_URL = 'https://api.home-connect.com/api';
const CLIENT_ID = process.env.HOME_CONNECT_CLIENT_ID;
const CLIENT_SECRET = process.env.HOME_CONNECT_CLIENT_SECRET;
const REDIRECT_URI = process.env.HOME_CONNECT_REDIRECT_URI || 'http://localhost:3000/callback';

let accessToken = process.env.HOME_CONNECT_ACCESS_TOKEN;
let refreshToken = process.env.HOME_CONNECT_REFRESH_TOKEN;

// Create axios instance with interceptor for auth
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/vnd.bsh.sdk.v1+json',
    'Content-Type': 'application/vnd.bsh.sdk.v1+json'
  }
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Helper function to refresh token
async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await axios.post('https://api.home-connect.com/security/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });
    
    accessToken = response.data.access_token;
    if (response.data.refresh_token) {
      refreshToken = response.data.refresh_token;
    }
    
    return accessToken;
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Initialize MCP server
const server = new Server(
  {
    name: 'home-connect',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Tool definitions
const tools: Tool[] = [
  {
    name: 'get_appliances',
    description: 'Get all connected Home Connect appliances',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_appliance_status',
    description: 'Get the status of a specific appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        }
      },
      required: ['haId']
    }
  },
  {
    name: 'get_appliance_programs',
    description: 'Get available programs for an appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        }
      },
      required: ['haId']
    }
  },
  {
    name: 'start_program',
    description: 'Start a program on an appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        },
        programKey: {
          type: 'string',
          description: 'The program key to start'
        },
        options: {
          type: 'object',
          description: 'Optional program options',
          additionalProperties: true
        }
      },
      required: ['haId', 'programKey']
    }
  },
  {
    name: 'stop_program',
    description: 'Stop the active program on an appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        }
      },
      required: ['haId']
    }
  },
  {
    name: 'get_settings',
    description: 'Get settings of an appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        }
      },
      required: ['haId']
    }
  },
  {
    name: 'update_setting',
    description: 'Update a setting on an appliance',
    inputSchema: {
      type: 'object',
      properties: {
        haId: {
          type: 'string',
          description: 'The Home Appliance ID'
        },
        settingKey: {
          type: 'string',
          description: 'The setting key to update'
        },
        value: {
          type: ['string', 'number', 'boolean'],
          description: 'The new value for the setting'
        }
      },
      required: ['haId', 'settingKey', 'value']
    }
  },
  {
    name: 'get_auth_url',
    description: 'Get the OAuth authorization URL for Home Connect',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_auth_url': {
        if (!CLIENT_ID) {
          throw new Error('CLIENT_ID not configured');
        }
        const authUrl = `https://api.home-connect.com/security/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
        return {
          content: [
            {
              type: 'text',
              text: `Authorization URL: ${authUrl}\n\nPlease visit this URL to authorize the application and get the authorization code.`
            }
          ]
        };
      }

      case 'get_appliances': {
        const response = await api.get('/homeappliances');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'get_appliance_status': {
        const { haId } = args as { haId: string };
        const response = await api.get(`/homeappliances/${haId}/status`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'get_appliance_programs': {
        const { haId } = args as { haId: string };
        const response = await api.get(`/homeappliances/${haId}/programs`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'start_program': {
        const { haId, programKey, options } = args as {
          haId: string;
          programKey: string;
          options?: Record<string, any>;
        };
        
        const data: any = {
          data: {
            key: programKey
          }
        };
        
        if (options) {
          data.data.options = options;
        }
        
        const response = await api.put(`/homeappliances/${haId}/programs/active`, data);
        return {
          content: [
            {
              type: 'text',
              text: `Program ${programKey} started successfully`
            }
          ]
        };
      }

      case 'stop_program': {
        const { haId } = args as { haId: string };
        await api.delete(`/homeappliances/${haId}/programs/active`);
        return {
          content: [
            {
              type: 'text',
              text: 'Program stopped successfully'
            }
          ]
        };
      }

      case 'get_settings': {
        const { haId } = args as { haId: string };
        const response = await api.get(`/homeappliances/${haId}/settings`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data, null, 2)
            }
          ]
        };
      }

      case 'update_setting': {
        const { haId, settingKey, value } = args as {
          haId: string;
          settingKey: string;
          value: any;
        };
        
        const response = await api.put(`/homeappliances/${haId}/settings/${settingKey}`, {
          data: {
            key: settingKey,
            value: value
          }
        });
        
        return {
          content: [
            {
              type: 'text',
              text: `Setting ${settingKey} updated successfully`
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    if (error.response?.status === 401 && refreshToken) {
      // Try to refresh token and retry
      try {
        await refreshAccessToken();
        // Return error for now, would need to retry the actual API call
        throw new Error('Token refreshed, please retry the request');
      } catch (refreshError) {
        throw new Error(`Authentication failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`);
      }
    }
    
    throw new Error(`Tool execution failed: ${error.message}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Home Connect MCP server running');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
