# MCP Server for Bosch Home Connect

This MCP (Model Context Protocol) server provides integration with the Bosch Home Connect API, allowing you to control and monitor your Bosch/Siemens smart home appliances.

## Features

- List all connected appliances
- Get appliance status and settings
- View available programs
- Start and stop programs
- Update appliance settings
- OAuth authentication support

## Prerequisites

1. A Home Connect developer account
2. Registered application with Home Connect API
3. Node.js 18+ installed

## Setup

### 1. Register for Home Connect API

1. Go to [Home Connect Developer Portal](https://developer.home-connect.com/)
2. Create an account and register a new application
3. Note down your Client ID and Client Secret

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/nikolausm/mcp-server-home-connect.git
cd mcp-server-home-connect

# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Configuration

Create a `.env` file in the project root:

```env
HOME_CONNECT_CLIENT_ID=your_client_id
HOME_CONNECT_CLIENT_SECRET=your_client_secret
HOME_CONNECT_REDIRECT_URI=http://localhost:3000/callback
HOME_CONNECT_ACCESS_TOKEN=your_access_token
HOME_CONNECT_REFRESH_TOKEN=your_refresh_token
```

### 4. Getting Access Tokens

You'll need to complete the OAuth flow to get access tokens:

1. Use the `get_auth_url` tool to get the authorization URL
2. Visit the URL and authorize the application
3. You'll receive an authorization code
4. Exchange the code for access and refresh tokens using the Home Connect API

## Usage with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "home-connect": {
      "command": "node",
      "args": ["/path/to/mcp-server-home-connect/build/index.js"],
      "env": {
        "HOME_CONNECT_CLIENT_ID": "your_client_id",
        "HOME_CONNECT_CLIENT_SECRET": "your_client_secret",
        "HOME_CONNECT_ACCESS_TOKEN": "your_access_token",
        "HOME_CONNECT_REFRESH_TOKEN": "your_refresh_token"
      }
    }
  }
}
```

## Available Tools

### get_auth_url
Get the OAuth authorization URL for Home Connect.

### get_appliances
List all connected Home Connect appliances.

### get_appliance_status
Get the current status of a specific appliance.

Parameters:
- `haId`: The Home Appliance ID

### get_appliance_programs
Get available programs for an appliance.

Parameters:
- `haId`: The Home Appliance ID

### start_program
Start a program on an appliance.

Parameters:
- `haId`: The Home Appliance ID
- `programKey`: The program key to start
- `options`: (Optional) Program-specific options

### stop_program
Stop the active program on an appliance.

Parameters:
- `haId`: The Home Appliance ID

### get_settings
Get all settings of an appliance.

Parameters:
- `haId`: The Home Appliance ID

### update_setting
Update a setting on an appliance.

Parameters:
- `haId`: The Home Appliance ID
- `settingKey`: The setting key to update
- `value`: The new value for the setting

## Example Usage

```javascript
// Get all appliances
await use_mcp_tool("home-connect", "get_appliances", {});

// Get status of a specific appliance
await use_mcp_tool("home-connect", "get_appliance_status", {
  haId: "BOSCH-HCS06COM1-0123456789AB"
});

// Start a dishwasher program
await use_mcp_tool("home-connect", "start_program", {
  haId: "BOSCH-HCS06COM1-0123456789AB",
  programKey: "Dishcare.Dishwasher.Program.Auto2",
  options: {
    "BSH.Common.Option.StartInRelative": 3600 // Start in 1 hour
  }
});
```

## Troubleshooting

### Authentication Issues
- Ensure your access token is valid
- The server automatically refreshes tokens when they expire
- Check that your Client ID and Secret are correct

### Connection Issues
- Verify your appliances are connected to Home Connect
- Check your internet connection
- Ensure the appliances are in remote control mode

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
