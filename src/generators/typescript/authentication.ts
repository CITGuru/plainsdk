import { PlainSDKConfig } from '../../types';

/**
 * Generate authentication module for TypeScript SDK
 * 
 * @param authConfig - Authentication configuration
 * @param config - PlainSDK configuration
 * @returns Generated authentication files
 */
export async function generateAuthentication(
  authConfig: any,
  config: PlainSDKConfig
): Promise<Record<string, string>> {
  // If no authentication config, return empty object
  if (!authConfig) {
    return {
      'src/core/auth.ts': generateDefaultAuth()
    };
  }
  
  // Generate authentication module based on configuration
  const authContent = generateAuthModule(authConfig);
  
  return {
    'src/core/auth.ts': authContent
  };
}

/**
 * Generate default authentication module
 * 
 * @returns Default authentication module content
 */
function generateDefaultAuth(): string {
  return `import { Configuration } from './types';

/**
 * API Key authentication configuration
 */
export interface ApiKeyAuth {
  /**
   * Type of authentication
   */
  type: 'apiKey';
  
  /**
   * API key value
   */
  apiKey: string;
  
  /**
   * API key name
   */
  apiKeyName?: string;
  
  /**
   * Location to include the API key
   */
  in?: 'header' | 'query';
}

/**
 * Bearer token authentication configuration
 */
export interface BearerAuth {
  /**
   * Type of authentication
   */
  type: 'bearer';
  
  /**
   * Bearer token value
   */
  token: string;
  
  /**
   * Prefix for the Authorization header
   */
  prefix?: string;
}

/**
 * Authentication types union
 */
export type AuthConfig = ApiKeyAuth | BearerAuth;
`;
}

/**
 * Generate authentication module
 * 
 * @param authConfig - Authentication configuration
 * @returns Authentication module content
 */
function generateAuthModule(authConfig: any): string {
  const types = authConfig.types || [];
  let content = `import { Configuration } from './types';\n\n`;
  
  // Generate interfaces for each auth type
  if (types.includes('apiKey')) {
    content += generateApiKeyInterface(authConfig);
  }
  
  if (types.includes('bearer')) {
    content += generateBearerInterface(authConfig);
  }
  
  if (types.includes('basic')) {
    content += generateBasicInterface(authConfig);
  }
  
  if (types.includes('oauth2')) {
    content += generateOAuth2Interface(authConfig);
  }
  
  // Add auth types union
  content += `\n/**
 * Authentication types union
 */
export type AuthConfig = ${types.map((type: string) => {
    switch (type) {
      case 'apiKey': return 'ApiKeyAuth';
      case 'bearer': return 'BearerAuth';
      case 'basic': return 'BasicAuth';
      case 'oauth2': return 'OAuth2Auth';
      default: return '';
    }
  }).filter(Boolean).join(' | ')};\n`;
  
  // Add auth service if OAuth2 is included
  if (types.includes('oauth2')) {
    content += `\n${generateOAuth2Service(authConfig)}\n`;
  }
  
  return content;
}

/**
 * Generate API Key authentication interface
 * 
 * @param authConfig - Authentication configuration
 * @returns Generated interface
 */
function generateApiKeyInterface(authConfig: any): string {
  const apiKeyName = authConfig.names?.apiKey || 'X-API-Key';
  const locations = authConfig.locations || ['header'];
  
  return `/**
 * API Key authentication configuration
 */
export interface ApiKeyAuth {
  /**
   * Type of authentication
   */
  type: 'apiKey';
  
  /**
   * API key value
   */
  apiKey: string;
  
  /**
   * API key name
   */
  apiKeyName?: string;
  
  /**
   * Location to include the API key
   */
  in?: ${locations.map((loc:any) => `'${loc}'`).join(' | ')};
}\n\n`;
}

/**
 * Generate Bearer token authentication interface
 * 
 * @param authConfig - Authentication configuration
 * @returns Generated interface
 */
function generateBearerInterface(authConfig: any): string {
  const bearerPrefix = authConfig.names?.bearerPrefix || 'Bearer';
  
  return `/**
 * Bearer token authentication configuration
 */
export interface BearerAuth {
  /**
   * Type of authentication
   */
  type: 'bearer';
  
  /**
   * Bearer token value
   */
  token: string;
  
  /**
   * Prefix for the Authorization header
   */
  prefix?: string;
}\n\n`;
}

/**
 * Generate Basic authentication interface
 * 
 * @param authConfig - Authentication configuration
 * @returns Generated interface
 */
function generateBasicInterface(authConfig: any): string {
  return `/**
 * Basic authentication configuration
 */
export interface BasicAuth {
  /**
   * Type of authentication
   */
  type: 'basic';
  
  /**
   * Username for basic authentication
   */
  username: string;
  
  /**
   * Password for basic authentication
   */
  password: string;
}\n\n`;
}

/**
 * Generate OAuth2 authentication interface
 * 
 * @param authConfig - Authentication configuration
 * @returns Generated interface
 */
function generateOAuth2Interface(authConfig: any): string {
  const flows = authConfig.oauth2?.flows || ['clientCredentials'];
  
  return `/**
 * OAuth2 authentication configuration
 */
export interface OAuth2Auth {
  /**
   * Type of authentication
   */
  type: 'oauth2';
  
  /**
   * OAuth2 flow type
   */
  flow: ${flows.map((flow: any) => `'${flow}'`).join(' | ')};
  
  /**
   * Access token
   */
  accessToken?: string;
  
  /**
   * Refresh token
   */
  refreshToken?: string;
  
  /**
   * Token expiration timestamp
   */
  expiresAt?: number;
  
  /**
   * Token endpoint URL
   */
  tokenUrl?: string;
  
  /**
   * Authorization endpoint URL
   */
  authorizationUrl?: string;
  
  /**
   * OAuth2 scopes
   */
  scopes?: string[];
  
  /**
   * Client ID
   */
  clientId?: string;
  
  /**
   * Client secret
   */
  clientSecret?: string;
  
  /**
   * Redirect URI
   */
  redirectUri?: string;
}\n\n`;
}

/**
 * Generate OAuth2 service
 * 
 * @param authConfig - Authentication configuration
 * @returns Generated OAuth2 service
 */
function generateOAuth2Service(authConfig: any): string {
  const flows = authConfig.oauth2?.flows || ['clientCredentials'];
  
  let content = `/**
 * OAuth2 service for handling token acquisition and refresh
 */
export class OAuth2Service {
  /**
   * Get token using client credentials flow
   * @param clientId - Client ID
   * @param clientSecret - Client secret
   * @param tokenUrl - Token endpoint URL
   * @param scopes - OAuth2 scopes
   * @returns OAuth2 token response
   */
  public async getTokenWithClientCredentials(
    clientId: string,
    clientSecret: string,
    tokenUrl: string,
    scopes?: string[]
  ): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    
    if (scopes && scopes.length > 0) {
      params.append('scope', scopes.join(' '));
    }
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': \`Basic \${btoa(\`\${clientId}:\${clientSecret}\`)}\`
      },
      body: params
    });
    
    if (!response.ok) {
      throw new Error(\`OAuth2 token request failed: \${response.status} \${response.statusText}\`);
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }
  
  /**
   * Refresh OAuth2 token
   * @param refreshToken - Refresh token
   * @param clientId - Client ID
   * @param clientSecret - Client secret
   * @param tokenUrl - Token endpoint URL
   * @returns OAuth2 token response
   */
  public async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    tokenUrl: string
  ): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': \`Basic \${btoa(\`\${clientId}:\${clientSecret}\`)}\`
      },
      body: params
    });
    
    if (!response.ok) {
      throw new Error(\`OAuth2 token refresh failed: \${response.status} \${response.statusText}\`);
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  }
}\n
/**
 * OAuth2 token response
 */
export interface OAuth2TokenResponse {
  /**
   * Access token
   */
  accessToken: string;
  
  /**
   * Refresh token
   */
  refreshToken?: string;
  
  /**
   * Token expiration in seconds
   */
  expiresIn?: number;
  
  /**
   * Token type (usually 'Bearer')
   */
  tokenType?: string;
  
  /**
   * Granted scopes
   */
  scope?: string;
}`;
  
  return content;
}