import { PlainSDKConfig } from '../../types';

/**
 * Generate authentication module for Python SDK
 * 
 * @param authConfig - Authentication configuration
 * @param packageName - Python package name
 * @param config - PlainSDK configuration
 * @returns Generated authentication files
 */
export async function generatePythonAuthentication(
  authConfig: any,
  packageName: string,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // If no authentication config, return empty object
  if (!authConfig) {
    return {
      [`${packageName}/core/auth.py`]: generateDefaultAuth()
    };
  }

  // Generate authentication module based on configuration
  const authContent = generateAuthClass(authConfig);

  return {
    [`${packageName}/core/auth.py`]: authContent
  };
}

/**
 * Generate default authentication module
 * 
 * @returns Default authentication module content
 */
function generateDefaultAuth(): string {
  return `"""
Authentication utilities for API requests
"""
from typing import Dict, Optional, Any


class Authentication:
    """
    Authentication handler for API requests
    """
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize authentication handler
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.token = config.get('token')
        self.api_key = config.get('api_key')
    
    def apply_to_request(self, headers: Dict[str, str]) -> Dict[str, str]:
        """
        Apply authentication to request headers
        
        Args:
            headers: Request headers
        
        Returns:
            Updated headers with authentication
        """
        auth_headers = headers.copy()
        
        # Apply token authentication if token is provided
        if self.token:
            auth_headers['Authorization'] = f"Bearer {self.token}"
        
        # Apply API key authentication if API key is provided
        elif self.api_key:
            auth_headers['X-API-Key'] = self.api_key
        
        return auth_headers
`;
}

/**
 * Generate authentication class
 * 
 * @param authConfig - Authentication configuration
 * @returns Authentication class content
 */
function generateAuthClass(authConfig: any): string {
  const types = authConfig.types || [];

  let content = `"""
Authentication utilities for API requests
"""
from typing import Dict, Optional, Any, List
import base64


class Authentication:
    """
    Authentication handler for API requests
    Supports: ${types.join(', ')}
    """
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize authentication handler
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
`;

  // Add property initialization based on auth types
  if (types.includes('bearer')) {
    content += `        self.token = config.get('token')\n`;
  }

  if (types.includes('apiKey')) {
    const apiKeyName = authConfig.names?.apiKey || 'X-API-Key';
    content += `        self.api_key = config.get('api_key')\n`;
    content += `        self.api_key_name = '${apiKeyName}'\n`;
  }

  if (types.includes('basic')) {
    content += `        self.username = config.get('username')\n`;
    content += `        self.password = config.get('password')\n`;
  }

  if (types.includes('oauth2')) {
    content += `        self.access_token = config.get('access_token')\n`;
    content += `        self.token_type = config.get('token_type', 'Bearer')\n`;
  }

  // Add apply_to_request method
  content += `
    def apply_to_request(self, headers: Dict[str, str]) -> Dict[str, str]:
        """
        Apply authentication to request headers
        
        Args:
            headers: Request headers
        
        Returns:
            Updated headers with authentication
        """
        auth_headers = headers.copy()
`;

  let conditionInitialized = "if"

  // Add authentication logic based on types
  if (types.includes('bearer')) {
    content += `        
        # Apply bearer token authentication
        if hasattr(self, 'token') and self.token:
            auth_headers['Authorization'] = f"Bearer {self.token}"
`;
    conditionInitialized = "elif"
  }

  if (types.includes('apiKey')) {
    const location = authConfig.locations?.[0] || 'header';
    const apiKeyName = authConfig.names?.apiKey || 'X-API-Key';

    if (location === 'header') {
      content += `        
        # Apply API key authentication
        ${conditionInitialized} hasattr(self, 'api_key') and self.api_key:
            auth_headers['${apiKeyName}'] = self.api_key
`;
conditionInitialized = "elif"

    }
  }

  if (types.includes('basic')) {
    content += `        
        # Apply basic authentication
         ${conditionInitialized}  hasattr(self, 'username') and hasattr(self, 'password') and self.username and self.password:
            credentials = f"{self.username}:{self.password}"
            encoded = base64.b64encode(credentials.encode('utf-8')).decode('utf-8')
            auth_headers['Authorization'] = f"Basic {encoded}"
`;
conditionInitialized = "elif"

  }

  if (types.includes('oauth2')) {
    content += `        
        # Apply OAuth2 authentication
         ${conditionInitialized} hasattr(self, 'access_token') and self.access_token:
            auth_headers['Authorization'] = f"{self.token_type} {self.access_token}"
`;
  }

  content += `        
        return auth_headers
`;

  return content;
}